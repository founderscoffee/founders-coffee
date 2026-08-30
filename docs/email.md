# Email

`libs/email` provides the general Cloudflare Email delivery adapter and React Email rendering for founders.coffee. Authentication keeps its purpose-specific OTP adapter in `libs/auth`; the two interfaces are intentionally separate.

Email is used for authentication, billing, and workflows that explicitly select email. Event reminders use PWA web push first and SMS as the fallback.

## Current implementation

- `CloudflareEmailProvider` sends through the native `EMAIL` binding.
- `renderEmail` produces HTML and plain-text output.
- `EmailBase` supplies the shared localized, RTL-aware shell.
- `NotificationEmail` supplies the currently implemented general template.
- provider errors are mapped to stable application error codes.
- provider, renderer, and mapping tests cover the current library behavior.

The complete localized template set for RSVP, reminders, host messages, sponsorship, and billing is partial work; documentation must not describe it as already shipped.

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

Current notification delivery includes direct scheduled-worker paths. The required architecture is producer → Queue → `apps/worker-jobs` consumer, with per-message retry and dead-letter handling. Until those bindings and routes are verified, queue retry must be described as planned rather than operational.

## Remaining work

- complete and verify the localized template inventory;
- connect email only to workflows that explicitly require it;
- persist recipient suppression where applicable;
- prove staging sender configuration and delivery;
- exercise retry/dead-letter behavior once queue-backed email producers are enabled.
