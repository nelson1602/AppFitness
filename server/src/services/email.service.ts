import nodemailer from 'nodemailer'

const SMTP_CONFIGURED = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
)

const transporter = SMTP_CONFIGURED
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null

const FROM = process.env.SMTP_FROM ?? `AppFitness <noreply@appfitness.local>`

// ─── HTML templates ────────────────────────────────────────────────────────────

const base = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f0f; color: #e2e8f0; margin: 0; padding: 32px 16px; }
    .card { max-width: 520px; margin: 0 auto; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; overflow: hidden; }
    .header { background: #141414; padding: 24px 32px; border-bottom: 1px solid #2a2a2a; }
    .logo { font-size: 20px; font-weight: 800; color: #ccff00; letter-spacing: -0.5px; }
    .body { padding: 32px; }
    h2 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #fff; }
    p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #94a3b8; }
    .cta { display: inline-block; margin-top: 8px; padding: 12px 28px; background: #ccff00; color: #000; font-weight: 700; font-size: 15px; border-radius: 10px; text-decoration: none; }
    .footer { padding: 20px 32px; border-top: 1px solid #2a2a2a; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><span class="logo">AppFitness</span></div>
    <div class="body">${content}</div>
    <div class="footer">You are receiving this because you are a registered AppFitness user.</div>
  </div>
</body>
</html>`

const reminderHtml = (username: string, daysLeft: number) =>
  base(`
    <h2>Your evaluation is coming up, ${username}!</h2>
    <p>Your 4-week fitness evaluation is in <strong style="color:#ccff00">${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.
    This is when we recalculate your calorie targets, macros, and training plan based on your latest progress.</p>
    <p>Log your body weight now to make sure the recalculation uses the most accurate data.</p>
    <a href="${process.env.CLIENT_URL ?? 'http://localhost:5173'}/dashboard" class="cta">Open Dashboard</a>
  `)

const dueHtml = (username: string) =>
  base(`
    <h2>Time for your 4-week evaluation, ${username}!</h2>
    <p>It has been 4 weeks since your last evaluation. Open AppFitness to complete it — it only takes a minute.</p>
    <p>We will recalculate your <strong style="color:#ccff00">calorie targets, macros, and training plan</strong> based on your current weight and recent progress.</p>
    <a href="${process.env.CLIENT_URL ?? 'http://localhost:5173'}/dashboard" class="cta">Start Evaluation</a>
  `)

// ─── Public API ────────────────────────────────────────────────────────────────

export const sendReevaluationEmail = async (
  to:       string,
  username: string,
  daysLeft: number,
): Promise<void> => {
  if (!transporter) return

  const isReminder = daysLeft > 0

  await transporter.sendMail({
    from:    FROM,
    to,
    subject: isReminder
      ? `Your fitness evaluation is in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
      : `Time for your 4-week fitness evaluation!`,
    html: isReminder ? reminderHtml(username, daysLeft) : dueHtml(username),
  })
}
