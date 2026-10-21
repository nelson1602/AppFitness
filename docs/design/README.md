# AppFitnessRD visual prototype

`appfitnessrd-prototipo.html` and `muneco.webp` preserve the owner-provided
Claude Artifact as a visual and interaction reference for the AppFitnessRD
redesign.

They are not production application code, an approved data model, or a source
of business rules. The implementation must continue to follow the accepted
ADRs, the React Native/Expo design system, localization, accessibility, and the
public-v1 product scope.

In particular, the prototype's diagnosed conditions, medications, blood
pressure, heart-rate, biometric-login, notification, wearable, and simulated
plan content are not approved public-v1 features. Public v1 is limited to
self-declared food allergies, injuries, and functional or movement limitations
used as deterministic safety constraints.

The versioned HTML differs from the exported Artifact only by removing its
pre-filled demonstration email and password. It intentionally retains external
CDN references so the source remains reviewable, but production code must not
copy those dependencies or the prototype's state and calculation logic.
