# AppFitnessRD — Store Privacy Submission Matrix (DRAFT)

> **DRAFT — DO NOT SUBMIT AS-IS.** Engineering-prepared mapping for counsel and
> owner review against the live Apple and Google forms. Store definitions and
> service-provider exceptions are policy classifications; this document records
> product facts and proposed mappings, not final legal answers.

Prepared: 2026-09-29 · Repository baseline: `6421013` · Related inventory:
`DATA_INVENTORY.md`.

## Apple App Privacy — proposed technical mapping

All collected account/product data is associated with an authenticated account.
Diagnostics use a scrubbed opaque user identifier in configured production
builds; counsel/owner must decide the live form's linked-data answer.

| Apple family / likely type                                          | Product evidence                                                          | Purpose                                   | Final review                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------- |
| Contact Info — Email Address                                        | Registration, recovery, verification, Postmark delivery                   | App functionality; account management     | OPEN                              |
| Health & Fitness — Health                                           | Body metrics, dietary allergies/preferences, wellness-safety declarations | App functionality; deterministic coaching | OPEN                              |
| Health & Fitness — Fitness                                          | Workouts, routines, activity/fitness levels, progress                     | App functionality                         | OPEN                              |
| User Content — Other User Content                                   | Custom exercise text and optional dietary note                            | App functionality                         | OPEN                              |
| Identifiers — User ID                                               | Account UUID and scrubbed monitoring identifier                           | App functionality; security/diagnostics   | OPEN                              |
| Diagnostics — Crash Data / Performance Data / Other Diagnostic Data | Sentry events when configured                                             | App functionality; reliability/security   | OPEN — reverify candidate payload |
| Other Data                                                          | Sync operations, versions, cursors, and conflict metadata                 | App functionality                         | OPEN — confirm live subtype       |

Proposed exclusions requiring final binary verification: purchases/financial
information, precise/coarse location, contacts, photos/videos, audio,
browsing/search history, advertising data, and tracking across companies.

## Google Play Data Safety — proposed technical mapping

`PLAY_DATA_SAFETY.md` remains the row-level inventory. Before submission the
owner and counsel must map it to the current Play Console subtypes and decide
whether transfers to Railway, Postmark, Cloudflare, and Sentry meet Google's
service-provider exception or must be declared as sharing.

| Play question                                             | Proposed answer from repository evidence                                                            | Gate                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Does the app collect user data?                           | Yes                                                                                                 | Confirm in live form                                                    |
| Is data encrypted in transit?                             | Yes, production uses HTTPS/TLS                                                                      | Verify candidate configuration                                          |
| Can users request deletion?                               | In app: yes. The deployed `/delete-account` candidate responds 200 and renders the deletion surface | BLOCKED pending signed-out end-to-end verification and live-form review |
| Account deletion removes associated data?                 | Yes, except disclosed anonymized security audit                                                     | Legal retention approval required                                       |
| Does the app sell data?                                   | No product/SDK evidence of sale                                                                     | Counsel confirmation                                                    |
| Advertising or ad measurement?                            | No advertising SDK and no ad feature                                                                | Final dependency/binary scan                                            |
| Independent security review?                              | No qualifying certification is recorded                                                             | Answer No unless evidence is obtained                                   |
| Health apps declaration                                   | Activity and Fitness; Nutrition and Weight Management                                               | Confirm in live form                                                    |
| Medical device / health research / government affiliation | No repository evidence or product claim                                                             | Counsel/owner confirmation                                              |

## Required public URLs

| URL                          | Requirement                                                                           | Current state                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Privacy Policy               | Active, public, non-geofenced HTML; linked in both stores and in app                  | Not published                                                                     |
| Terms of Use                 | Public final EN/ES terms                                                              | Not published                                                                     |
| Health & Wellness Disclaimer | Public final EN/ES disclaimer and reachable in app                                    | Not published                                                                     |
| Account-deletion request     | Must let a user initiate deletion outside the installed app and identify AppFitnessRD | Candidate route published; signed-out completion and Google compliance unverified |
| Support                      | Stable support/contact destination                                                    | Owner input required                                                              |

## Console completion evidence

The gate closes only after screenshots or exports of the submitted Apple App
Privacy, Google Data Safety, Google Health apps declaration, account-deletion
URL, audience/content-rating answers, and policy URLs are checked against the
exact release binary and retained outside the public repository if they contain
account identifiers.
