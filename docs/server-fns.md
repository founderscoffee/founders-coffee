# Server functions — the backend (`libs/server-fns`)

The backend of founders.coffee is **server functions** (`createServerFn` from `@tanstack/react-start`), all defined once in `libs/server-fns` and consumed by every app. Implements **P0-012** (scaffold) + AGENTS.md §7.

## Data flow (AGENTS.md §4)

```
Component → hook (TanStack Query) → api.ts → libs/server-fns → libs/domain → libs/db → D1
```

Server functions are the **throw boundary** between the pure domain layer (which returns `Result`) and the client (which receives thrown errors).

## The hybrid error model (the P0-012 decision)

- **`libs/domain`** returns `Result<T>` (`{ ok, data } | { ok: false, error }`). Pure — no throws.
- **`libs/server-fns`** unwraps that `Result` *inside the handler* via the shared `handleResult()` ([libs/core](../libs/core/src/result.ts)) — **throws the `AppError` on `!ok`, returns the data on `ok`**.
- The thrown `AppError` (stable `code` + `message`) is serialized across the wire by TanStack Start → `useQuery`/`useMutation` enter their `error` state **automatically**. No `handleResult` bridge at the component layer.

Read the error's stable `code` client-side with `appErrorCode(error)` (TanStack types the client error generically — the [#6428] gap):

```ts
import { appErrorCode } from '@founders-coffee/core';

const rsvpMutation = useMutation({
  mutationFn: () => api.rsvp(eventId),
  onError: (error) => {
    switch (appErrorCode(error)) {            // 'event_full' | 'forbidden' | 'rate_limited' | 'unknown'
      case 'event_full': toast.error(m.eventFull()); break;
      default: toast.error(m.genericError());
    }
  },
});
```

## The feature-fn pattern (P1-001+)

```ts
import { createServerFn } from '@tanstack/react-start';
import { handleResult } from '@founders-coffee/core';
import { requestContextMiddleware } from '@founders-coffee/server-fns';
import { createEvent } from '@founders-coffee/domain/events';
import { eventInputSchema } from '@founders-coffee/domain/events';

export const createEventFn = createServerFn()
  .middleware([requestContextMiddleware /* , authMiddleware, requirePermission('event','create') */])
  .validator(eventInputSchema)                       // P0-013 (Zod)
  .handler(async ({ data }) => handleResult(createEvent(data)));
```

- `.middleware([...])` — `requestContextMiddleware` (now) + the auth/permission middleware (P1-017). **Add the global middleware to the fn's array** so TanStack types its context (globals are deduped).
- `.handler` — calls the domain fn, unwraps via `handleResult`. Returns data; throws `AppError` on failure.
- Never construct `createAuth`/`createDb` at module scope — always per-request inside the handler (the TanStack #5323 D1-write-lock trap).

## What's wired now vs deferred

| Piece | Status |
|---|---|
| `libs/server-fns` — `requestContextMiddleware` (per-request id + logging), authz primitives (`checkPermission`/`requireAuth`/`requirePermission`), `handleResult` throw boundary, `appErrorCode` | ✅ **P0-012** |
| `authMiddleware` + `requirePermission` **middleware instances** (resolve session from `env`, check RBAC) | ⏳ **P1-017** (need `env`) |
| `createStart` global middleware registration + `createCsrfMiddleware()` | ⏳ **P1-017** (app wiring) |
| Cloudflare `env`-injection (how a server-fn reaches `env.DB`) | ⏳ **P1-017** — `@cloudflare/vite-plugin` 1.42.3 has no `getCloudflareContext`; solve empirically with the real app |

Until P1-017 wires `env`-access + `createStart`, feature server-fns can't run end-to-end (apps are placeholders). The **foundation** — error model, request-context logging, authz logic — is complete and tested.

[#6428]: https://github.com/TanStack/router/issues/6428
