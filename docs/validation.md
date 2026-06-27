# Validation — Zod conventions

Zod is the **single source of truth** for input shapes across founders.coffee (AGENTS.md §6, NFR-4). Types are inferred (`z.infer`) and reused by `api.ts`, server functions, and forms — one schema per command, never duplicated. Implements **P0-013**.

## Where schemas live

- **Shared primitives → `libs/core/validation.ts`** (client-accessible): `moneySchema` (+ `currencySchema`), `idSchema`, `marketCodeSchema`, `paginationSchema`. Reuse these; don't redefine Money / id shapes.
- **Per-domain entity/command schemas → `libs/domain/<domain>/schemas.ts`** (created with each domain, P1-005+). These compose the primitives and are the contract for that domain's server-fns + forms.

## Server-function input validation

A server function validates its input with `appValidator`, which `safeParse`s and **throws `AppError('validation_failed', { fields, formErrors })` on invalid input** — flowing through the P0-012 throw boundary so TanStack Query enters `error` and the client reads a stable code:

```ts
import { createServerFn } from '@tanstack/react-start';
import { appValidator } from '@founders-coffee/core';
import { createEventSchema } from '@founders-coffee/domain/events';

export const createEventFn = createServerFn()
  .validator(appValidator(createEventSchema))   // throws AppError on bad input
  .handler(async ({ data }) => handleResult(createEvent(data)));  // data is typed (z.infer)
```

The handler's `data` is the **parsed, typed** value — no manual parsing inside the handler.

## Reading validation errors client-side

```ts
import { appErrorCode } from '@founders-coffee/core';

onError: (error) => {
  if (appErrorCode(error) === 'validation_failed') {
    const fields = (error as { details?: { fields?: Record<string, string[]> } }).details?.fields ?? {};
    setFormErrors(fields);                         // field-level messages from Zod
  }
}
```

`appErrorCode` returns `'validation_failed'` (TanStack serializes the `AppError` — the #6428 typing gap is bridged by the accessor).

## Forms reuse the same schema (DRY)

TanStack Form validates client-side with the **same** schema — no parallel validation:

```ts
import { zodValidator } from '@tanstack/zod-adapter';   // only on the client, for forms
const form = useForm({ defaultValues: ..., validators: { onChange: zodValidator(createEventSchema) } });
```

(Forms may use `@tanstack/zod-adapter`'s `zodValidator` for field-level UI; server-fns use `appValidator` for the typed throw boundary. Same Zod schema both sides.)

## Conventions

- **Coercion:** form inputs arrive as strings (`FormData`) — coerce inside the domain schema with `z.coerce.number()` / `z.coerce.date()` so the same schema accepts both serialized form data and typed API calls where practical.
- **Money:** always `moneySchema` → `{ amount_minor: int, currency }`. Never accept a bare number for money.
- **IDs:** `idSchema` (or a prefix-specific refinement) — never a free-form string for an entity id.
- **Defaults + bounds:** list endpoints use `paginationSchema` (caps `pageSize` at 100).
- **Error messages:** Zod messages are developer-facing (logged); user-facing copy comes from i18n keyed by the field/code — never surface raw Zod messages to users.
