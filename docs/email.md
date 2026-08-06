# Email — Cloudflare Email native send + React Email templates

The notification send primitive for founders.coffee. Implements **P0-016** (FR-N1, FR-N3, D13). Lives in `libs/email` (layer:server). The first real consumer is **P1-009** (notifications queue producer → `apps/worker-jobs` consumer → this lib).

## Model

- **Cloudflare Email, native** (D13 — zero external vendors). Sends through the `EMAIL` binding (`send_email`), which gives auto SPF/DKIM/DMARC for the verified sender domain (provisioned at **P0-019**).
- **Structured `send()` — no MIME construction.** Cloudflare's Email Service takes `{ to, from, subject, html, text, cc, bcc, replyTo, headers }` and assembles the RFC 5322 MIME itself. The legacy `EmailMessage` + `mimetext` (raw-MIME) path is not used — so `postal-mime`/`mimetext` are **not** dependencies.
- **One real provider, no dev variant.** `CloudflareEmailProvider` works in dev (Miniflare emulates `send_email` — captures mail to a local sink) and prod (real Email Service), exactly like D1/R2 need no dev variant.
- **General pipeline, distinct from auth.** `libs/auth` keeps its OTP-specific `EmailProvider` (`sendOtp`). This lib is the *general* notification pipeline (`send`). They are intentionally separate; unify only if duplication bites.

## The provider (`libs/email`)

```ts
interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<Result<SendEmailResult>>;
}
```

`SendEmailInput` mirrors the structured builder. `send` returns `Result` (the P0-012 hybrid model — server-fns/worker-jobs unwrap via `handleResult`).

```ts
const provider = createCloudflareEmailProvider(env.EMAIL, defaultFrom);
const result = await provider.send({ to, subject, html, text });
```

Construct **per request** (`createCloudflareEmailProvider(env.EMAIL, defaultFrom)`) — never a module singleton. `defaultFrom` is the verified sender address; `input.from` overrides it. On failure, Cloudflare throws an `Error` with a `.code`; the provider catches it and returns `err(AppError(...))` carrying the `providerCode`.

## Error-code mapping

Cloudflare's error codes map to stable `AppError` codes so callers can react:

| CF code | `AppError.code` | Caller action |
|---|---|---|
| `E_RATE_LIMIT_EXCEEDED`, `E_DAILY_LIMIT_EXCEEDED` | `email_rate_limited` | retry (P1-009 queue DLQ) |
| `E_RECIPIENT_SUPPRESSED` | `email_recipient_suppressed` | stop sending to that address |
| everything else (`E_SENDER_NOT_VERIFIED`, `E_VALIDATION_ERROR`, `E_DELIVERY_FAILED`, …) | `email_send_failed` | config/programming bug |

`mapEmailProviderCode` is pure + unit-tested across the documented CF code table. The original `providerCode` is always in `error.details` for diagnostics.

## Render pipeline + templates

```ts
const { html, text } = await renderEmail(NotificationEmail, { locale, greeting, lines, cta });
```

`renderEmail` renders a React Email template to HTML + a plain-text fallback (two passes of `@react-email/render`, which uses `react-dom/server` — proven on Workers by `apps/web` SSR). Templates are **pure layout**; localized strings are passed in as props (the caller resolves them via `libs/i18n` `m` at P1-009).

- **`EmailBase`** — shared shell. Sets `lang` + `dir` from the locale via `libs/i18n`'s `direction` (FR-N3 — `dir="rtl"` for Arabic). 560px card, system-font stack, Warm Café neutral palette. Every template composes inside it.
- **`NotificationEmail`** — example localized template (`greeting` / `lines` / `cta` / `footer`). Proves the pipeline + RTL path. The full template set (RSVP, reminder, host, sponsorship) lands at **P1-009**.

## Testing (AGENTS §12 — no binding mocks)

- **`cloudflare-provider.test.ts`** runs against the **real Miniflare `EMAIL` binding**: an allowed recipient resolves to `{ messageId }`; a disallowed recipient throws → the provider returns `err` with a `providerCode`. (Miniflare emulates `send_email` but exposes no capture API, so content assertions live in the pure render test.)
- **`render.test.ts`** — pure: renders an Arabic email → asserts `dir="rtl"`/`lang="ar"` + localized content in the HTML + the plain-text part; `dir="ltr"` for a Latin locale.
- **`error-codes.test.ts`** — pure mapping across the CF code table.

## Using it from a consumer (P1-009)

```ts
const { html, text } = await renderEmail(RsvpConfirmationEmail, {
  locale, greeting, lines, cta: { label, href },
});
await handleResult(
  createCloudflareEmailProvider(env.EMAIL, env.MAIL_FROM).send({
    to: recipient.email, subject, html, text,
  }),
);
```

The **caller** (P1-009 worker-jobs consumer) enforces notification preferences (FR-N2) before sending and drives retry/DLQ for `email_rate_limited` via the queue. The provider is the synchronous send primitive.

## Deferrals

- **Attachments** (SP-009 PDF reports) — the structured API supports them; the interface adds the field when P1-009 first needs it (the workers-types `EmailAttachment` is a discriminated union — align then).
- **Suppression persistence** — `email_recipient_suppressed` is surfaced distinctly; a suppression table to stop re-sending arrives with P1-009.
- **Full localized template set** — RSVP/reminder/host/sponsorship templates + the Paraglide `m` call sites land at P1-009.
- **Sender-domain verification** (D13 SPF/DKIM/DMARC) — a provisioning concern, **P0-019** (not code). An unverified `from` throws `E_SENDER_NOT_VERIFIED` → `email_send_failed`.
