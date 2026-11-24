# AppFitness admin (staff backoffice)

Single-page app (Vite + React + TypeScript strict) for AppFitness staff.
Spanish UI; every string lives in `src/i18n/es.ts`.

## How it is served

- Built with `base: '/admin/'`. The NestJS API serves `admin/dist` at `/admin`
  and the JSON API at `/admin/api/*` on the **same origin**.
- Routing is a tiny hash router (`/admin/#/usuarios`, `/admin/#/roles`, …), so
  the API only needs to serve `index.html` and `assets/`.
- Invite links look like `/admin/#/invitacion?token=…`. The SPA reads the token
  once, keeps it in memory and removes it from the address bar with
  `history.replaceState`.

## Security model (client side)

- The session is an HttpOnly cookie set by the API. The SPA never sees or
  stores tokens, and stores nothing in `localStorage`/`sessionStorage`.
- `fetch` always uses `credentials: 'same-origin'`; every non-GET request sends
  `X-Admin-CSRF: 1` and `Content-Type: application/json`.
- A 401 on a session-protected call routes to the login screen. Nav items and
  buttons are hidden when `GET /admin/api/auth/me` does not list the needed
  permission; the server enforces every permission regardless.
- The build emits no inline scripts or styles, so a strict CSP
  (`script-src 'self'; style-src 'self'`) works.

## Development

```bash
cd admin
npm ci
npm run dev        # http://localhost:5173/admin/ — proxies /admin/api to http://localhost:3001
```

Run the API locally on port 3001 at the same time.

## Checks

```bash
npm run typecheck
npm run lint          # --max-warnings 0
npm run format:check
npm test              # Vitest + React Testing Library (jsdom), fetch is mocked
npm run build         # tsc --noEmit, then vite build → admin/dist
```

CI: `.github/workflows/admin-ci.yml` runs the same checks when `admin/**`
changes.
