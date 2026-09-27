# API Examples

Base URL: `http://localhost:5000`

## 1. Signup

```http
POST /auth/signup
Content-Type: application/json

{
  "name": "Bhumika",
  "email": "bhumika@example.com",
  "password": "password123"
}
```

## 2. Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "bhumika@example.com",
  "password": "password123"
}
```

Copy the returned JWT and use:

```text
Authorization: Bearer <token>
```

## 3. View centres and available tests

```http
GET /centres
```

## 4. Add a test to a centre

```http
POST /centres/1/tests
Authorization: Bearer <token>
Content-Type: application/json

{
  "testId": 1,
  "price": 500
}
```

## 5. Create booking

```http
POST /bookings
Authorization: Bearer <token>
Content-Type: application/json

{
  "centreTestId": 1,
  "appointmentDate": "2026-10-02",
  "appointmentTime": "10:30"
}
```

The server reads the price from the database and creates the booking as `PENDING`.

## 6. Simulate successful payment

```http
POST /payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookingId": 1,
  "simulateStatus": "SUCCESS"
}
```

Result: payment `SUCCESS`, booking `CONFIRMED`.

## 7. Simulate failed payment

```http
POST /payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookingId": 2,
  "simulateStatus": "FAILED"
}
```

Result: payment `FAILED`, booking `FAILED`.

## 8. Webhook

```http
POST /payments/webhook
Content-Type: application/json

{
  "eventId": "evt_123",
  "transactionId": "TXN_abc123",
  "bookingId": 3,
  "status": "SUCCESS"
}
```

Send the exact same request again. The second response contains `duplicate: true` and does not create another payment.

If the same `eventId` is reused with different booking/transaction/status data, the API returns `409` instead of silently accepting inconsistent data.
