# Release Notes — v<X.Y.Z> (<YYYY-MM-DD>)

> Reusable template (`10_DEPLOYMENT.md` → Release Notes). Copy to
> `docs/releases/v<X.Y.Z>.md` per release. Keep user-facing sections free
> of internal jargon; keep the internal section for the team.

## Version

- App version: `<X.Y.Z>` (matches `mobile/app.json` → `expo.version`)
- Android versionCode: `<auto — eas.json production autoIncrement>`
- Build profile: `production` · Track: `<internal | closed | production>`
- Backend: api commit `<sha>` · environment `<Development | Staging | Production>`
- Release date: `<YYYY-MM-DD>`

## Highlights (user-facing)

- <one-line summary of notable changes>

## Added / Changed / Fixed

### Added
- <...>

### Changed
- <...>

### Fixed
- <...>

## Security & privacy

- <security-relevant changes; note if the Data Safety form or privacy
  policy changed and was re-reviewed by legal>

## Migrations

- <db migrations included, or "none">. Confirm `prisma migrate deploy`
  ran against the target environment before traffic (per `api/DEPLOYMENT.md`).

## Rollback

- Mobile: see `docs/MOBILE_ROLLBACK.md`.
- Backend: redeploy previous image (see `api/DEPLOYMENT.md`).

## Known issues / accepted exceptions

- Dependency audit: see `docs/DEPENDENCY_AUDIT.md`.
- <other known limitations>

## Release checklist reference

- Readiness matrix: `docs/RELEASE_READINESS.md` (all items PASS or
  explicitly waived for this release).
