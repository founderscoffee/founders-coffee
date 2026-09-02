# Deployment evidence

This file records account-side facts that repository code and CI cannot prove. Do not mark a gate
complete from configuration intent alone. Never record secrets, Turnstile responses, full IP
addresses, session cookies, or personal test-account data.

## EC-06 event-create anti-abuse

| Check                           | Staging                                                                                                      | Production                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| WAF rule definition             | Shared Free-plan definition in `libs/infra/cloudflare/waf/free-shared-mutation-rate-limit-rule.json`         | Same zone-wide definition                                                                   |
| WAF rule ID                     | `d11c283bee39488293e86d519e9c546d`                                                                           | `d11c283bee39488293e86d519e9c546d`                                                          |
| Rule behavior                   | Verified on 2026-09-02: responses `403, 403, 403, 403, 403, 429` at a temporary five-request probe threshold | Configuration verified; behavioral probe blocked because the apex hostname does not resolve |
| Turnstile widget/secret pairing | Not externally verified                                                                                      | Not externally verified                                                                     |
| Worker evidence marker          | Uploaded as `true` on 2026-09-02                                                                             | Uploaded as `true` on 2026-09-02                                                            |

### 2026-09-02 Free-plan activation

A dedicated user API token was verified as active and successfully read the `founders.coffee` zone
and its `http_ratelimit` ruleset. The zone is on the Free Website plan. Its one available
rate-limiting-rule slot is occupied by the existing “Leaked credential check” rule. Creating the
committed staging rule returned Cloudflare error `50001`, “exceeded the maximum number of rules,” so
no rule was created or changed.

The Founder subsequently chose full Free-plan compatibility for staging and production. Because the
product is passwordless, the leaked-password rule was replaced in place with one zone-wide rule that
covers `/api/auth/` and `/_serverFn/`. The rule counts by edge colo and source IP, allows 20 requests
per 10 seconds, and blocks for 10 seconds. A single rule covers both environments and stays within
the Free plan's one-rule, path-only, 10-second limits.

The staging behavioral test temporarily narrowed the expression to the unique nonexistent path
`/_serverFn/ec06-waf-free-plan-probe` and reduced the threshold to five requests. The first five
requests reached the Worker and returned its normal `403`; the sixth returned WAF `429`. The final
committed expression and 20-request threshold were restored and read back from Rulesets API version
4 before both Worker evidence markers were uploaded. Production uses the same active zone rule, but
its independent behavioral check remains pending because `founders.coffee` had no resolvable DNS
record from the verification environment.
