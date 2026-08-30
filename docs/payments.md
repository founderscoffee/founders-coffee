# Payments — B2B monetization (Year-1 manual)

The payment layer for founders.coffee. Implements **P0-015** (FR-P3, FR-M5, NFR-6, NFR-10). Lives across three libs (AGENTS §3/§6): data in `libs/db`, the status machine in `libs/domain` (the `payments/` folder), the provider in `libs/payments`.

## Model

- **Community participation is free.** Membership, events, participation, and ordinary hosting never create an Order. Sponsors and commercial hosted-challenge clients may pay for B2B services; the platform may owe prize payouts.
- **In-market, in-currency** (NFR-6) — no cross-border, no FX. Orders carry `marketCode` + a `Money` amount (`amount_minor` integer + `currency`).
- **Year 1 = recorded, executed manually.** An admin confirms an Order after the external payment lands (bank transfer / BaridiMob). Automated gateway providers arrive in **P4** behind the `PaymentProvider` interface.

## Order / Invoice

An **Order** is a _generic_ payment record for "something payable" — not coupled to any one entity:

| field                           | meaning                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `purpose`                       | `sponsorship` \| `hosted_challenge_fee` \| `prize_payout`; legacy `host_fee` is deprecated and must not be used |
| `referenceType` / `referenceId` | polymorphic link to what's paid (e.g. `sponsorship` / a sponsorship id — Sponsorship lands SP-001/P1-011)       |
| `amountMinor` + `currency`      | the `Money` value                                                                                               |
| `status`                        | `pending` → `paid` / `cancelled`; `paid` → `refunded`                                                           |
| `provider` / `providerRef`      | `manual` (Year 1); gateway + txn ref in P4                                                                      |

An **Invoice** is 1:1 with its Order — the bill record (`number`, `billTo`, amount) issued to the payer.

## Status machine (`libs/domain`)

```
pending ──confirm──▶ paid ──refund──▶ refunded
   │
   └──cancel──▶ cancelled
```

`cancelled` and `refunded` are terminal. `failed`/`disputed` arrive with P4 gateway providers. Pure (`canTransition` / `transition` → `Result`); the provider stays in the Result flow.

## The provider (`libs/payments`)

```ts
interface PaymentProvider {
  initiate(input): Promise<Result<Order>>; // create pending order + invoice
  confirm(orderId, actor): Promise<Result<Order>>; // pending → paid (atomic + idempotent)
  cancel(orderId, actor): Promise<Result<Order>>; // pending → cancelled
  refund(orderId, actor, reason?): Promise<Result<Order>>; // paid → refunded
}
```

- **`ManualProvider`** is the Year-1 real variant — no gateway, no separate dev variant (it's testable with real D1). `createManualProvider(createDb(env.DB))` per request (the #5323 discipline).
- **Atomic + idempotent confirms**: `UPDATE orders SET status='paid' WHERE id=? AND status='pending'` (D1 has no interactive transactions — AGENTS §11). A second confirm of an already-paid order returns the paid order (no error) — safe under retried admin actions and P4 webhook retries.
- **Audit (FR-M4)**: every transition is structured-logged via `libs/observability` (`payment.confirmed` etc. with the actor). A dedicated `order_status_history` table arrives with P1-014 (admin payment management).

## Using it from a server function

```ts
// libs/server-fns (the confirm endpoint, behind requirePermission + createStart authz — P1-017)
.handler(async ({ data }) =>
  handleResult(
    createManualProvider(createDb(env.DB)).confirm(data.orderId, { userId: context.session.user.id }),
  ),
);
```

`handleResult` unwraps the `Result` → throws `AppError` on `!ok` (the P0-012 throw boundary); the client reads `order_not_found` / `order_not_pending` / `invalid_order_transition` via `appErrorCode`.

## P4: gateway providers

A gateway provider (e.g. BaridiMob) implements the same `PaymentProvider` interface: `initiate` opens a gateway session (returns the order with a `providerRef` + payment URL); a **webhook** calls `confirm` once the gateway reports success. `confirm` stays idempotent, so nothing else changes — NFR-10 (adding a market/provider touches no unrelated modules). `failed`/`disputed` statuses + payout automation land then.
