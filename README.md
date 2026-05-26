# 💳 Payment Processing System

A production-grade payment processing simulator built with **Node.js**, **TypeScript**, **Express**, **PostgreSQL**, **Redis**, and **BullMQ**. Demonstrates real-world payment gateway behavior with idempotency, retry logic, circuit breaking, webhook handling, and distributed concurrency control.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Request Flow](#request-flow)
- [API Routes](#api-routes)
- [Route → Controller → Service Architecture](#route--controller--service-architecture)
- [Payment State Machine](#payment-state-machine)
- [Core Patterns](#core-patterns)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Testing](#testing)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT REQUEST                              │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     EXPRESS MIDDLEWARE PIPELINE                       │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │  Helmet   │→│ Rate Limit │→│  Req Logger  │→│   Validator    │  │
│  └──────────┘  └────────────┘  └─────────────┘  └───────────────┘  │
│  ┌──────────────────┐                                               │
│  │  Idempotency MW   │  (POST routes only)                          │
│  └──────────────────┘                                               │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        ROUTE LAYER                                   │
│         Defines endpoints, attaches middleware chains                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐       │
│  │ payment.routes   │ │ webhook.routes   │ │  health.routes   │       │
│  └────────┬────────┘ └────────┬────────┘ └────────┬─────────┘       │
└───────────┼───────────────────┼───────────────────┼─────────────────┘
            │                   │                   │
            ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      CONTROLLER LAYER                                │
│          Thin layer — parses request, delegates, sends response       │
│  ┌─────────────────────┐ ┌──────────────────────┐ ┌──────────────┐  │
│  │ payment.controller   │ │ webhook.controller    │ │health.ctrl   │  │
│  └──────────┬──────────┘ └──────────┬───────────┘ └──────┬───────┘  │
└─────────────┼──────────────────────┼────────────────────┼───────────┘
              │                      │                    │
              ▼                      ▼                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                                  │
│          Core business logic, state management, orchestration         │
│  ┌─────────────────────┐ ┌──────────────────┐ ┌─────────────────┐   │
│  │  payment.service     │ │ webhook.service   │ │  retry.service  │   │
│  └──────────┬──────────┘ └──────────┬───────┘ └────────┬────────┘   │
└─────────────┼──────────────────────┼──────────────────┼─────────────┘
              │                      │                  │
              ▼                      ▼                  ▼
┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   GATEWAY SIMULATOR  │  │    POSTGRESQL     │  │       BullMQ         │
│   (External Provider)│  │   (via Prisma)    │  │    (Job Queue)       │
└─────────────────────┘  └──────────────────┘  └──────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       UTILITY LAYER                                  │
│  ┌────────────┐ ┌────────────────┐ ┌──────────┐ ┌───────────────┐   │
│  │   Logger    │ │ Circuit Breaker│ │  D-Lock  │ │    Errors     │   │
│  └────────────┘ └────────────────┘ └──────────┘ └───────────────┘   │
│  ┌────────────┐ ┌────────────────┐                                   │
│  │  Helpers    │ │   Constants    │                                   │
│  └────────────┘ └────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component       | Technology        | Purpose                                        |
|-----------------|-------------------|------------------------------------------------|
| Runtime         | Node.js 20+       | Server-side JavaScript runtime                 |
| Language        | TypeScript 5+     | Type safety and developer experience           |
| Framework       | Express.js        | HTTP server and middleware pipeline             |
| Database        | PostgreSQL 15+    | ACID-compliant persistent storage              |
| ORM             | Prisma            | Type-safe database access and migrations       |
| Cache / Locks   | Redis 7+          | Idempotency, distributed locks, rate limiting  |
| Job Queue       | BullMQ            | Reliable background job processing with retry  |
| Validation      | Zod               | Runtime request validation with TS inference   |
| Logging         | Winston           | Structured JSON logging                        |
| Testing         | Jest + Supertest  | Unit, integration, and API testing             |

---

## Project Structure

```
paymentSystem/
├── src/
│   ├── config/                     # ── Configuration Layer ──
│   │   ├── index.ts                #   Central config (env vars + Zod validation)
│   │   ├── database.ts             #   Prisma client singleton
│   │   ├── redis.ts                #   Redis (ioredis) client singleton
│   │   └── queue.ts                #   BullMQ queue factory
│   │
│   ├── routes/                     # ── Route Layer ──
│   │   ├── index.ts                #   Route aggregator (/api/v1/*)
│   │   ├── payment.routes.ts       #   Payment CRUD endpoints
│   │   ├── webhook.routes.ts       #   Webhook callback endpoint
│   │   └── health.routes.ts        #   Health check endpoint
│   │
│   ├── controllers/                # ── Controller Layer (Thin) ──
│   │   ├── payment.controller.ts   #   Parse request → call service → send response
│   │   ├── webhook.controller.ts   #   Extract payload → call service → ACK
│   │   └── health.controller.ts    #   Check service health → respond
│   │
│   ├── services/                   # ── Service Layer (Business Logic) ──
│   │   ├── payment.service.ts      #   Payment CRUD, processing, state transitions
│   │   ├── webhook.service.ts      #   Webhook verification, dedup, processing
│   │   └── retry.service.ts        #   Retry scheduling, backoff calculation
│   │
│   ├── gateway/                    # ── External Gateway Simulator ──
│   │   ├── gateway.simulator.ts    #   Simulates payment provider responses
│   │   └── gateway.types.ts        #   Gateway-specific type definitions
│   │
│   ├── queue/                      # ── Queue Layer (Background Jobs) ──
│   │   ├── payment.producer.ts     #   Enqueue payment & retry jobs
│   │   └── payment.worker.ts       #   Process & retry workers
│   │
│   ├── middleware/                  # ── Middleware Layer ──
│   │   ├── errorHandler.ts         #   Global error → JSON response mapping
│   │   ├── idempotency.ts          #   Idempotency-Key header enforcement
│   │   ├── rateLimiter.ts          #   Redis sliding-window rate limiting
│   │   ├── requestLogger.ts        #   Request/response logging + correlation ID
│   │   └── validator.ts            #   Zod schema validation factory
│   │
│   ├── utils/                      # ── Utility Layer ──
│   │   ├── logger.ts               #   Winston structured logger
│   │   ├── circuitBreaker.ts       #   Circuit breaker pattern (gateway protection)
│   │   ├── distributedLock.ts      #   Redis SET NX EX distributed locking
│   │   ├── errors.ts               #   Custom error classes (AppError hierarchy)
│   │   ├── constants.ts            #   Enums, state transitions, error codes
│   │   └── helpers.ts              #   UUID, hashing, backoff, signature utils
│   │
│   ├── types/                      # ── Type Definitions ──
│   │   └── index.ts                #   Shared TypeScript interfaces
│   │
│   ├── app.ts                      #   Express app setup + middleware wiring
│   └── server.ts                   #   Server entry point + graceful shutdown
│
├── prisma/
│   └── schema.prisma               #   Database schema definition
│
├── tests/
│   ├── unit/                       #   Unit tests (helpers, circuit breaker, gateway)
│   ├── integration/                #   Integration tests (payment flow, webhooks)
│   └── helpers/                    #   Test setup and utilities
│
├── .env.example                    #   Environment variable template
├── .eslintrc.js                    #   ESLint configuration
├── .prettierrc                     #   Prettier configuration
├── tsconfig.json                   #   TypeScript configuration
├── jest.config.ts                  #   Jest configuration
├── package.json                    #   Project dependencies and scripts
└── README.md                       #   This file
```

---

## Request Flow

### 1. Create Payment — `POST /api/v1/payments`

```
Client                                                                              
  │                                                                                 
  │  POST /api/v1/payments                                                          
  │  Headers: { Idempotency-Key: "abc-123" }                                        
  │  Body: { amount, currency, merchant_id, ... }                                   
  │                                                                                 
  ▼                                                                                 
┌─────────────────────── MIDDLEWARE PIPELINE ──────────────────────┐                 
│ 1. requestLogger  → Assign correlation ID, log request          │                 
│ 2. rateLimiter    → Check per-IP rate (Redis sliding window)    │                 
│ 3. validator      → Validate body against Zod schema            │                 
│ 4. idempotency    → Check Idempotency-Key:                      │                 
│                      • New key → mark "processing", continue    │                 
│                      • Completed key → return cached response   │                 
│                      • Processing key → return 409 Conflict     │                 
└──────────────────────────────┬──────────────────────────────────┘                 
                               │                                                    
                               ▼                                                    
┌─────────────── payment.controller.ts ───────────────────────────┐                 
│ initiatePayment(req, res, next)                                  │                 
│   → Extract validated body                                       │                 
│   → Call paymentService.createPayment(data)                      │                 
│   → Return 201 { payment }                                       │                 
└──────────────────────────────┬──────────────────────────────────┘                 
                               │                                                    
                               ▼                                                    
┌─────────────── payment.service.ts ──────────────────────────────┐                 
│ createPayment(data)                                              │                 
│   1. Create payment record (status: CREATED)     ──► PostgreSQL  │                 
│   2. Create PaymentEvent (audit)                 ──► PostgreSQL  │                 
│   3. Transition state → PENDING                                  │                 
│   4. Enqueue processing job                      ──► BullMQ      │                 
│   5. Return payment                                              │                 
└──────────────────────────────┬──────────────────────────────────┘                 
                               │                                                    
                               ▼  (async, via BullMQ worker)                        
┌─────────────── payment.worker.ts ───────────────────────────────┐                 
│ Process Job                                                      │                 
│   → Call paymentService.processPayment(paymentId)                │                 
└──────────────────────────────┬──────────────────────────────────┘                 
                               │                                                    
                               ▼                                                    
┌─────────────── payment.service.ts ──────────────────────────────┐                 
│ processPayment(paymentId)                                        │                 
│   1. Acquire distributed lock (Redis)                            │                 
│   2. Fetch payment, validate state                               │                 
│   3. Transition state → PROCESSING                               │                 
│   4. Call gateway via circuit breaker                             │                 
│      ┌────────────────────────────────────────┐                  │                 
│      │ circuitBreaker.execute(() =>           │                  │                 
│      │   gatewaySimulator.processPayment()    │                  │                 
│      │ )                                      │                  │                 
│      └────────────────────────────────────────┘                  │                 
│   5. Handle result:                                              │                 
│      • Success → transition to SUCCESS                           │                 
│      • Failure (retryable) → retryService.scheduleRetry()        │                 
│      • Failure (non-retryable) → PERMANENTLY_FAILED              │                 
│      • Timeout → retryService.scheduleRetry()                    │                 
│   6. Release distributed lock                                    │                 
└─────────────────────────────────────────────────────────────────┘                 
```

### 2. Get Payment — `GET /api/v1/payments/:id`

```
Client
  │
  │  GET /api/v1/payments/abc-123
  │
  ▼
requestLogger → rateLimiter
  │
  ▼
payment.controller.ts
  │  getPayment(req, res, next)
  │    → Extract req.params.id
  │    → Call paymentService.getPayment(id)
  │    → Return 200 { payment, events }
  │
  ▼
payment.service.ts
  │  getPayment(id)
  │    → Prisma findUnique with payment_events relation
  │    → Throw NotFoundError if null
  │    → Return payment with events
  ▼
PostgreSQL
```

### 3. Webhook Callback — `POST /api/v1/webhooks/gateway`

```
Gateway Simulator (async callback)
  │
  │  POST /api/v1/webhooks/gateway
  │  Headers: { X-Webhook-Signature: "sha256=..." }
  │  Body: { event_id, payment_id, status, timestamp, ... }
  │
  ▼
requestLogger
  │
  ▼
webhook.controller.ts
  │  handleGatewayWebhook(req, res, next)
  │    → Extract payload + signature header
  │    → Call webhookService.processWebhook(payload, signature)
  │    → Return 200 { received: true }
  │
  ▼
webhook.service.ts
  │  processWebhook(payload, signature)
  │    1. Verify HMAC-SHA256 signature         → Reject 401 if invalid
  │    2. Check event_id in webhook_events     → Skip if duplicate
  │    3. Acquire distributed lock on payment  → Prevent race condition
  │    4. Fetch payment, validate transition   → Reject if terminal state
  │    5. Update payment state (DB txn)        → PostgreSQL transaction
  │    6. Record webhook event (DB txn)        → Same transaction
  │    7. Release lock
  ▼
PostgreSQL + Redis
```

### 4. Retry Flow (Background)

```
retryService.scheduleRetry(paymentId, attempt)
  │
  │  1. Calculate backoff: min(1000 * 2^attempt + jitter, 30000)
  │  2. Transition payment → RETRY_SCHEDULED
  │  3. Enqueue retry job with delay ──► BullMQ
  │
  ▼  (after delay)
payment.worker.ts (retry worker)
  │
  │  1. Transition payment → PENDING
  │  2. Enqueue processing job ──► BullMQ
  │
  ▼
payment.worker.ts (process worker)
  │
  │  → paymentService.processPayment(paymentId)
  │  → (same flow as initial processing)
  │
  ▼
  • Success → terminal SUCCESS
  • Fail + retries remaining → another retry cycle
  • Fail + retries exhausted → PERMANENTLY_FAILED
```

---

## API Routes

### Payment Endpoints

| Method | Path                            | Controller Method      | Middleware                          | Description              |
|--------|---------------------------------|------------------------|-------------------------------------|--------------------------|
| POST   | `/api/v1/payments`              | `initiatePayment`      | `validator`, `idempotency`          | Create a new payment     |
| GET    | `/api/v1/payments/:id`          | `getPayment`           | —                                   | Get payment by ID        |
| GET    | `/api/v1/payments`              | `listPayments`         | —                                   | List payments (filtered) |
| POST   | `/api/v1/payments/:id/cancel`   | `cancelPayment`        | —                                   | Cancel pending payment   |

### Webhook Endpoints

| Method | Path                            | Controller Method        | Middleware | Description              |
|--------|---------------------------------|--------------------------|------------|--------------------------|
| POST   | `/api/v1/webhooks/gateway`      | `handleGatewayWebhook`   | —          | Receive gateway callback |

### System Endpoints

| Method | Path                            | Controller Method      | Middleware | Description              |
|--------|---------------------------------|------------------------|------------|--------------------------|
| GET    | `/api/v1/health`                | `healthCheck`          | —          | Service health status    |

---

## Route → Controller → Service Architecture

The application follows strict **separation of concerns** with three distinct layers:

### Layer Responsibilities

```
┌────────────────────────────────────────────────────────────────┐
│                        ROUTES                                   │
│  Responsibility: Define endpoints, attach middleware chains     │
│  Contains: HTTP method, path, middleware array, controller ref  │
│  Does NOT contain: Any logic, validation rules, DB access       │
├────────────────────────────────────────────────────────────────┤
│                      CONTROLLERS                                │
│  Responsibility: Parse request, call service, format response   │
│  Contains: req/res handling, HTTP status codes, error passing   │
│  Does NOT contain: Business logic, DB queries, state logic      │
├────────────────────────────────────────────────────────────────┤
│                       SERVICES                                  │
│  Responsibility: Business logic, state management, coordination │
│  Contains: Validation logic, DB transactions, gateway calls,    │
│            state transitions, event creation, retry scheduling  │
│  Does NOT contain: req/res objects, HTTP concerns                │
├────────────────────────────────────────────────────────────────┤
│                        UTILS                                    │
│  Responsibility: Shared, stateless helper functions             │
│  Contains: Logging, hashing, locking, circuit breaker,          │
│            error classes, constants, ID generation               │
│  Does NOT contain: Business logic, request handling              │
└────────────────────────────────────────────────────────────────┘
```

### Example: Create Payment

```typescript
// ─── routes/payment.routes.ts ───
// Only wiring — no logic
router.post('/',
  validate(createPaymentSchema),   // middleware
  idempotency,                     // middleware
  paymentController.initiatePayment // controller
);

// ─── controllers/payment.controller.ts ───
// Thin layer — parse, delegate, respond
async initiatePayment(req, res, next) {
  try {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    next(error);  // delegate to error handler middleware
  }
}

// ─── services/payment.service.ts ───
// All business logic lives here
async createPayment(data: CreatePaymentRequest) {
  // 1. Create payment record in DB (CREATED state)
  // 2. Log PaymentEvent for audit trail
  // 3. Validate and transition state → PENDING
  // 4. Enqueue for background processing via BullMQ
  // 5. Return payment response
}

// ─── utils/helpers.ts ───
// Pure, reusable utilities
function isValidStateTransition(from: Status, to: Status): boolean { ... }
function calculateBackoffDelay(attempt: number): number { ... }
function generateId(): string { ... }
```

---

## Payment State Machine

```
                ┌──────────────────────────────────────────┐
                │                                          │
   CREATED ──► PENDING ──► PROCESSING ──► SUCCESS          │
                │              │                           │
                │              ▼                           │
                │           FAILED ──► RETRY_SCHEDULED ────┘
                │              │
                │              ▼
                │         PERMANENTLY_FAILED
                │
                ▼
            CANCELLED
```

### Valid Transitions

| From              | To                          | Trigger                                  |
|-------------------|-----------------------------|------------------------------------------|
| CREATED           | PENDING                     | Payment enqueued for processing          |
| CREATED           | CANCELLED                   | Manual cancellation                      |
| PENDING           | PROCESSING                  | Worker picks up job                      |
| PENDING           | CANCELLED                   | Manual cancellation                      |
| PROCESSING        | SUCCESS                     | Gateway returns success                  |
| PROCESSING        | FAILED                      | Gateway returns failure/timeout          |
| FAILED            | RETRY_SCHEDULED             | Retryable error + retries remaining      |
| FAILED            | PERMANENTLY_FAILED          | Non-retryable error or max retries       |
| RETRY_SCHEDULED   | PENDING                     | Retry delay elapsed, re-enqueued         |

### Terminal States
- **SUCCESS** — Payment completed successfully
- **PERMANENTLY_FAILED** — All retries exhausted or non-retryable error
- **CANCELLED** — Manually cancelled before processing

---

## Core Patterns

### Idempotency
- Client sends `Idempotency-Key` header
- Redis (fast lookup) + PostgreSQL (durability)
- Duplicate requests return cached response, never create duplicate payments

### Distributed Locking
- Redis `SET key token NX EX ttl` for mutual exclusion
- Lua script for safe release (compare-and-delete)
- Prevents parallel processing of the same payment

### Circuit Breaker
- Protects against cascading gateway failures
- States: CLOSED → OPEN → HALF_OPEN → CLOSED
- When open, payments queue for retry instead of hitting the gateway

### Exponential Backoff
- `delay = min(baseDelay × 2^attempt + jitter, maxDelay)`
- Prevents thundering herd on gateway recovery
- Configurable base delay, max delay, and jitter

---

## Database Schema

### Entity Relationship

```
┌──────────────────┐       ┌───────────────────┐       ┌──────────────────┐
│    payments       │       │  payment_events    │       │  webhook_events   │
├──────────────────┤       ├───────────────────┤       ├──────────────────┤
│ id (PK)          │◄──┐   │ id (PK)           │       │ id (PK)          │
│ amount           │   │   │ payment_id (FK)   │───┐   │ payment_id (FK)  │──┐
│ currency         │   │   │ from_status       │   │   │ event_id (unique)│  │
│ status           │   │   │ to_status         │   │   │ event_type       │  │
│ merchant_id      │   │   │ event_type        │   │   │ payload (JSONB)  │  │
│ customer_email   │   │   │ event_data (JSONB)│   │   │ signature        │  │
│ idempotency_key  │   │   │ created_at        │   │   │ status           │  │
│ retry_count      │   │   └───────────────────┘   │   │ created_at       │  │
│ version          │   │                           │   └──────────────────┘  │
│ error_code       │   └───────────────────────────┘                        │
│ metadata (JSONB) │                                                        │
│ created_at       │◄──────────────────────────────────────────────────────┘
│ updated_at       │
└──────────────────┘

┌──────────────────┐
│ idempotency_keys │
├──────────────────┤
│ id (PK)          │
│ key (unique)     │
│ request_path     │
│ request_body_hash│
│ response_code    │
│ response_body    │
│ status           │
│ expires_at       │
│ created_at       │
└──────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd paymentSystem

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database and Redis credentials

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### Available Scripts

| Script            | Command                | Description                          |
|-------------------|------------------------|--------------------------------------|
| `dev`             | `tsx watch src/server.ts` | Start dev server with hot reload  |
| `build`           | `tsc`                  | Compile TypeScript                   |
| `start`           | `node dist/server.js`  | Start production server              |
| `test`            | `jest`                 | Run all tests                        |
| `test:watch`      | `jest --watch`         | Run tests in watch mode              |
| `test:coverage`   | `jest --coverage`      | Run tests with coverage report       |
| `lint`            | `eslint src/`          | Lint source files                    |
| `format`          | `prettier --write src/`| Format source files                  |
| `db:migrate`      | `prisma migrate dev`   | Run database migrations              |
| `db:generate`     | `prisma generate`      | Generate Prisma client               |
| `db:studio`       | `prisma studio`        | Open Prisma Studio GUI               |

---

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payment_system

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Queue
QUEUE_CONCURRENCY=5

# Payment
MAX_RETRIES=3
RETRY_BASE_DELAY_MS=1000
RETRY_MAX_DELAY_MS=30000
LOCK_TTL_MS=30000
IDEMPOTENCY_TTL_HOURS=24

# Gateway
GATEWAY_TIMEOUT_MS=10000
WEBHOOK_SECRET=your-webhook-secret-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --testPathPattern=payment.service

# Run in watch mode
npm run test:watch
```

### Test Coverage Areas

| Area                  | Type         | What's Tested                                      |
|-----------------------|--------------|----------------------------------------------------|
| Helper Functions      | Unit         | Backoff calculation, state transitions, hashing     |
| Circuit Breaker       | Unit         | State transitions, threshold triggers, reset timer  |
| Gateway Simulator     | Unit         | Response distribution, timeout, error handling      |
| Payment Service       | Unit         | CRUD, state machine, optimistic locking             |
| Payment Lifecycle     | Integration  | Full create → process → success/fail flow           |
| Retry Flow            | Integration  | Retry scheduling, backoff, max retry exhaustion     |
| Idempotency           | Integration  | Duplicate handling, concurrent request safety       |
| Webhook Processing    | Integration  | Signature verification, dedup, state updates        |

---

## License

MIT
