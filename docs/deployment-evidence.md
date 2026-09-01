# Deployment evidence

This file records account-side facts that repository code and CI cannot prove. Do not mark a gate
complete from configuration intent alone. Never record secrets, Turnstile responses, full IP
addresses, session cookies, or personal test-account data.

## EC-06 event-create anti-abuse

| Check                           | Staging                                                                                | Production                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| WAF rule definition             | Committed in `libs/infra/cloudflare/waf/staging-server-functions-rate-limit-rule.json` | Committed in `libs/infra/cloudflare/waf/production-server-functions-rate-limit-rule.json` |
| WAF rule ID                     | Not recorded; current OAuth token lacks WAF edit/read scope                            | Not recorded; current OAuth token lacks WAF edit/read scope                               |
| Rule behavior                   | Not verified                                                                           | Not verified; staging verification is required first                                      |
| Turnstile widget/secret pairing | Not externally verified                                                                | Not externally verified                                                                   |
| Worker evidence marker          | Must remain absent                                                                     | Must remain absent                                                                        |

### 2026-09-01 audit

`wrangler whoami` confirmed the intended account and reported Workers write, D1 write, zone read,
and Turnstile widget write scopes. It did not report `Zone WAF Edit`, `Zone WAF Read`, `Firewall
Services Edit`, or an equivalent Rulesets/WAF write permission. No WAF mutation was attempted, no
rule ID was inferred, and neither deployed evidence marker was enabled.

The repository implementation fails closed while this table remains unverified. After an authorized
operator completes the runbook in [`provisioning.md`](./provisioning.md), replace the two “Not
recorded” entries with the Cloudflare rule IDs and add the dated staging result, response statuses,
Security Events confirmation, restored 120-request threshold, and Worker deployment version.
