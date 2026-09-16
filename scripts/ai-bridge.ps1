[CmdletBinding()]
param(
  [ValidateSet('Arm', 'Disarm', 'Status', 'Doctor', 'SelfTest', 'StopHook')]
  [string]$Mode = 'Status',

  [ValidateRange(1, 5)]
  [int]$MaxReviews = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ProjectRoot {
  $root = (& git rev-parse --show-toplevel 2>$null | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
    throw 'Run the bridge from an AppFitness Git worktree.'
  }
  return [IO.Path]::GetFullPath($root)
}

function Get-StateDirectory([string]$ProjectRoot) {
  return Join-Path $ProjectRoot '.ai/bridge/.runtime'
}

function Write-JsonAtomically([string]$Path, [object]$Value) {
  $parent = Split-Path -Parent $Path
  [IO.Directory]::CreateDirectory($parent) | Out-Null
  $temporary = "$Path.tmp"
  $json = $Value | ConvertTo-Json -Depth 8
  [IO.File]::WriteAllText($temporary, $json, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Read-State([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-Property([object]$Object, [string]$Name, $Default = $null) {
  if ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name) {
    return $Object.$Name
  }
  return $Default
}

function Convert-ContentToText($Content) {
  if ($null -eq $Content) { return '' }
  if ($Content -is [string]) { return $Content }
  $parts = foreach ($item in @($Content)) {
    if ($item -is [string]) { $item; continue }
    if ($null -ne $item -and $item.PSObject.Properties.Name -contains 'text') {
      [string]$item.text
    }
  }
  return ($parts -join "`n")
}

function Test-IsHookFeedback([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  return $Text.TrimStart().StartsWith('Stop hook feedback:', [StringComparison]::Ordinal)
}

function Get-TranscriptContext([string]$TranscriptPath) {
  $result = @{ user = ''; assistant = '' }
  if ([string]::IsNullOrWhiteSpace($TranscriptPath) -or -not (Test-Path -LiteralPath $TranscriptPath)) {
    return $result
  }

  # Claude transcripts can grow well beyond 400 JSONL entries during one
  # substantial task. Stream the complete file so the original authorization
  # cannot fall out of a fixed tail window, while keeping memory bounded.
  foreach ($line in [IO.File]::ReadLines($TranscriptPath)) {
    try { $entry = $line | ConvertFrom-Json } catch { continue }
    $type = [string](Get-Property $entry 'type' '')
    $message = Get-Property $entry 'message' $null
    if ($null -eq $message) { continue }
    $role = [string](Get-Property $message 'role' $type)
    $text = Convert-ContentToText (Get-Property $message 'content' '')
    if (
      $role -eq 'user' -and
      -not [string]::IsNullOrWhiteSpace($text) -and
      -not (Test-IsHookFeedback $text)
    ) {
      $result.user = $text
    }
    if ($role -eq 'assistant' -and -not [string]::IsNullOrWhiteSpace($text)) {
      $result.assistant = $text
    }
  }
  return $result
}

function Limit-Text([string]$Text, [int]$Maximum) {
  if ($null -eq $Text) { return '' }
  if ($Text.Length -le $Maximum) { return $Text }
  return $Text.Substring($Text.Length - $Maximum)
}

function Protect-BridgeText([string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { return '' }
  $protected = [regex]::Replace($Text, '(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{12,}', 'Bearer [REDACTED]')
  $protected = [regex]::Replace($protected, '\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b', '[JWT_REDACTED]')
  $protected = [regex]::Replace($protected, '(?i)([#?&](?:token|access_token|api_key|key)=)[^&\s)]+', '$1[REDACTED]')
  $protected = [regex]::Replace($protected, '(?i)\b(api[_-]?key|secret|password|token|authorization)\b(\s*[:=]\s*)["'']?[A-Za-z0-9._~+/=-]{12,}["'']?', '$1$2[REDACTED]')
  $protected = [regex]::Replace($protected, '\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', '[EMAIL_REDACTED]', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  return $protected
}

function Get-GitSnapshot([string]$ProjectRoot) {
  $branch = (& git -C $ProjectRoot branch --show-current 2>$null | Out-String).Trim()
  $head = (& git -C $ProjectRoot rev-parse HEAD 2>$null | Out-String).Trim()
  $status = (& git -C $ProjectRoot status --short 2>$null | Out-String).Trim()
  $stat = (& git -c core.safecrlf=false -C $ProjectRoot diff --stat 2>$null | Out-String).Trim()
  return "branch=$branch`nhead=$head`nstatus:`n$status`ndiffstat:`n$stat"
}

function Invoke-CodexReview(
  [string]$ProjectRoot,
  [string]$ReviewerInstructions,
  [string]$SchemaPath,
  [string]$AuthorizedPrompt,
  [string]$ClaudeReport,
  [string]$GitSnapshot,
  [string]$OutputPath
) {
  $prompt = @"
$ReviewerInstructions

<project_root>
$ProjectRoot
</project_root>

<authorized_prompt>
$(Limit-Text (Protect-BridgeText $AuthorizedPrompt) 16000)
</authorized_prompt>

<claude_final_report>
$(Limit-Text (Protect-BridgeText $ClaudeReport) 24000)
</claude_final_report>

<git_snapshot>
$GitSnapshot
</git_snapshot>
"@

  $reviewWorkingDirectory = Join-Path ([IO.Path]::GetTempPath()) 'appfitness-ai-bridge-reviewer'
  [IO.Directory]::CreateDirectory($reviewWorkingDirectory) | Out-Null
  $arguments = @(
    '--sandbox', 'read-only', '--ask-for-approval', 'never',
    '--cd', $reviewWorkingDirectory, '--add-dir', $ProjectRoot,
    'exec', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check',
    '--output-schema', $SchemaPath,
    '--output-last-message', $OutputPath, '-'
  )

  $quotedArguments = foreach ($argument in $arguments) {
    if ($argument -match '[\s"]') {
      '"' + ($argument -replace '"', '\"') + '"'
    } elseif ($argument.Length -eq 0) {
      '""'
    } else {
      $argument
    }
  }
  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = (Get-Command codex -ErrorAction Stop).Source
  $startInfo.Arguments = $quotedArguments -join ' '
  $startInfo.WorkingDirectory = $reviewWorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) { throw 'Unable to start the Codex reviewer process.' }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $process.StandardInput.Write($prompt)
  $process.StandardInput.Close()
  $process.WaitForExit()
  $standardOutput = $stdoutTask.Result
  $standardError = $stderrTask.Result
  $exitCode = $process.ExitCode
  $process.Dispose()

  if ($exitCode -ne 0) {
    $diagnosticOutput = (($standardError, $standardOutput) -join "`n").Trim()
    throw "Codex review failed with exit code $exitCode. $diagnosticOutput"
  }
  if (-not (Test-Path -LiteralPath $OutputPath)) {
    throw 'Codex did not produce the structured review file.'
  }
  return Get-Content -LiteralPath $OutputPath -Raw | ConvertFrom-Json
}

function Assert-Review($Review) {
  $allowed = @('continue', 'needs_user', 'complete')
  if ($allowed -notcontains [string]$Review.decision) {
    throw "Unexpected review decision: $($Review.decision)"
  }
  if ($Review.decision -eq 'continue' -and [string]::IsNullOrWhiteSpace([string]$Review.next_prompt)) {
    throw 'A continue decision requires a next_prompt.'
  }
  if ($Review.decision -ne 'continue' -and -not [string]::IsNullOrWhiteSpace([string]$Review.next_prompt)) {
    throw 'Only a continue decision may include a next_prompt.'
  }
}

function Write-HookFeedback([string]$Message) {
  [Console]::Error.WriteLine($Message)
  exit 2
}

$projectRoot = Get-ProjectRoot
$stateDirectory = Get-StateDirectory $projectRoot
$statePath = Join-Path $stateDirectory 'state.json'
$reviewerPath = Join-Path $projectRoot '.ai/bridge/reviewer-prompt.md'
$schemaPath = Join-Path $projectRoot '.ai/bridge/review.schema.json'

switch ($Mode) {
  'Arm' {
    $state = [ordered]@{
      armed = $true
      armedAt = [DateTimeOffset]::UtcNow.ToString('o')
      boundSessionId = ''
      reviews = 0
      maxReviews = $MaxReviews
      releaseNextStop = $false
      lastDecision = 'armed'
    }
    Write-JsonAtomically $statePath $state
    Write-Output "AI Bridge armed for the next Claude session (maximum reviews: $MaxReviews)."
    break
  }
  'Disarm' {
    $state = Read-State $statePath
    if ($null -eq $state) { $state = [ordered]@{} }
    $state | Add-Member -NotePropertyName armed -NotePropertyValue $false -Force
    $state | Add-Member -NotePropertyName releaseNextStop -NotePropertyValue $false -Force
    $state | Add-Member -NotePropertyName lastDecision -NotePropertyValue 'disarmed' -Force
    Write-JsonAtomically $statePath $state
    Write-Output 'AI Bridge disarmed.'
    break
  }
  'Status' {
    $state = Read-State $statePath
    if ($null -eq $state) {
      Write-Output 'AI Bridge has no runtime state and is not armed.'
    } else {
      $state | ConvertTo-Json -Depth 8
    }
    break
  }
  'Doctor' {
    foreach ($command in @('git', 'claude', 'codex')) {
      if ($null -eq (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $command"
      }
    }
    foreach ($path in @($reviewerPath, $schemaPath, (Join-Path $projectRoot '.claude/settings.json'))) {
      if (-not (Test-Path -LiteralPath $path)) { throw "Required bridge file not found: $path" }
    }
    Get-Content -LiteralPath $schemaPath -Raw | ConvertFrom-Json | Out-Null
    Get-Content -LiteralPath (Join-Path $projectRoot '.claude/settings.json') -Raw | ConvertFrom-Json | Out-Null
    Write-Output 'AI Bridge doctor passed: commands and configuration are available.'
    break
  }
  'SelfTest' {
    & $PSCommandPath -Mode Doctor | Out-Null
    foreach ($sample in @(
      [pscustomobject]@{ decision = 'continue'; summary = 's'; reason = 'r'; next_prompt = 'Fix only the named issue.' },
      [pscustomobject]@{ decision = 'needs_user'; summary = 's'; reason = 'r'; next_prompt = '' },
      [pscustomobject]@{ decision = 'complete'; summary = 's'; reason = 'r'; next_prompt = '' }
    )) { Assert-Review $sample }
    $redacted = Protect-BridgeText 'Bearer abcdefghijklmnop token=abcdefghijklmnop owner@example.com'
    if ($redacted -match 'abcdefghijklmnop|owner@example.com') {
      throw 'Bridge redaction self-test failed.'
    }
    $invalidWasRejected = $false
    try {
      Assert-Review ([pscustomobject]@{ decision = 'complete'; summary = 's'; reason = 'r'; next_prompt = 'must be empty' })
    } catch {
      $invalidWasRejected = $true
    }
    if (-not $invalidWasRejected) { throw 'Invalid review self-test failed.' }

    $transcriptPath = Join-Path ([IO.Path]::GetTempPath()) "appfitness-ai-bridge-$([Guid]::NewGuid().ToString('N')).jsonl"
    try {
      $transcriptLines = [Collections.Generic.List[string]]::new()
      $transcriptLines.Add((@{
        type = 'user'
        message = @{ role = 'user'; content = 'Authorized original task.' }
      } | ConvertTo-Json -Compress -Depth 5))
      foreach ($index in 1..450) {
        $transcriptLines.Add((@{
          type = 'assistant'
          message = @{ role = 'assistant'; content = "Progress entry $index" }
        } | ConvertTo-Json -Compress -Depth 5))
      }
      $transcriptLines.Add((@{
        type = 'user'
        message = @{ role = 'user'; content = 'Stop hook feedback: generated correction, not new authority.' }
      } | ConvertTo-Json -Compress -Depth 5))
      $transcriptLines.Add((@{
        type = 'assistant'
        message = @{ role = 'assistant'; content = 'Final task report.' }
      } | ConvertTo-Json -Compress -Depth 5))
      [IO.File]::WriteAllLines($transcriptPath, $transcriptLines, [Text.UTF8Encoding]::new($false))

      $context = Get-TranscriptContext $transcriptPath
      if ($context.user -ne 'Authorized original task.') {
        throw 'Long-transcript authorization recovery self-test failed.'
      }
      if ($context.assistant -ne 'Final task report.') {
        throw 'Long-transcript final-report recovery self-test failed.'
      }
    } finally {
      if (Test-Path -LiteralPath $transcriptPath) {
        Remove-Item -LiteralPath $transcriptPath -Force
      }
    }
    Write-Output 'AI Bridge self-test passed without calling Claude or Codex models.'
    break
  }
  'StopHook' {
    $state = Read-State $statePath
    if ($null -eq $state -or -not [bool](Get-Property $state 'armed' $false)) { exit 0 }

    $rawInput = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($rawInput)) { exit 0 }
    try { $event = $rawInput | ConvertFrom-Json } catch { exit 0 }

    $sessionId = [string](Get-Property $event 'session_id' '')
    if ([string]::IsNullOrWhiteSpace($sessionId)) {
      $sessionId = [string](Get-Property $event 'cwd' $projectRoot)
    }
    $boundSessionId = [string](Get-Property $state 'boundSessionId' '')
    if ([string]::IsNullOrWhiteSpace($boundSessionId)) {
      $state.boundSessionId = $sessionId
      Write-JsonAtomically $statePath $state
    } elseif ($boundSessionId -ne $sessionId) {
      exit 0
    }

    if ([bool](Get-Property $state 'releaseNextStop' $false)) {
      $state.armed = $false
      $state.releaseNextStop = $false
      $state.lastDecision = 'released'
      Write-JsonAtomically $statePath $state
      exit 0
    }

    $reviews = [int](Get-Property $state 'reviews' 0)
    $maximum = [int](Get-Property $state 'maxReviews' 2)
    if ($reviews -ge $maximum) {
      $state.releaseNextStop = $true
      $state.lastDecision = 'review_limit'
      Write-JsonAtomically $statePath $state
      Write-HookFeedback 'Codex review limit reached. Stop work and give the user a concise status report; do not begin another change.'
    }

    $transcriptPath = [string](Get-Property $event 'transcript_path' '')
    $recent = Get-TranscriptContext $transcriptPath
    $authorizedPrompt = [string]$recent.user
    $claudeReport = [string](Get-Property $event 'last_assistant_message' '')
    if ([string]::IsNullOrWhiteSpace($claudeReport)) { $claudeReport = [string]$recent.assistant }
    if ([string]::IsNullOrWhiteSpace($authorizedPrompt) -or [string]::IsNullOrWhiteSpace($claudeReport)) {
      $state.releaseNextStop = $true
      $state.lastDecision = 'missing_context'
      Write-JsonAtomically $statePath $state
      Write-HookFeedback 'The bridge could not recover the authorized prompt and final report. Stop and ask the user to review the result manually.'
    }

    [IO.Directory]::CreateDirectory($stateDirectory) | Out-Null
    $outputPath = Join-Path $stateDirectory "review-$([Guid]::NewGuid().ToString('N')).json"
    try {
      $review = Invoke-CodexReview $projectRoot (Get-Content -LiteralPath $reviewerPath -Raw) $schemaPath $authorizedPrompt $claudeReport (Get-GitSnapshot $projectRoot) $outputPath
      Assert-Review $review
    } catch {
      $state.releaseNextStop = $true
      $state.lastDecision = 'review_failed'
      Write-JsonAtomically $statePath $state
      Write-HookFeedback "Codex review failed safely. Stop and report this bridge error to the user: $($_.Exception.Message)"
    } finally {
      if (Test-Path -LiteralPath $outputPath) { Remove-Item -LiteralPath $outputPath -Force }
    }

    $state.reviews = $reviews + 1
    $state.lastDecision = [string]$review.decision
    $state | Add-Member -NotePropertyName lastReviewedAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToString('o')) -Force

    if ($review.decision -eq 'complete') {
      $state.armed = $false
      Write-JsonAtomically $statePath $state
      exit 0
    }

    if ($review.decision -eq 'needs_user') {
      $state.releaseNextStop = $true
      Write-JsonAtomically $statePath $state
      Write-HookFeedback "Codex requires user intervention. Stop without acting and explain this decision: $($review.reason)"
    }

    if ($state.reviews -ge $maximum) {
      $state.releaseNextStop = $true
      $state.lastDecision = 'review_limit'
      Write-JsonAtomically $statePath $state
      Write-HookFeedback "Codex found more work, but the review limit is reached. Stop and report this remaining correction to the user: $($review.next_prompt)"
    }

    Write-JsonAtomically $statePath $state
    Write-HookFeedback ([string]$review.next_prompt)
  }
}
