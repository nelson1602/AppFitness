# AppFitnessRD — Legal Approval Handoff

> **REVIEW PACK — NOT LEGAL ADVICE.** This file turns the remaining legal
> placeholders into explicit owner inputs, counsel decisions, and sign-off
> criteria. It does not itself approve the product or replace advice from a
> qualified lawyer in every launch jurisdiction.

Prepared: 2026-09-29 · Technically refreshed: 2026-09-30 · Owner facts last recorded: 2026-09-29 · Repository
baseline: `f995dec` plus the FEATURE-012 S-2 candidate · Product: public-v1
Phase 21 mobile fitness and wellness application, with a store subscription
required for launch and its server foundation implemented but inert.

## Review set

Counsel must review these documents together:

- `DATA_INVENTORY.md`
- `PRIVACY_POLICY.md`
- `TERMS_OF_USE.md`
- `HEALTH_DISCLAIMER.md`
- `PLAY_DATA_SAFETY.md`
- `STORE_PRIVACY_SUBMISSION_MATRIX.md`

The repository establishes product facts. Counsel owns legal conclusions,
applicable-law analysis, contractual language, and publication approval.

## Owner decision record — 2026-09-29

- Publisher/controller: **Nelson Deschamps**, an individual trading publicly as
  **HardTech Solutions**.
- Public address: **Calle La Guardia 41, Santo Domingo D.N., Dominican
  Republic**.
- Initial market: **Dominican Republic**.
- Product minimum age: **16**. This is a product choice, not a legal conclusion
  that users aged 16–17 can consent independently.
- Public support: `support@appfitnessrd.com`; privacy requests:
  `privacy@appfitnessrd.com` (receipt confirmed by the owner).
- Commercial model: one auto-renewing monthly subscription, with a one-month
  free trial and an owner target of **US$5/month**. Store-localized prices and
  introductory-offer eligibility must come from Apple/Google, never from a
  hardcoded client amount. There are no ads.
- Intended legal-policy effective date: the actual first-public-release date,
  targeted for November 2026 or earlier.
- Controlling legal language: **Spanish**; English is a translation. The app
  continues to present product and legal surfaces according to the user's
  selected language.
- Anonymized security-audit retention preference: **12 months**, subject to
  qualified legal confirmation and an implemented deletion schedule.

These answers remove owner-input ambiguity; they do **not** close the counsel,
store-configuration, subscription-implementation, or publication gates.

## A. Owner facts required before counsel can finish

The owner must provide one written answer for every row. Do not put identity
documents, credentials, tax numbers, or secrets in the repository.

| ID   | Required owner fact                                                                                       | Why it is needed                                                                | Status                                                                                                                                                                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-01 | Publisher type: individual or registered entity                                                           | Identifies the controller/provider and store seller                             | **OWNER ANSWERED** — individual                                                                                                                                                                                                                                                                                  |
| O-02 | Exact legal name and public trade name                                                                    | Must match the store listing and published policies                             | **OWNER ANSWERED** — Nelson Deschamps, trading publicly as HardTech Solutions                                                                                                                                                                                                                                    |
| O-03 | Public business address, country of establishment, and jurisdiction                                       | Controller notice, governing law, consumer rights                               | **OWNER ANSWERED** — Calle La Guardia 41, Santo Domingo D.N., Dominican Republic; governing-law conclusion remains L-01/L-12                                                                                                                                                                                     |
| O-04 | Launch countries/regions for v1                                                                           | Determines which laws and store obligations apply                               | **OWNER ANSWERED** — Dominican Republic                                                                                                                                                                                                                                                                          |
| O-05 | Intended audience and minimum age; whether children are excluded                                          | Eligibility, consent, Families/Kids rules                                       | **PARTIAL** — minimum age 16; treatment of users aged 16–17 and any guardian-consent/store-audience obligation remain L-08                                                                                                                                                                                       |
| O-06 | Public support contact and verified privacy mailbox                                                       | Rights requests and store-review contact                                        | **OWNER ANSWERED** — `support@appfitnessrd.com`; receipt at `privacy@appfitnessrd.com` confirmed 2026-09-29                                                                                                                                                                                                      |
| O-07 | Public policy URLs and final external account-deletion request URL                                        | Mandatory store metadata; the deployed `/delete-account` route is the candidate | OPEN — end-to-end verification required                                                                                                                                                                                                                                                                          |
| O-08 | Policy effective date and notice channel for material changes                                             | Final policy publication                                                        | **PARTIAL** — effective on first public release, targeted for November 2026 or earlier; exact date and notice rule remain L-13                                                                                                                                                                                   |
| O-09 | Whether v1 is free and has no payments, subscriptions, ads, or paid promotion                             | Store declarations and consumer terms                                           | **OWNER ANSWERED** — auto-renewing monthly subscription; one-month free trial; target base price US$5/month; no ads. S-1 server runtime and S-2 native boundary exist but are disabled; purchase UX and store products do not exist yet                                                                            |
| O-10 | Human process for access/export/correction/restriction requests, including response owner and target time | The app has deletion but no self-service export                                 | **OWNER ANSWERED IN PRINCIPLE** — Nelson Deschamps receives requests at `privacy@appfitnessrd.com`, verifies control of the registered email/account, prepares the available data, delivers it through a secure channel, records completion, and confirms to the requester; statutory response time remains L-07 |
| O-11 | Human process for a Web deletion request, including identity verification and completion notice           | Google requires deletion outside the installed app                              | **PARTIAL** — existing guarded Web route plus `privacy@appfitnessrd.com` escalation; signed-out end-to-end verification and final identity/completion procedure remain open                                                                                                                                      |
| O-12 | Countries/regions used by Railway, Postmark, Cloudflare, and Sentry for this account                      | Transfer and subprocessor disclosures                                           | OPEN                                                                                                                                                                                                                                                                                                             |

## B. Decisions requiring qualified counsel

| ID   | Counsel decision                                                                                  | Repository fact that constrains the answer                                                                  | Required output                                                                    |
| ---- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| L-01 | Applicable privacy, consumer, contract, and health/wellness laws in every O-04 market             | The app processes account, body, nutrition, workout, progress, allergy/preference, and wellness-safety data | Written jurisdiction matrix                                                        |
| L-02 | Controller/provider identity and required registration or representative                          | No legal entity is established by the repository                                                            | Final identity block for both policies                                             |
| L-03 | Lawful basis and any consent requirement for each processing purpose                              | Core data is necessary for account/app functionality; health/wellness classifications are legal questions   | Purpose-by-purpose legal-basis table                                               |
| L-04 | Whether any data is legally classified as sensitive/health data and what heightened duties follow | Product includes body metrics, allergies/preferences, wellness declarations, and fitness/nutrition records  | Final privacy wording and consent/disclosure instructions                          |
| L-05 | Retention period for the anonymized security audit and any legal holds                            | Account/user-owned data is deleted immediately; owner preference is 12 months for the anonymized audit      | Confirm or replace the 12-month period; provide legal basis and deletion procedure |
| L-06 | Whether immediate irreversible deletion conflicts with any O-04 law                               | There is no grace/recovery window                                                                           | Approval or required product change                                                |
| L-07 | Rights and request procedure, especially interim export/access                                    | No self-service export exists                                                                               | Final rights section and operational SLA                                           |
| L-08 | Children/minors position                                                                          | Owner selected minimum age 16, so users aged 16–17 may be minors under applicable law                       | Confirm eligibility/guardian-consent rule and store audience settings              |
| L-09 | Roles of Railway, Postmark, Cloudflare, and Sentry; DPAs/subprocessors and transfer mechanisms    | These four external paths are active; no advertising or third-party analytics SDK exists                    | Approved provider list and transfer language                                       |
| L-10 | Google Play collection-versus-sharing classification                                              | Service-provider exceptions depend on live terms and actual agreements                                      | Signed Data Safety answers                                                         |
| L-11 | Health disclaimer and non-medical-device position in each O-04 market                             | App is deterministic fitness/wellness guidance, not diagnosis, treatment, clearance, or professional advice | Approved disclaimer and any in-app warning changes                                 |
| L-12 | Warranty, liability, indemnity, governing law, venue, and dispute process                         | Terms intentionally leave these open                                                                        | Final Terms clauses                                                                |
| L-13 | Notice mechanism/timing for policy and Terms changes                                              | No notification feature exists in v1                                                                        | Operationally achievable notice rule                                               |
| L-14 | Controlling language and EN/ES consistency                                                        | Owner selected Spanish as controlling legal language; product remains bilingual by user preference          | Approved controlling ES copy and a faithful EN translation                         |
| L-15 | Incident/breach notice wording and process                                                        | Security controls exist, but no control eliminates all risk                                                 | Final wording and escalation owner                                                 |

## C. Store-policy facts counsel should confirm

These are policy requirements, not repository preferences:

- Apple requires a privacy-policy URL and App Privacy answers that include the
  practices of integrated third-party partners.
- Apple apps that create accounts must let users initiate deletion in the app;
  AppFitnessRD already does this.
- Google requires a comprehensive, public, non-geofenced, non-PDF,
  non-editable privacy-policy URL both in Play Console and in the app.
- Google apps with account creation require **both** in-app deletion and an
  external Web resource where a user can request account and associated-data
  deletion without reinstalling the app. The deployed candidate
  `https://account.appfitnessrd.com/delete-account` returned HTTP 200 and
  rendered the AppFitnessRD deletion surface on 2026-09-29; the complete
  signed-out → authentication/request → completion journey has not been
  verified against Google's discoverability and completion requirements.
- Google requires a Health apps declaration. The repository supports the
  **Activity and Fitness** and **Nutrition and Weight Management** categories;
  it does not establish a medical-device, research, period-tracking, or public-
  health claim.

Official references checked on 2026-09-29:

- Apple App Privacy: <https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy>
- Apple account deletion: <https://developer.apple.com/support/offering-account-deletion-in-your-app>
- Google User Data policy: <https://support.google.com/googleplay/android-developer/answer/10144311>
- Google account deletion: <https://support.google.com/googleplay/android-developer/answer/13327111>
- Google Health apps declaration: <https://support.google.com/googleplay/android-developer/answer/14738291>
- Google Health Content and Services: <https://support.google.com/googleplay/android-developer/answer/16679511>

## D. Required counsel deliverables

Legal sign-off is complete only when counsel returns all of the following:

1. Final EN and ES versions of the Privacy Policy, Terms of Use, and Health &
   Wellness Disclaimer with no placeholders and a publication effective date.
2. A signed or attributable review record naming reviewer, qualification,
   jurisdictional scope, date, version/commit reviewed, and approval status.
3. Final retention/deletion schedule and a decision on the anonymized audit.
4. Final rights-request procedure, including export/access requests that the
   app cannot yet perform as self-service.
5. Approved external-service/subprocessor and international-transfer wording.
6. Approved Apple App Privacy answers and Google Data Safety/Health declaration
   answers, reconciled against the live console forms.
7. A list of required product changes, if any. Those changes must be delivered
   and re-reviewed before publication approval can be recorded.

## E. Acceptance record

Do not mark this section complete in advance.

| Gate                                                            | Evidence required                                  | Status |
| --------------------------------------------------------------- | -------------------------------------------------- | ------ |
| Owner facts O-01…O-12 complete                                  | Dated owner decision record outside secrets        | OPEN   |
| Counsel decisions L-01…L-15 complete                            | Written legal review                               | OPEN   |
| Final legal documents have no placeholders or DRAFT banner      | Approved EN/ES publication artifacts               | OPEN   |
| Store answers reconcile with final documents and release binary | Counsel/owner sign-off against live forms          | OPEN   |
| Required product changes delivered and revalidated              | Merged code/docs plus candidate evidence           | OPEN   |
| Publication approval                                            | Named counsel approval and explicit owner approval | OPEN   |
