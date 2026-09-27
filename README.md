# EVE Healthcare — Diagnostic Booking Backend

Backend implementation for the EVE Healthcare SDE Intern Hiring Assignment.

## 1. Overview

This service provides:

- User signup/login with JWT authentication
- Diagnostic centre and test management
- Centre-specific test pricing
- Authenticated diagnostic-test bookings
- Booking states: `PENDING`, `CONFIRMED`, `FAILED`, `CANCELLED`
- Simulated payment processing with `SUCCESS` and `FAILED` outcomes
- Idempotent payment webhooks
- Authorization checks so users cannot access or pay for another user's booking
- PostgreSQL transactions and row locking around payment state changes
- Jest + Supertest tests, including optional PostgreSQL integration tests
- Swagger/OpenAPI documentation
- Docker/Docker Compose setup

The implementation intentionally stays small while focusing on clean API boundaries, relational data modelling, validation, authorization, transactions, and payment/webhook edge cases.

## 2. Tech Stack

- Node.js + Express.js
- PostgreSQL
- JWT + bcryptjs
- Jest + Supertest
- Swagger/OpenAPI
- Docker / Docker Compose

## 3. Architecture

```text
Client / Postman / Swagger
            |
            v
       Express API
            |
     Controllers + Auth
            |
      Payment Service
            |
       PostgreSQL
```

Payment flow:

```text
Create booking (PENDING)
        |
        v
POST /payments
        |
   SUCCESS / FAILED
     |          |
 CONFIRMED    FAILED
        |
        v
POST /payments/webhook
        |
     eventId check
     /          \
 existing      new
   duplicate     |
     ignore    process once
```

## 4. Database Schema

### users
Stores authenticated users. Email is unique and passwords are stored as bcrypt hashes.

### diagnostic_centres
Stores centre name and location.

### tests
Stores reusable diagnostic test definitions.

### centre_tests
Many-to-many mapping between centres and tests, including the price charged by each centre for a test.

### bookings
Stores the patient/user, selected centre-test, appointment date/time, server-derived amount and booking status.

### payments
Stores one payment record per booking. `booking_id` is unique so a booking cannot have multiple payment records. `event_id` is unique and is the idempotency key for provider webhook events.

Relationships:

```text
users 1 ───── N bookings N ───── 1 centre_tests
                                  /       \
                                 /         \
                       diagnostic_centres tests

bookings 1 ───── 1 payments
```

## 5. Why the amount is server-controlled

The client sends only `centreTestId` when creating a booking. The API reads the price from `centre_tests` and stores that value in the booking. The client cannot override the amount.

## 6. Authentication

### Signup
`POST /auth/signup`

```json
{
  "name": "Bhumika",
  "email": "bhumika@example.com",
  "password": "password123"
}
```

### Login
`POST /auth/login`

```json
{
  "email": "bhumika@example.com",
  "password": "password123"
}
```

Use the returned JWT as:

```text
Authorization: Bearer <token>
```

## 7. API Endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Health check |
| POST | `/auth/signup` | No | Create user |
| POST | `/auth/login` | No | Login + JWT |
| GET | `/centres` | No | List centres with available tests/prices |
| GET | `/centres/:id` | No | Get centre with available tests/prices |
| POST | `/centres` | JWT | Create centre |
| PATCH | `/centres/:id` | JWT | Update centre |
| GET | `/centres/:id/tests` | No | List tests offered by centre |
| POST | `/centres/:id/tests` | JWT | Offer a test at a centre with price |
| PATCH | `/centres/:id/tests/:centreTestId` | JWT | Update centre-specific test price |
| GET | `/tests` | No | List tests |
| POST | `/tests` | JWT | Create test |
| PATCH | `/tests/:id` | JWT | Update test |
| POST | `/bookings` | JWT | Create booking |
| GET | `/bookings` | JWT | Current user's bookings |
| GET | `/bookings/:id` | JWT | Current user's booking |
| PATCH | `/bookings/:id/cancel` | JWT | Cancel pending booking |
| POST | `/payments` | JWT | Simulate payment |
| GET | `/payments/:id` | JWT | Get current user's payment |
| POST | `/payments/webhook` | No* | Provider payment-status webhook |
| GET | `/docs` | No | Swagger UI |

`*` In a real payment-provider integration, webhook signature verification should be added. This assignment uses a simulated provider, so the endpoint focuses on validation, consistency, and idempotency.

## 8. Booking Example

`POST /bookings`

```json
{
  "centreTestId": 1,
  "appointmentDate": "2026-10-02",
  "appointmentTime": "10:30"
}
```

The server looks up the actual price for `centreTestId`; the client cannot override the amount.

New bookings start as `PENDING`.

The API validates the date and time ranges rather than accepting only a loose string pattern.

## 9. Simulated Payment

`POST /payments`

```json
{
  "bookingId": 1,
  "simulateStatus": "SUCCESS"
}
```

For a failure scenario:

```json
{
  "bookingId": 2,
  "simulateStatus": "FAILED"
}
```

A successful payment changes the booking to `CONFIRMED`. A failed payment changes it to `FAILED`. A second payment attempt for the same booking is rejected.

## 10. Webhook Idempotency

`POST /payments/webhook`

```json
{
  "eventId": "evt_123",
  "transactionId": "TXN_abc123",
  "bookingId": 1,
  "status": "SUCCESS"
}
```

The webhook uses `eventId` as an idempotency key and stores it under a database `UNIQUE` constraint.

- First delivery: process once.
- Exact repeated delivery: return `duplicate: true` without creating another payment.
- Same event ID with different booking/transaction/status data: return `409` instead of silently accepting inconsistent data.
- New webhook for a pending booking creates the payment and updates the booking atomically.
- A webhook cannot move a confirmed success payment to failed or a failed payment to success.

The payment service uses a PostgreSQL transaction and row locking while reconciling payment and booking state.

## 11. Edge Cases Covered

- Missing/invalid signup fields → `400`
- Duplicate email → `409`
- Invalid credentials → `401`
- Missing/invalid JWT → `401`
- Unknown booking → `404`
- Accessing another user's booking → `403`
- Paying for another user's booking → `403`
- Paying for a non-pending booking → `400`
- Duplicate payment attempt → `409`
- Cancelling a non-pending booking → `400`
- Invalid date/time values → `400`
- Missing/invalid webhook fields → `400`
- Repeated webhook event → idempotent
- Same webhook event ID with conflicting data → `409`
- Unknown webhook booking → `404`
- Transaction mismatch during webhook reconciliation → `409`
- Conflicting payment/webhook state transition → `409`
- Duplicate centre-test mapping → `409`
- Invalid test/centre IDs → `404`

## 12. Local Setup

### Option A — Local PostgreSQL

1. Install PostgreSQL.
2. Create database `eve_healthcare`.
3. Copy `.env.example` to `.env` and update `DATABASE_URL` and `JWT_SECRET`.
4. Install packages:

```bash
npm install
```

5. Create schema and seed data:

```bash
npm run db:setup
```

6. Start:

```bash
npm run dev
```

API: `http://localhost:5000`

Swagger: `http://localhost:5000/docs`

### Option B — Docker Compose

```bash
docker compose up --build
```

Then initialize the database:

```bash
docker compose exec api node src/config/setupDb.js
```

## 13. Testing

The repository includes:

- Request validation tests
- Authentication guard tests
- Payment state-transition unit tests
- Webhook idempotency/conflict tests
- Optional end-to-end PostgreSQL tests covering signup → login → booking → payment → webhook

Run the default test suite:

```bash
npm test
```

The PostgreSQL integration suite runs automatically when `TEST_DATABASE_URL` is provided. Example:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eve_healthcare_test npm test
```

For Windows PowerShell:

```powershell
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eve_healthcare_test"
npm test
```

## 14. Assumptions

1. A booking has one payment record in this simulated assignment.
2. Payment simulation is deterministic through `simulateStatus` so reviewers can test both success and failure branches.
3. The authenticated user is the patient represented by `user_id`.
4. Centre-specific pricing is represented by `centre_tests`.
5. Webhook events are uniquely identified by `eventId`.
6. Webhook signature verification is outside the assignment scope because the provider is simulated.
7. Appointment slot capacity/availability is not specified by the assignment, so the service does not invent a slot-capacity rule.

## 15. What I Would Improve With More Time

- Redis caching for centre/test reads
- Background jobs with Celery-equivalent Node tooling if asynchronous processing is required
- Structured logging and request IDs
- Rate limiting
- Retry/dead-letter handling for external webhook delivery
- Real provider signature verification and secret rotation
- Appointment-slot capacity rules and availability locking
- CI pipeline for linting, tests and Docker builds

## 16. Submission Notes

The assignment values engineering thinking over feature count. The implementation therefore prioritizes correctness of the required booking/payment lifecycle, database constraints, authorization, idempotency, tests and documentation before optional infrastructure features.
