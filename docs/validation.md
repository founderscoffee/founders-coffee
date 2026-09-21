# Validation — Zod conventions

These conventions apply to the [community-building release](./release-strategy.md) and to any future
phase only after it is explicitly approved. A future schema or dormant model is not evidence that
its product flow is launched or currently authorized.

Zod is the **single source of truth** for input shapes across founders.coffee (AGENTS.md §6, NFR-4). Types are inferred (`z.infer`) and reused by `api.ts`, server functions, and forms — one schema per command, never duplicated. Implements **P0-013**.

## Where schemas live

- **Shared primitives → `libs/core/src/validation.ts`** (client-accessible): `moneySchema` (+ `currencySchema`), `idSchema`, `userIdSchema`, `marketCodeSchema`, `paginationSchema`. Reuse these; don't redefine Money / id shapes.
- **Per-domain entity/command schemas → `libs/domain/src/<domain>/schemas.ts`** (created with each domain). These compose the primitives and are the contract for that domain's server-fns + forms.

## Server-function input validation

A server function validates its input with `appValidator`, which `safeParse`s and **throws `AppError('validation_failed', { fields, formErrors })` on invalid input** — flowing through the P0-012 throw boundary so TanStack Query enters `error` and the client reads a stable code:

```ts
import { createServerFn } from '@tanstack/react-start';
import { appValidator } from '@founders-coffee/core';
import { createEventSchema } from '@founders-coffee/domain/events';

export const createEventFn = createServerFn()
  .validator(appValidator(createEventSchema)) // throws AppError on bad input
  .handler(async ({ data }) => handleResult(createEvent(data))); // data is typed (z.infer)
```

The handler's `data` is the **parsed, typed** value — no manual parsing inside the handler.

## Reading validation errors client-side

```ts
import { appErrorCode } from '@founders-coffee/core';

onError: (error) => {
  if (appErrorCode(error) === 'validation_failed') {
    const fields = (error as { details?: { fields?: Record<string, string[]> } }).details?.fields ?? {};
    setFormErrors(fields); // field-level messages from Zod
  }
};
```

`appErrorCode` returns `'validation_failed'` (TanStack serializes the `AppError` — the #6428 typing gap is bridged by the accessor).

## Forms reuse the same schema (DRY)

The current UI forms use ordinary React state. That implementation is approved and may remain.
Client-side validation must still use the same domain Zod schema as the server boundary; do not
create a second hand-written validation contract. TanStack Form is optional when its ergonomics are
useful, not a mandatory dependency.

## Conventions

- **Coercion:** form inputs arrive as strings (`FormData`) — coerce inside the domain schema with `z.coerce.number()` / `z.coerce.date()` so the same schema accepts both serialized form data and typed API calls where practical.
- **Money:** always `moneySchema` → `{ amount_minor: int, currency }`. Never accept a bare number for money.
- **IDs:** `idSchema` (or a prefix-specific refinement) — never a free-form string for an entity id.
- **User ids:** `userIdSchema` — trimmed, non-empty, capped at 128 characters, and deliberately no
  format. An entity id comes from the `libs/core` factory and `idSchema` describes it exactly. An
  account id does not: Better Auth mints it, so its shape is that library's configuration.
  `defaultGenerateId` currently returns 32 characters of `a-zA-Z0-9` with no prefix and no
  underscore, while `advanced.database.generateId` also accepts `'uuid'`, `'serial'` and an
  arbitrary function — and ids minted under one setting outlive a change to another. Asserting a
  format on an identifier another system owns fails closed on real accounts: `recordAttendanceSchema`,
  `recordAttendanceBatchSchema`, `correctAttendanceSchema`, `updateHostTrustSchema` and
  `recordReviewSchema` each validated `userId` with `idSchema`, which no account has ever matched.
  Whether an id names a real account is the foreign key's job, not the schema's.
- **Defaults + bounds:** list endpoints use `paginationSchema` (caps `pageSize` at 100).
- **Error messages:** Zod messages are developer-facing (logged); user-facing copy comes from i18n keyed by the field/code — never surface raw Zod messages to users.
