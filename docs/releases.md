# Environments and releases

| Trigger                | Cloudflare environment | Then                               |
| ---------------------- | ---------------------- | ---------------------------------- |
| push to `develop`      | `staging`              | —                                  |
| push to `main`         | `production`           | tag `vX.Y.Z` and publish a release |
| manual run from `main` | either                 | redeploy only, no tag              |

Merging to `main` is the production approval gate. D1 migrations always run before the Workers
deploy, and the deploy is never cancelled mid-flight.

The version is derived from the conventional commits since the last tag and starts at `v0.1.0`.
While the major is `0`, a breaking change is a minor bump, a `feat` is a minor bump, and everything
else is a patch. Tags are created **after** a successful production deploy, so a version that exists
is a version that reached production.
