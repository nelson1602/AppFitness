# Claude–Codex review bridge

This bridge lets Codex review the end of one Claude Code task and return a concise correction prompt to the same Claude session. It is opt-in, bounded and fail-closed.

## Normal use

1. Open the clean worktree in VS Code.
2. Run `Tasks: Run Task` → `AI Bridge: arm next Claude task`.
3. Give Claude one clearly scoped, authorized task.
4. When Claude tries to finish, Codex reviews the reported outcome and repository state in read-only mode.

Codex may return a correction only inside the already-authorized scope. The bridge stops for the user when the task is complete, a critical decision is required, review fails, or the two-review limit is reached. It never authorizes a new slice, merge, deployment or external-service change.

The arm is consumed by the first Claude session that stops in that worktree. Runtime state is stored under `.ai/bridge/.runtime/`, is ignored by Git, and contains no prompts, responses, diffs or secrets. Common credential, token, URL-parameter and email shapes are redacted before a report is sent to Codex. Keeping state per-worktree prevents an unrelated Claude session from consuming the arm.

The stop hook streams the complete Claude JSONL transcript when recovering the authorized user prompt. It does not rely on a fixed tail window, and it ignores its own `Stop hook feedback:` messages, tool-result entries and `isMeta` messages (including image-display notices) so a long task, visual review or correction cycle cannot replace the original human authorization with generated text. `SelfTest` covers this with an authorization more than 400 entries from the end of a synthetic transcript followed by both metadata and hook feedback.

## Controls

VS Code exposes four tasks:

- `AI Bridge: arm next Claude task`
- `AI Bridge: status`
- `AI Bridge: disarm`
- `AI Bridge: self-test`

The equivalent terminal commands are:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ai-bridge.ps1 -Mode Arm
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ai-bridge.ps1 -Mode Status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ai-bridge.ps1 -Mode Disarm
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ai-bridge.ps1 -Mode SelfTest
```

Claude Code may ask once whether to trust the checked-in hook. Review and approve only this repository hook. The bridge requires authenticated `claude` and `codex` executables, but it does not read or store their credentials.

## Safety boundary

The reviewer treats these as user gates unless the original prompt explicitly and unambiguously authorized the exact action: scope expansion, architecture or product-contract decisions, security/privacy changes, health-data handling, schema or migration changes, dependencies or lockfiles, payments (including Azul), credentials, destructive operations, production/external configuration, merges and deployments.

CI failure, documentation/code disagreement or uncertainty also stops the chain when a safe correction cannot be proven inside the current scope.
