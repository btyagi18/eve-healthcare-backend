const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'EVE Healthcare Diagnostic Booking API',
      version: '1.1.0',
      description: 'Backend service for diagnostic test bookings and simulated payments.'
    },
    servers: [{ url: 'http://localhost:5000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        SignupRequest: {
          type: 'object', required: ['name', 'email', 'password'],
          properties: { name: { type: 'string', example: 'Bhumika' }, email: { type: 'string', example: 'bhumika@example.com' }, password: { type: 'string', minLength: 8, example: 'password123' } }
        },
        LoginRequest: {
          type: 'object', required: ['email', 'password'],
          properties: { email: { type: 'string', example: 'bhumika@example.com' }, password: { type: 'string', example: 'password123' } }
        },
        BookingRequest: {
          type: 'object', required: ['centreTestId', 'appointmentDate', 'appointmentTime'],
          properties: { centreTestId: { type: 'integer', example: 1 }, appointmentDate: { type: 'string', format: 'date', example: '2026-10-02' }, appointmentTime: { type: 'string', example: '10:30' } }
        },
        PaymentRequest: {
          type: 'object', required: ['bookingId'],
          properties: { bookingId: { type: 'integer', example: 1 }, simulateStatus: { type: 'string', enum: ['SUCCESS', 'FAILED'], example: 'SUCCESS' } }
        },
        WebhookRequest: {
          type: 'object', required: ['eventId', 'transactionId', 'bookingId', 'status'],
          properties: { eventId: { type: 'string', example: 'evt_123' }, transactionId: { type: 'string', example: 'TXN_abc123' }, bookingId: { type: 'integer', example: 1 }, status: { type: 'string', enum: ['SUCCESS', 'FAILED'], example: 'SUCCESS' } }
        }
      }
    }
  },
  apis: []
};

options.definition.paths = {
  '/health': { get: { summary: 'Health check', responses: { 200: { description: 'Service is healthy' } } } },
  '/auth/signup': { post: { summary: 'Create a user', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } } }, responses: { 201: { description: 'User created' }, 400: { description: 'Validation error' }, 409: { description: 'Duplicate email' } } } },
  '/auth/login': { post: { summary: 'Login and receive JWT', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } }, responses: { 200: { description: 'JWT returned' }, 401: { description: 'Invalid credentials' } } } },
  '/centres': {
    get: { summary: 'List diagnostic centres with available tests and prices', responses: { 200: { description: 'Centres returned' } } },
    post: { summary: 'Create a diagnostic centre', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'location'], properties: { name: { type: 'string' }, location: { type: 'string' } } } } } }, responses: { 201: { description: 'Created' }, 400: { description: 'Validation error' }, 401: { description: 'Unauthorized' } } }
  },
  '/centres/{id}': {
    get: { summary: 'Get a centre and its tests', parameters: [{ $ref: '#/components/parameters/id' }], responses: { 200: { description: 'Centre returned' }, 404: { description: 'Not found' } } },
    patch: { summary: 'Update a diagnostic centre', security: [{ bearerAuth: [] }], parameters: [{ $ref: '#/components/parameters/id' }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, location: { type: 'string' } } } } } }, responses: { 200: { description: 'Updated' }, 401: { description: 'Unauthorized' }, 404: { description: 'Not found' } } }
  },
  '/centres/{id}/tests': {
    get: { summary: 'List tests offered by a centre', parameters: [{ $ref: '#/components/parameters/id' }], responses: { 200: { description: 'Tests returned' }, 404: { description: 'Centre not found' } } },
    post: { summary: 'Offer a test at a centre with a price', security: [{ bearerAuth: [] }], parameters: [{ $ref: '#/components/parameters/id' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['testId', 'price'], properties: { testId: { type: 'integer', example: 1 }, price: { type: 'number', example: 500 } } } } } }, responses: { 201: { description: 'Mapping created' }, 409: { description: 'Already offered' } } }
  },
  '/centres/{id}/tests/{centreTestId}': { patch: { summary: 'Update a centre-specific test price', security: [{ bearerAuth: [] }], parameters: [{ $ref: '#/components/parameters/id' }, { name: 'centreTestId', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['price'], properties: { price: { type: 'number', example: 550 } } } } } }, responses: { 200: { description: 'Updated' }, 404: { description: 'Mapping not found' } } } },
  '/tests': {
    get: { summary: 'List diagnostic tests', responses: { 200: { description: 'Tests returned' } } },
    post: { summary: 'Create a diagnostic test', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } } } } } }, responses: { 201: { description: 'Created' }, 409: { description: 'Duplicate test' } } }
  },
  '/tests/{id}': { patch: { summary: 'Update a diagnostic test', security: [{ bearerAuth: [] }], parameters: [{ $ref: '#/components/parameters/id' }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } } } } }, responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } } } },
  '/bookings': {
    post: { summary: 'Create a diagnostic booking', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingRequest' } } } }, responses: { 201: { description: 'Booking created as PENDING' }, 400: { description: 'Validation error' }, 404: { description: 'Centre-test not found' } } },
    get: { summary: 'List current user bookings', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Bookings returned' } } }
  },
  '/bookings/{id}': { get: { summary: 'Get current user booking', security: [{ bearerAuth: [] }], parameters: [{ $ref: '#/components/parameters/id' }], responses: { 200: { description: 'Booking returned' }, 403: { description: 'Forbidden' }, 404: { description: 'Not found' } } } },
  '/bookings/{id}/cancel': { patch: { summary: 'Cancel a PENDING booking', security: [{ bearerAuth: [] }], parameters: [{ $ref: '#/components/parameters/id' }], responses: { 200: { description: 'Cancelled' }, 400: { description: 'Only PENDING bookings can be cancelled' }, 403: { description: 'Forbidden' } } } },
  '/payments': { post: { summary: 'Simulate a payment', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentRequest' } } } }, responses: { 201: { description: 'Payment processed' }, 400: { description: 'Invalid state' }, 403: { description: 'Forbidden' }, 409: { description: 'Duplicate payment' } } } },
  '/payments/{id}': { get: { summary: 'Get current user payment', security: [{ bearerAuth: [] }], parameters: [{ $ref: '#/components/parameters/id' }], responses: { 200: { description: 'Payment returned' }, 404: { description: 'Not found' } } } },
  '/payments/webhook': { post: { summary: 'Receive simulated provider payment webhook', description: 'Idempotent by eventId. Repeated identical events are acknowledged without creating a duplicate payment.', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookRequest' } } } }, responses: { 200: { description: 'Processed or already processed' }, 400: { description: 'Invalid webhook' }, 404: { description: 'Booking not found' }, 409: { description: 'Conflicting event or payment state' } } } }
};

options.definition.components.parameters = {
  id: { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
};

module.exports = swaggerJSDoc(options);
