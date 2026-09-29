# AppFitnessRD — Google Play Data Safety Matrix (DRAFT)

> **DRAFT — NOT LEGAL ADVICE.** Engineering-produced mapping to Google Play's
> Data Safety form, grounded in `DATA_INVENTORY.md`. It MUST be reviewed by a
> qualified human/legal reviewer and reconciled against the live Play Console
> form before submission. Category labels and policy questions can change.
> Nothing in this draft authorizes a Console answer or store submission.

Last technically updated: 2026-09-29 · Status: Draft · Evidence commit
`42f6fc9` · App state: public-v1 Phase 21 wellness product.

## Global technical answers

- **Encrypted in transit:** production API and portal traffic uses HTTPS/TLS;
  release mobile builds block cleartext.
- **Deletion mechanism:** a guarded in-app flow permanently deletes the account
  and user-owned rows, while retaining only an anonymized security audit record.
  The legal wording and any jurisdictional retention obligation remain subject
  to review.
- **External service paths:** Railway hosts the API/database; Postmark delivers
  transactional email; Cloudflare serves the deployed account portals; Sentry
  receives scrubbed diagnostics from configured builds.
- **Advertising/analytics:** no advertising SDK or third-party analytics SDK is
  integrated.
- **Final “shared” answers:** `[PLACEHOLDER — qualified review must classify
each service relationship under the live Play definitions. This engineering
inventory does not decide that legal/policy classification.]`

## Matrix

The “Field encryption” column describes additional application-level
field/payload encryption. “No” does not mean the data lacks HTTPS, app-private
storage, access control, or platform protections.

| Data type / likely Play category                                                             |                           Collected | Purpose                                                       | Req/Opt           | In transit | Field encryption at rest                        |        Deletion | Technical note                                                                      |
| -------------------------------------------------------------------------------------------- | ----------------------------------: | ------------------------------------------------------------- | ----------------- | ---------: | ----------------------------------------------- | --------------: | ----------------------------------------------------------------------------------- |
| Username                                                                                     |                                 Yes | Account management                                            | Required          |        Yes | No                                              |             Yes | no legal name required                                                              |
| Email address                                                                                |                                 Yes | Account management, recovery, verification                    | Required          |        Yes | No                                              |             Yes | sent to Postmark for transactional delivery                                         |
| Password / credentials                                                                       |                                 Yes | Account security                                              | Required          |        Yes | Argon2 hash; tokens hash-only server-side       |             Yes | raw reset/verification value delivered by emailed link and submitted for redemption |
| Email-verification status                                                                    |                                 Yes | Account security/reminder                                     | Required          |        Yes | No                                              |             Yes | soft gate; core access remains available                                            |
| Profile data (birth date, gender, height, activity/fitness level, schedule, equipment)       |                                 Yes | Personalization and app functionality                         | Mixed             |        Yes | No                                              |             Yes | map exact subcategories in Console review                                           |
| Goals and targets                                                                            |                                 Yes | App functionality and deterministic coaching                  | Optional          |        Yes | No                                              |             Yes | user-entered                                                                        |
| Wellness Safety Profile (evaluation-completed flag/date, affected areas, movements to avoid) |                                 Yes | Fitness safety constraints and app functionality              | Optional          |        Yes | No                                              |             Yes | no professional result, diagnosis, medication, treatment, or clearance              |
| Progress/body metrics (weight, body measurements, weekly snapshots)                          |                                 Yes | Progress monitoring and coaching                              | Optional          |        Yes | No                                              |             Yes | structured wellness data                                                            |
| Nutrition/food logs (food, quantity, calories, macros)                                       |                                 Yes | Nutrition tracking and coaching                               | Optional          |        Yes | No for structured rows                          |             Yes | flagged queue payloads encrypted on device                                          |
| Dietary preferences/allergies                                                                |                                 Yes | Meal filtering and warnings                                   | Optional          |        Yes | Optional note: AES-256-GCM                      |             Yes | structured fields are not field-encrypted                                           |
| Workout activity (logs, sets, routines)                                                      |                                 Yes | Workout tracking and planning                                 | Optional          |        Yes | No                                              |             Yes | structured fitness activity                                                         |
| User-generated custom exercise text                                                          |                                 Yes | App functionality                                             | Optional          |        Yes | No                                              |             Yes | name/instructions                                                                   |
| Sync metadata and conflict records                                                           |                                 Yes | Offline synchronization and user-directed conflict resolution | Required for sync |        Yes | Sensitive queued payloads only; not every field |             Yes | includes operation ids, versions, cursors, and snapshots                            |
| Crash/error diagnostics                                                                      | Yes in configured production builds | Reliability and security monitoring                           | Operational       |        Yes | N/A                                             | Review required | Sentry; PII disabled, scrubbers applied, candidate re-verification pending          |

## Public-v1 exclusions and retained legacy data

- Public v1 does not collect or expose doctor notes, medications, medical
  conditions, blood pressure, diagnoses, treatments, professional restrictions,
  or professional evaluation results.
- Dormant legacy medical tables and encrypted rows may remain from older builds,
  but their module/routes/sync handlers are not registered in public v1 and
  iCoach does not read them. Account deletion removes them.
- No precise location, contacts, photos, microphone/audio, advertising
  identifiers, payment data, habits, or notification preferences are collected
  by the current public-v1 product.
- The current Web portals do not persist database-backed fitness/wellness data
  in browser storage and do not provide mobile feature parity.

## Blockers before submission

1. **Qualified legal review:** finalize deletion/retention language, rights,
   eligibility, jurisdiction, controller identity, service-provider
   classification, and disclosures.
2. **Live Play Console reconciliation:** map every row to the Console's current
   categories/subtypes and answer its current collection/sharing questions.
3. **Health-app policy review:** confirm the declarations required for fitness,
   nutrition, body metrics, allergies/preferences, and wellness-safety data.
4. **Diagnostics re-verification:** Sentry was configured and historically
   live-verified, but must be reverified on the release candidate and reflected
   in the live form.
5. **Privacy-contact mailbox:** verify that `privacy@appfitnessrd.com` receives
   mail before publishing it.
6. **Published privacy-policy URL and owner approval:** neither is supplied by
   this draft.
