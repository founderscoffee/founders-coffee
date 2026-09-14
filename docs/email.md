# Email

> **Last reviewed:** 2026-09-14. Queue-backed notification delivery is deployed to staging and
> production; staging push/email fallback delivery is proven, while the production policy promotion
> remains tracked in the notification plan.

`libs/email` provides the general Cloudflare Email delivery adapter and React Email rendering for founders.coffee. Authentication keeps its purpose-specific OTP adapter in `libs/auth`; the two interfaces are intentionally separate.

In the current community release, email is used for authentication and workflows that explicitly
select email. Event reminders use PWA web push first and email as the default fallback. SMS is
reserved for same-day cancellation disruption. Billing email is a
future capability under the [release strategy](./release-strategy.md).

## Current implementation

- `CloudflareEmailProvider` sends through the native `EMAIL` binding.
- `renderEmail` produces HTML and plain-text output.
- `EmailBase` supplies the shared localized, RTL-aware shell.
- `NotificationEmail` supplies the currently implemented general template.
- provider errors are mapped to stable application error codes.
- provider, renderer, and mapping tests cover the current library behavior.

The localized template set for current community workflows remains partial and must not be
described as already shipped. Sponsorship and billing templates are future work, not gaps that can
delay the community release.

## Provider contract

```ts
interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<Result<SendEmailResult>>;
}
```

Create the provider per request or worker invocation with the binding and a verified default sender. The provider returns `Result`; server-function or worker boundaries convert failures through the shared typed-error handling.

## Error handling

| Provider condition                      | Application code             | Delivery behavior                                                                       |
| --------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| rate or daily limit                     | `email_rate_limited`         | Retry only when a queue-backed workflow permits it                                      |
| suppressed recipient                    | `email_recipient_suppressed` | Stop sending to that recipient and persist suppression when that feature is implemented |
| sender, validation, or delivery failure | `email_send_failed`          | Treat as configuration or delivery failure and alert appropriately                      |

The original provider code remains diagnostic metadata; secrets and message content must not be logged.

## Localization

- Supported locales are exactly `ar`, `fr`, and `en`.
- Templates receive localized strings as props; they do not embed product copy.
- Arabic renders with `lang="ar"` and `dir="rtl"`; French and English render LTR.
- Every message includes a plain-text alternative.

## Cloudflare setup

Production requires an `EMAIL` binding, a verified sending identity, and all DNS records required by Cloudflare Email. DNS and sender verification are provisioning steps and must be checked in the account; they are not guaranteed merely by declaring the binding.

Miniflare exercises supported binding behavior locally. Sender-domain verification and real delivery must also be tested in staging.

## Delivery architecture

Current notification delivery uses the deployed producer → Queue → `apps/worker-jobs` consumer path,
with per-message retry and dead-letter handling. Staging delivery is proven; production sender and
post-ND-07 policy parity remain release checks.

## Remaining work

- complete and verify the localized template inventory;
- connect email only to workflows that explicitly require it;
- persist recipient suppression where applicable;
- preserve the staging sender and delivery evidence;
- exercise retry/dead-letter behavior against production after the post-ND-07 policy promotion.
