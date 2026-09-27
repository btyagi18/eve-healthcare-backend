# Interview / Project Notes

## Core story

The project models a diagnostic booking lifecycle:

`User -> Centre/Test -> Booking(PENDING) -> Payment -> CONFIRMED/FAILED`

The webhook represents a simulated external payment provider and is deliberately idempotent.

## Important design decisions

### 1. PostgreSQL
A relational database fits the entities and foreign-key relationships. It also gives us unique constraints and transactions for payment consistency.

### 2. Centre-specific pricing
A test can have a different price at different centres, so price lives in `centre_tests`, not in the global `tests` table.

### 3. Server-controlled amount
The booking endpoint accepts `centreTestId`, not an amount. The backend reads the authoritative price from PostgreSQL.

### 4. One payment per booking
`payments.booking_id` is unique. This protects the business rule at the database layer as well as in application code.

### 5. Webhook idempotency
`payments.event_id` is unique. The service checks the event before processing and also handles the database uniqueness race. A repeated identical event is acknowledged without creating another payment.

### 6. State consistency
Payment and booking updates are handled inside a PostgreSQL transaction. A booking row is locked while its payment state is reconciled. Conflicting webhook states return `409` rather than silently moving a booking backwards.

## Main edge cases to demonstrate in an interview

1. Another user tries to pay for your booking → `403`.
2. Unknown booking → `404`.
3. Payment for a confirmed/failed/cancelled booking → `400`.
4. Same webhook twice → second response has `duplicate: true`.
5. Same event ID with different data → `409`.
6. Different transaction ID for an existing payment → `409`.
7. Invalid appointment date/time → `400`.
8. Duplicate centre/test mapping → `409`.

## Manual demo order

1. Signup
2. Login
3. `GET /centres`
4. Create booking
5. Confirm it is `PENDING`
6. Mock payment `SUCCESS`
7. Confirm booking is `CONFIRMED`
8. Create another booking
9. Send webhook once
10. Send the exact webhook again and show `duplicate: true`
11. Reuse the same event ID with conflicting status and show `409`
12. Try accessing another user's booking and show `403`

## Interview explanation

If asked why the project is not over-engineered:

> The assignment emphasizes engineering thinking and explicitly says a smaller, well-designed and tested solution is preferable to a large codebase with poor structure. I therefore prioritized the required lifecycle, database constraints, authorization, transactions, idempotency and tests before optional infrastructure.
