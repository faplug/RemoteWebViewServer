# Slim build (own fork)

Upstream image ships the full Playwright bundle: chromium (594 MB), chromium
headless shell (321 MB), firefox (265 MB) and webkit (274 MB) — 1.5 GB of
browsers plus ~1 GB of system libraries. The server only ever launches the
headless shell (`chromium.launchPersistentContext(..., { headless: true })`),
so everything else is dead weight.

`dockerfile.slim` builds the same TypeScript server on `node:22-bookworm-slim`
and installs only the headless shell:

| | upstream | dockerfile.slim |
|---|---|---|
| image size | 2.57 GB | 926 MB |

## How it is deployed here

Home Assistant runs a **local app** built by Supervisor from this repo's
sources:

```
/usr/share/hassio/apps/local/rwv_slim/     # build context = app folder
  config.yaml      slug rwv_slim, no `image:` -> Supervisor builds it
  Dockerfile       copy of dockerfile.slim
  run.sh
  package.json, package-lock.json, tsconfig.json, src/, self-test/
```

Appears in HA as *Remote WebView Server (slim)*, slug `local_rwv_slim`.
Rebuild after changing sources: `ha apps rebuild local_rwv_slim`.

The browser profile (`/data/pw-data`, 200 MB) holds the Home Assistant login
session for `http://localhost:8123/local/...`; when moving between apps it must
be copied into the new app's data directory before the first start.

## Notes

- `run.sh` must keep LF line endings; `.gitattributes` enforces that.
- Options are set through the Supervisor API:
  `POST http://supervisor/addons/local_rwv_slim/options` with `{"options": {...}}`.
- The HA CLI in this version has no `ha apps options` subcommand.
