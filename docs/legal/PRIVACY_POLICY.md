# AppFitness — Privacy Policy (DRAFT)

> **DRAFT — NOT LEGAL ADVICE.** Engineering-produced draft grounded in
> `DATA_INVENTORY.md`. It MUST be reviewed and completed by a qualified
> human/legal reviewer before publication or any app-store submission.
> Bracketed `[PLACEHOLDER]` fields require business/legal input. Do not
> treat this as a published policy or as evidence of legal compliance.

> Draft refreshed 2026-08-05 · Evidence commit `5bc6683` · App state:
> Phases 13–17 complete (incl. nutrition, workout, progress monitoring).

Effective date: `[PLACEHOLDER — set on publication]`
Data controller: `[PLACEHOLDER — legal entity name, address, contact]`
Contact: `[PLACEHOLDER — privacy contact email]`

## 1. Summary

AppFitness helps you track health, nutrition, and fitness data and
receive deterministic coaching recommendations. We collect only what the
app needs to function. We do **not** sell your data, show third-party
ads, or use third-party analytics. Health-related free-text is
encrypted. This policy describes what we process and your choices.

## 2. Data we process

Grounded in `DATA_INVENTORY.md`:

- **Account & authentication:** email, username, password (stored only as
  an Argon2 hash), and session tokens.
- **Profile:** birth date, gender, height, fitness level, activity level,
  training preferences, and similar profile attributes you enter.
- **Health & medical data you enter:** body metrics (weight, body fat,
  muscle mass, blood pressure, resting heart rate, sleep/stress), and
  free-text such as doctor notes, medical conditions, and medications.
  Free-text health fields (medical notes, conditions, medications,
  restriction notes, and dietary-preference notes) are **encrypted**
  (AES-256-GCM) on your device and on our servers.
- **Nutrition data:** foods you log (with calories/macros), meal entries,
  and your dietary preferences and allergies (used to warn you about foods
  to avoid).
- **Workout data:** logged workouts and sets, routines you build, and any
  custom exercises you create.
- **Progress data:** body-weight and body-measurement entries (waist, hip,
  chest, body-fat %) and the deterministic weekly progress snapshots
  computed on your device. This progress/wellness data is **not
  field-encrypted at rest** (it is protected by device-private storage,
  TLS in transit, and server access controls).
- **Goals:** goal type and targets.
- **On-device data:** an offline-first local database and a device
  encryption key held in your device's secure keystore.
- **Diagnostics (crash reports):** if enabled, scrubbed error/crash
  reports that exclude personal and health data by design. `[PLACEHOLDER:
  confirm whether diagnostics are enabled at launch.]`

We do **not** collect precise location, contacts, photos, or advertising
identifiers.

## 3. How we use data

- To provide the service: authentication, storing your entries,
  synchronizing between your device and our servers, and generating
  deterministic coaching outputs on your device.
- To keep the service reliable and secure (e.g., scrubbed crash
  diagnostics, if enabled).

We rely on `[PLACEHOLDER: legal basis — e.g., performance of a contract
and your consent for health data under GDPR Art. 9]`. Because health
data is involved, explicit consent handling must be finalized in review.

## 4. Storage, security, and transmission

- Traffic is encrypted in transit (HTTPS/TLS).
- Passwords are Argon2-hashed; refresh tokens are stored hashed.
- Health free-text is AES-256-GCM encrypted at rest on device and server.
- Session tokens and the device encryption key are stored in the OS
  secure keystore, never in the app database.

## 5. Data sharing

We do not share your data with third parties for advertising or
analytics. Our only external processor is our error-monitoring provider
(Sentry), which — when enabled — receives scrubbed diagnostic data as a
processor on our behalf. `[PLACEHOLDER: list sub-processors, regions, and
data-processing agreements in review.]`

## 6. Data retention and deletion

`[PLACEHOLDER — retention periods per data category, and legal-hold
obligations, to be set in review.]`

**Status:** account deletion is implemented and available in the app. From
the in-app **Delete account** screen, deleting your account **permanently
and irreversibly** removes the account and all associated user data —
including your nutrition, workout, and progress entries — retaining only an
anonymized (de-identified) security audit record. On-device data is erased
on account deletion and when you uninstall the app. A separate user-facing
data **export** flow is **not yet available**. `[PLACEHOLDER: retention
periods per data category and any legal-hold obligations to be set in
review; confirm no mandated retention window conflicts with immediate
deletion.]`

## 7. Your rights

Subject to applicable law (e.g., GDPR / region-specific), you may have
rights to access, export, correct, delete, or restrict processing of your
data, and to withdraw consent. **Deletion** can be exercised directly in
the app (Delete account). `[PLACEHOLDER: describe how to exercise the
remaining rights — access, export, correction, restriction, and consent
withdrawal are not yet self-service in-app; an interim contact process is
required.]`

## 8. Children

`[PLACEHOLDER — minimum age and children's-data position; health apps
frequently set a minimum age. Must be decided in review.]`

## 9. International transfers

`[PLACEHOLDER — hosting region is US (ADR-P009); transfer mechanisms for
non-US users to be addressed in review.]`

## 10. Changes and contact

We will update this policy as the product evolves. Contact:
`[PLACEHOLDER]`.
