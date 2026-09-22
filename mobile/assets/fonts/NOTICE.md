# Third-party notices — vendored fonts

## Material Symbols Outlined (`FILL=0` and `FILL=1`)

Copyright Google LLC.

Licensed under the **Apache License, Version 2.0**. The complete, verbatim
licence text is in `./LICENSE` beside these files
(SHA-256 `58d1e17ffe5109a7ae296caafcadfdbe6a7d176f0bc4ab01e12a689b0499d8bd`,
11,357 bytes). You may obtain a copy of the License at
<http://www.apache.org/licenses/LICENSE-2.0>.

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an **"AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND**, either express or implied.

Upstream project: <https://github.com/google/material-design-icons>, which
states that the _icons_ are under Apache-2.0. The licence text copied here is
the byte-identical `LICENSE_FONT` shipped with
`@expo-google-fonts/material-symbols` — the same upstream faces, already present
in this repository's dependency tree — so the notice is sourced from the
distribution rather than retyped.

Apache-2.0 §4 requires retaining this notice and the licence, and stating that
the files were modified if they were. **These files are unmodified**: the bytes
below hash-match what the Google Fonts API served, byte for byte (see below).
Only the file _names_ differ from the opaque names the API uses.

### Provenance — reproducible fetch

Both faces were obtained from the **Google Fonts CSS API v2**. Re-verified
2026-09-22; both SHA-256 values reproduced exactly.

Step 1 — request the stylesheet (one per `FILL` value):

```
curl 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0'
curl 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,1,0'
```

**The `User-Agent` decides the format, and this is the one real reproducibility
hazard.** The same URL returns `woff2` to a modern browser UA, `eot` to an
MSIE 6 UA, and `truetype` only to a UA that advertises none of those — curl's
default UA does, which is why the commands above are written bare. Sending a
browser UA yields a _different file_ that will not match these hashes.

Step 2 — follow the single `src: url(...)` in each stylesheet. As resolved on
2026-09-22 (`v374`):

| Face                                           | Resolved asset URL                                                                                                                                                              | Bytes     | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| `FILL=0` → `MaterialSymbolsOutlined-Fill0.ttf` | `https://fonts.gstatic.com/s/materialsymbolsoutlined/v374/kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzaxHMPdY43zj-jCxv3fzvRNU22ZXGJpEpjC_1v-p_4MrImHCIJIZrDCvHOem.ttf` | 970,196   | `5456ee48d2c58c0f444386ac6fb88a90a536d46e083cb4838252e7f1ebeb9f7d` |
| `FILL=1` → `MaterialSymbolsOutlined-Fill1.ttf` | `https://fonts.gstatic.com/s/materialsymbolsoutlined/v374/kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzazHD_dY43zj-jCxv3fzvRNU22ZXGJpEpjC_1v-p_4MrImHCIJIZrDCvHOem.ttf` | 1,439,724 | `fbd6c6ab98b9c08d80676f5d430e67874d9bbfa29f946534f4fa2d63fe6615f3` |

Both report `Version 2.972`. Neither has an `fvar` table — they are **static
instances**, which is exactly why two files are needed to express one axis. Their
internal `name` table families differ (`Material Symbols Outlined` and
`Material Symbols Outlined Filled`), and that difference is what lets a single
`fontFamily` string select a state on every platform.

Resolved URLs are **not** a stable contract: `gstatic.com` paths carry an opaque
hash and a `v###` revision. The **SHA-256 values above are the contract** — the
URLs are recorded so the fetch can be repeated and re-verified, not relied upon.

See `.ai/12_DECISIONS.md` → ADR-P033.
