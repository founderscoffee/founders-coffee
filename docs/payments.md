# Payments — future B2B monetization foundation

> **Future scope.** Payments are not part of the community-building release and must not delay it.
> The existing payment foundation may remain, but no sponsorship, hosted-challenge, prize, billing,
> or provider work is authorized until the community validation gate and explicit Founder / Product
> approval. Community membership, events, participation, and ordinary hosting never create an Order.

The payment layer for founders.coffee. Implements **P0-015** (FR-P3, FR-M5, NFR-6, NFR-10). Lives across three libs (AGENTS §3/§6): data in `libs/db`, the status machine in `libs/domain` (the `payments/` folder), the provider in `libs/payments`.

## Model

- **Community participation is free.** Membership, events, participation, and ordinary hosting never create an Order. Sponsors and commercial hosted-challenge clients may pay for B2B services; the platform may owe prize payouts.
- **In-market, in-currency** (NFR-6) — no cross-border, no FX. Orders carry `marketCode` + a `Money` amount (`amount_minor` integer + `currency`).
- **If a commercial phase is approved, begin manual-first.** An admin would confirm an Order after
  the external payment lands. Automated gateway providers remain a separate **P4** decision behind
  the `PaymentProvider` interface.

## Order / Invoice

An **Order** is a _generic_ payment record for "something payable" — not coupled to any one entity:

| field                           | meaning                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `purpose`                       | `sponsorship` \| `hosted_challenge_fee` \| `prize_payout`; legacy `host_fee` is deprecated and must not be used |
| `referenceType` / `referenceId` | polymorphic link to what's paid (e.g. `sponsorship` / a sponsorship id — Sponsorship lands SP-001/P1-011)       |
| `amountMinor` + `currency`      | the `Money` value                                                                                               |
| `status`                        | `pending` → `paid` / `cancelled`; `paid` → `refunded`                                                           |
| `provider` / `providerRef`      | `manual` in an initial approved commercial phase; gateway + transaction reference only in a later approved P4   |

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

- **`ManualProvider`** is the retained future manual-first variant—no gateway and no separate dev
  variant. It is testable with real D1. `createManualProvider(createDb(env.DB))` per request (the
  #5323 discipline).
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

## Future P4 option: gateway providers

A gateway provider (e.g. BaridiMob) implements the same `PaymentProvider` interface: `initiate` opens a gateway session (returns the order with a `providerRef` + payment URL); a **webhook** calls `confirm` once the gateway reports success. `confirm` stays idempotent, so nothing else changes — NFR-10 (adding a market/provider touches no unrelated modules). `failed`/`disputed` statuses + payout automation land then.
