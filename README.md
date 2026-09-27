
# 🏥 EVE Healthcare — Diagnostic Booking Backend

> **SDE Intern Hiring Assignment**
>
> A production-minded REST API for diagnostic-centre discovery, test booking, simulated payments, and reliable payment-webhook processing.

---

## 🚀 Overview

**EVE Healthcare** is a backend service for a diagnostic booking platform that manages the complete lifecycle of a diagnostic appointment — from user authentication and test discovery to booking, payment processing, and webhook reconciliation.

The project focuses on practical backend engineering principles such as:

- 🔐 JWT-based authentication & authorization
- 🏥 Diagnostic-centre and test management
- 💰 Centre-specific test pricing
- 📅 Authenticated diagnostic-test bookings
- 💳 Simulated payment processing
- 🔁 Idempotent payment webhooks
- 🛡️ Ownership and access-control checks
- 🗄️ PostgreSQL transactions and row locking
- 🧪 Automated testing with Jest & Supertest
- 📖 Swagger/OpenAPI documentation
- 🐳 Docker and Docker Compose support

The implementation intentionally stays compact while prioritizing clean API boundaries, relational data modelling, validation, authorization, transactional consistency, and payment/webhook edge cases.

---

## 🧰 Tech Stack

| Category | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL |
| Authentication | JWT + bcryptjs |
| API Documentation | Swagger / OpenAPI |
| Testing | Jest + Supertest |
| Containerization | Docker + Docker Compose |
| API Testing | Postman / Swagger UI |

---

## 🏗️ Architecture

-
              ┌──────────────────────────┐
              │   Client / Postman /      │
              │       Swagger UI          │
              └────────────┬─────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │       Express API        │
              └────────────┬─────────────┘
                           │
              ┌────────────┴─────────────┐
              │                          │
              ▼                          ▼
       Controllers + Auth         Payment Service
              │                          │
              └────────────┬─────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │       PostgreSQL         │
              └──────────────────────────┘


### 💳 Payment Flow


Create Booking
      │
      ▼
   PENDING
      │
      ▼
POST /payments
      │
      ├───────────────┐
      ▼               ▼
   SUCCESS           FAILED
      │               │
      ▼               ▼
 CONFIRMED          FAILED
      │
      ▼
POST /payments/webhook
      │
      ▼
   eventId check
      │
   ┌──┴───────────────┐
   │                  │
Existing event      New event
   │                  │
   ▼                  ▼
Duplicate         Process once


---

## 🗃️ Database Design

The application uses PostgreSQL with a relational model designed around users, diagnostic centres, tests, centre-specific pricing, bookings, and payments.

### Core Tables

| Table | Purpose |
|---|---|
| users | Stores authenticated users |
| diagnostic_centres | Stores diagnostic-centre names and locations |
| tests | Stores reusable diagnostic test definitions |
| centre_tests | Maps tests to centres with centre-specific pricing |
| bookings | Stores appointment and booking information |
| payments | Stores payment information and webhook idempotency data |

### Relationships


users 1 ───────── N bookings N ───────── 1 centre_tests
                                      /          \
                                     /            \
                                    ▼              ▼
                         diagnostic_centres      tests

bookings 1 ───────── 1 payments


### Booking States

-
             ┌───────────────┐
             │    PENDING    │
             └───────┬───────┘
                     │
            ┌────────┴────────┐
            ▼                 ▼
       CONFIRMED           FAILED

            PENDING
                │
                ▼
           CANCELLED


---

## 🔐 Authentication & Authorization

Authentication is implemented using **JWT**, while passwords are protected using **bcryptjs**.

### Signup

```http
POST /auth/signup
```

```json
{
  "name": "Bhumika",
  "email": "bhumika@example.com",
  "password": "password123"
}
```

### Login

```http
POST /auth/login
```

```json
{
  "email": "bhumika@example.com",
  "password": "password123"
}
```

The returned JWT is used with:

```http
Authorization: Bearer <token>
```

Protected booking and payment endpoints verify that the authenticated user owns the relevant booking.

---

## 💰 Server-Controlled Pricing

The client does **not** provide the booking amount.

Instead, the client sends only the selected `centreTestId`:

```json
{
  "centreTestId": 1
}
```

The server:

1. Finds the selected centre-test mapping.
2. Reads the actual price from PostgreSQL.
3. Stores that price in the booking.

This prevents clients from manipulating the booking amount.

---

# 📡 API Endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|:---:|---|
| GET | `/health` | — | Health check |
| POST | `/auth/signup` | — | Create user |
| POST | `/auth/login` | — | Login + JWT |
| GET | `/centres` | — | List centres |
| GET | `/centres/:id` | — | Get centre details |
| POST | `/centres` | JWT | Create centre |
| PATCH | `/centres/:id` | JWT | Update centre |
| GET | `/centres/:id/tests` | — | List centre tests |
| POST | `/centres/:id/tests` | JWT | Add test to centre |
| PATCH | `/centres/:id/tests/:centreTestId` | JWT | Update test price |
| GET | `/tests` | — | List tests |
| POST | `/tests` | JWT | Create test |
| PATCH | `/tests/:id` | JWT | Update test |
| POST | `/bookings` | JWT | Create booking |
| GET | `/bookings` | JWT | Get user's bookings |
| GET | `/bookings/:id` | JWT | Get user's booking |
| PATCH | `/bookings/:id/cancel` | JWT | Cancel booking |
| POST | `/payments` | JWT | Simulate payment |
| GET | `/payments/:id` | JWT | Get user's payment |
| POST | `/payments/webhook` | — | Process payment webhook |
| GET | `/docs` | — | Swagger UI |

---

## 📅 Booking Example

### Request

```http
POST /bookings
Authorization: Bearer <token>
```

```json
{
  "centreTestId": 1,
  "appointmentDate": "2026-10-02",
  "appointmentTime": "10:30"
}
```

A newly created booking starts with:

```text
PENDING
```

The server calculates the actual amount using the selected centre-test mapping.

Date and time values are also validated before creating the booking.

---

# 💳 Simulated Payment

The project includes deterministic payment simulation so both success and failure scenarios can be tested easily.

### Successful Payment

```http
POST /payments
Authorization: Bearer <token>
```

```json
{
  "bookingId": 1,
  "simulateStatus": "SUCCESS"
}
```

### Failed Payment

```json
{
  "bookingId": 2,
  "simulateStatus": "FAILED"
}
```

### Payment State Transition

```text
SUCCESS  →  Payment SUCCESS  →  Booking CONFIRMED

FAILED   →  Payment FAILED   →  Booking FAILED
```

A second payment attempt for the same booking is rejected.

---

# 🔁 Webhook Idempotency

Payment webhooks are designed to safely handle repeated provider events.

### Request

http
POST /payments/webhook

json
{
  "eventId": "evt_123",
  "transactionId": "TXN_abc123",
  "bookingId": 1,
  "status": "SUCCESS"
}


### Behaviour

| Scenario | Result |
|---|---|
| First delivery | Event is processed |
| Exact repeated event | Returns `duplicate: true` |
| Same event ID + different payment data | Returns `409` |
| New event for pending booking | Payment + booking updated atomically |
| SUCCESS → FAILED conflict | Rejected |
| FAILED → SUCCESS conflict | Rejected |

`eventId` acts as the idempotency key and is protected using a database `UNIQUE` constraint.

Payment reconciliation uses PostgreSQL transactions and row locking to maintain consistent booking/payment states.

> In a real payment-provider integration, webhook signature verification would also be added.

---

# 🛡️ Validation & Edge Cases

The API handles a wide range of invalid and conflicting scenarios:

- Invalid signup fields → `400`
- Duplicate email → `409`
- Invalid credentials → `401`
- Missing/invalid JWT → `401`
- Unknown booking → `404`
- Accessing another user's booking → `403`
- Paying for another user's booking → `403`
- Paying for a non-pending booking → `400`
- Duplicate payment → `409`
- Cancelling a non-pending booking → `400`
- Invalid appointment date/time → `400`
- Invalid webhook payload → `400`
- Repeated webhook event → Idempotent
- Conflicting webhook event → `409`
- Unknown webhook booking → `404`
- Transaction mismatch → `409`
- Conflicting payment state transition → `409`
- Duplicate centre-test mapping → `409`
- Invalid centre/test IDs → `404`

---

# 🧪 Testing

The project uses:


Jest + Supertest


### Test Coverage

- Request validation
- Authentication guards
- Payment state transitions
- Webhook idempotency
- Conflicting webhook events
- Payment authorization
- Booking protection
- End-to-end PostgreSQL lifecycle

### Current Test Result


Test Suites: 6 passed, 6 total
Tests:       21 passed, 21 total
Snapshots:   0 total


### Run Tests


npm test


---

## PostgreSQL Integration Tests

Integration tests run when TEST_DATABASE_URL is provided.

### Windows PowerShell


$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eve_healthcare_test"
npm test


The end-to-end lifecycle covers:

Signup
   ↓
Login
   ↓
Create Booking
   ↓
Payment
   ↓
Webhook
   ↓
Booking Status Update

---

# 🚀 Getting Started

## Prerequisites

Make sure you have:

- Node.js
- npm
- PostgreSQL

---

## 1. Clone the Repository


git clone https://github.com/btyagi18/eve-healthcare-backend.git
cd eve-healthcare-backend


---

## 2. Install Dependencies


npm install


---

## 3. Configure Environment Variables

Create a `.env` file based on `.env.example`.

Example:


DATABASE_URL=postgresql://username:password@localhost:5432/eve_healthcare
JWT_SECRET=your_jwt_secret
PORT=5000


> ⚠️ Never commit real secrets or credentials to GitHub.

---

## 4. Setup Database


npm run db:setup


This creates the required database structure and seed data.

---

## 5. Start the Server


npm run dev


API:


http://localhost:5000


Swagger UI:


http://localhost:5000/docs

---

# 🐳 Docker Setup

The project also supports Docker Compose.

### Build & Start


docker compose up --build


### Initialize Database


docker compose exec api node src/config/setupDb.js


---

# 📁 Project Structure


eve-healthcare-backend/
│
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── app.js
│   ├── server.js
│   └── swagger.js
│
├── sql/
│   ├── schema.sql
│   └── seed.sql
│
├── tests/
│   ├── auth.test.js
│   ├── booking.test.js
│   ├── integration.test.js
│   ├── payment.test.js
│   ├── paymentService.test.js
│   ├── setup.js
│   └── validation.test.js
│
├── API_EXAMPLES.md
├── PROJECT_NOTES.md
├── Dockerfile
├── docker-compose.yml
├── jest.config.js
├── package.json
├── .env.example
└── .gitignore



---

# 📚 Documentation

| File / Resource | Description |
|---|---|
| `README.md` | Project overview and setup |
| `API_EXAMPLES.md` | API request examples |
| `PROJECT_NOTES.md` | Design and implementation notes |
| `/docs` | Interactive Swagger/OpenAPI documentation |

---

# 📌 Assumptions

1. A booking has one payment record in this simulated assignment.
2. Payment simulation uses deterministic `SUCCESS` and `FAILED` states.
3. The authenticated user represents the patient associated with the booking.
4. Centre-specific pricing is stored in `centre_tests`.
5. Webhook events are uniquely identified using `eventId`.
6. Real webhook signature verification is outside the assignment scope.
7. Appointment-slot capacity rules are not defined by the assignment.

---

# 🔮 Future Improvements

With more development time, the following could be added:

- Redis caching
- Background job processing
- Structured logging
- Request IDs
- Rate limiting
- Retry/dead-letter handling for webhooks
- Real payment-provider signature verification
- Secret rotation
- Appointment-slot capacity management
- Availability locking
- CI/CD pipeline for tests and Docker builds

---

# 🎯 Assignment Focus

This project was developed as part of the **EVE Healthcare SDE Intern Hiring Assignment**.

Rather than maximizing feature count, the implementation focuses on:

Correctness
    +
Security
    +
Database Consistency
    +
Authorization
    +
Payment Reliability
    +
Webhook Idempotency
    +
Automated Testing
    +
Documentation

---

## 👩‍💻 Author

**Bhumika Tyagi**

---

## 🔗 Repository

**GitHub:**  
https://github.com/btyagi18/eve-healthcare-backend

---

### ⭐ Built with Node.js, Express.js & PostgreSQL
```
