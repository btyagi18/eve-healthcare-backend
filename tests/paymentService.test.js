const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

jest.mock('../src/config/db', () => ({
  connect: jest.fn(async () => mockClient)
}));

const {
  processMockPayment,
  processWebhook,
  paymentBookingStatus
} = require('../src/services/paymentService');

const db = require('../src/config/db');

beforeEach(() => {
  mockClient.query.mockReset();
  mockClient.release.mockReset();
  jest.clearAllMocks();
});

describe('Payment state transitions', () => {
  test('maps SUCCESS to CONFIRMED and FAILED to FAILED', () => {
    expect(paymentBookingStatus('SUCCESS')).toBe('CONFIRMED');
    expect(paymentBookingStatus('FAILED')).toBe('FAILED');
  });

  test('mock payment success creates payment and confirms booking', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 10,
            user_id: 1,
            amount: '500.00',
            status: 'PENDING'
          }
        ]
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 55,
            booking_id: 10,
            transaction_id: 'TXN_test',
            status: 'SUCCESS',
            amount: '500.00'
          }
        ]
      })
      .mockResolvedValueOnce({}) // update booking
      .mockResolvedValueOnce({}); // COMMIT

    const result = await processMockPayment({
      bookingId: 10,
      requestedStatus: 'SUCCESS'
    });

    expect(result.status).toBe('SUCCESS');

    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2',
      ['CONFIRMED', 10]
    );

    expect(mockClient.release).toHaveBeenCalled();
  });

  test('same webhook event is idempotent', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 55,
            booking_id: 10,
            transaction_id: 'TXN_test',
            status: 'SUCCESS'
          }
        ]
      })
      .mockResolvedValueOnce({}); // COMMIT

    const result = await processWebhook({
      eventId: 'evt_1',
      transactionId: 'TXN_test',
      bookingId: 10,
      status: 'SUCCESS'
    });

    expect(result.duplicate).toBe(true);

    expect(mockClient.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payments'),
      expect.anything()
    );
  });

  test('same event id with different payment data is rejected', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 55,
            booking_id: 10,
            transaction_id: 'TXN_test',
            status: 'SUCCESS'
          }
        ]
      })
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(
      processWebhook({
        eventId: 'evt_1',
        transactionId: 'TXN_other',
        bookingId: 10,
        status: 'FAILED'
      })
    ).rejects.toMatchObject({
      status: 409
    });
  });

  test('new webhook for a pending booking creates payment and updates booking', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      }) // duplicate event
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 10,
            amount: '500.00',
            status: 'PENDING'
          }
        ]
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      }) // existing payment
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 55,
            booking_id: 10,
            transaction_id: 'TXN_test',
            event_id: 'evt_2',
            status: 'SUCCESS',
            amount: '500.00'
          }
        ]
      })
      .mockResolvedValueOnce({}) // update booking
      .mockResolvedValueOnce({}); // COMMIT

    const result = await processWebhook({
      eventId: 'evt_2',
      transactionId: 'TXN_test',
      bookingId: 10,
      status: 'SUCCESS'
    });

    expect(result.duplicate).toBe(false);

    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2',
      ['CONFIRMED', 10]
    );
  });

  test('conflicting webhook status cannot change an existing payment', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      }) // no duplicate event
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 10,
            amount: '500.00',
            status: 'CONFIRMED'
          }
        ]
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 55,
            booking_id: 10,
            transaction_id: 'TXN_test',
            event_id: null,
            status: 'SUCCESS',
            amount: '500.00'
          }
        ]
      })
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(
      processWebhook({
        eventId: 'evt_3',
        transactionId: 'TXN_test',
        bookingId: 10,
        status: 'FAILED'
      })
    ).rejects.toMatchObject({
      status: 409
    });
  });
});