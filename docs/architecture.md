# Architecture Documentation

## Overview

Budget Copilot is built as a monorepo using Turborepo and pnpm workspaces, with a clear separation of concerns across packages and applications.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌────────────────┐              ┌─────────────────┐       │
│  │   Next.js Web  │              │  React Native   │       │
│  │   (Port 3000)  │              │  Mobile (TBD)   │       │
│  └────────┬───────┘              └────────┬────────┘       │
│           │                                │                 │
│           └────────────────┬───────────────┘                │
└────────────────────────────┼────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │  Fastify (4000) │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                     │
   ┌────▼─────┐       ┌─────▼──────┐      ┌──────▼─────┐
   │ Database │       │    Core     │      │ LLM Provider│
   │ (SQLite/ │       │   Domain    │      │  (OpenAI/   │
   │Postgres) │       │    Logic    │      │  Claude)    │
   └──────────┘       └─────────────┘      └────────────┘
```

## Monorepo Structure

### Apps (`apps/`)

#### Web App (`apps/web`)

- **Technology**: Next.js 14 with App Router
- **Purpose**: Primary user interface
- **Routes**:
  - `/` - Marketing landing page
  - `/dashboard` - Main application dashboard
  - `/transactions` - Transaction list (planned)
  - `/budgets` - Budget management (planned)
- **Features**:
  - Server-side rendering (SSR)
  - Client-side interactivity
  - Shared UI components from `@budget-copilot/ui`

#### API Service (`apps/api`)

- **Technology**: Fastify with TypeScript
- **Purpose**: RESTful API service
- **Endpoints**:
  - `GET /health` - Health check
  - `POST /v1/summarize-transactions` - AI-powered transaction summary
  - Additional CRUD endpoints (planned)
- **Features**:
  - Request validation with Zod
  - Database access via Drizzle ORM
  - AI provider integration
  - PII redaction

#### Mobile App (`apps/mobile`)

- **Status**: Placeholder
- **Technology**: React Native + Expo (planned)
- **Purpose**: Native mobile experience

### Packages (`packages/`)

#### UI Package (`packages/ui`)

- **Purpose**: Shared React components
- **Components**:
  - Button
  - Card
  - Table
  - TrendBadge
- **Technology**: React 18, Tailwind CSS
- **Export Strategy**: Named exports for tree-shaking

#### Core Package (`packages/core`)

- **Purpose**: Framework-agnostic domain logic
- **Modules**:
  - `categories.ts` - Category matching and rules
  - `envelopes.ts` - Envelope budgeting logic
  - `projections.ts` - Spending projections
  - `csv-parser.ts` - CSV import utilities
  - `types.ts` - Shared TypeScript types
- **Testing**: Vitest with 100% coverage goal
- **Principles**:
  - Pure functions
  - No framework dependencies
  - Fully tested business logic

#### AI Package (`packages/ai`)

- **Purpose**: LLM provider abstraction
- **Architecture**:
  ```
  LLMProvider (interface)
       ├── OpenAIProvider
       └── ClaudeProvider
  ```
- **Features**:
  - Provider-agnostic interface
  - Environment-based provider selection
  - PII redaction utilities
  - Usage tracking

#### Config Package (`packages/config`)

- **Purpose**: Shared configuration
- **Contents**:
  - `eslint-config.js` - ESLint rules
  - `prettier.config.cjs` - Prettier settings
  - `tsconfig.base.json` - TypeScript config
  - `tailwind.base.js` - Tailwind theme

## Data Flow

### Transaction Processing Flow

```
1. User uploads CSV
         ↓
2. CSV Parser (core) → Transaction objects
         ↓
3. Category Rules (core) → Auto-categorization
         ↓
4. Database (Drizzle) → Persistence
         ↓
5. AI Provider (ai) → Summary generation
         ↓
6. Response to UI
```

### Envelope Budgeting Flow

```
1. User defines budget envelopes
         ↓
2. Transactions assigned to envelopes
         ↓
3. Envelope calculations (core)
   - Current balance
   - Utilization percentage
   - Overspent detection
         ↓
4. Dashboard visualization (web)
```

## Database Schema

### Tables

#### transactions

- `id` - Unique identifier
- `date` - Transaction date
- `description` - Transaction description
- `amount` - Transaction amount (negative for expenses)
- `category_id` - Foreign key to categories
- `account_id` - Account identifier
- `metadata` - JSON metadata
- `created_at`, `updated_at` - Timestamps

#### categories

- `id` - Unique identifier
- `name` - Category name
- `type` - enum: income, expense, transfer
- `parent_id` - Self-reference for hierarchical categories
- `rules` - JSON array of matching rules
- `created_at` - Timestamp

#### budgets

- `id` - Unique identifier
- `name` - Budget name
- `start_date`, `end_date` - Budget period
- `created_at`, `updated_at` - Timestamps

#### envelopes

- `id` - Unique identifier
- `budget_id` - Foreign key to budgets
- `name` - Envelope name
- `budget_amount` - Allocated amount
- `current_amount` - Current balance
- `period` - enum: monthly, quarterly, annual
- `category_ids` - JSON array of category IDs
- `created_at` - Timestamp

## Security & Privacy

### PII Redaction

Before sending data to LLM providers:

1. **Redaction Rules** (in `packages/ai/redaction.ts`):
   - Credit card numbers → `[CARD]`
   - SSNs → `[SSN]`
   - Email addresses → `[EMAIL]`
   - Phone numbers → `[PHONE]`
   - IP addresses → `[IP]`

2. **Safe Summaries**:
   - Transaction IDs removed
   - Descriptions redacted
   - Only aggregated data sent

### Environment-Based Configuration

- **Local Development**: SQLite database
- **Production**: PostgreSQL database
- **AI Keys**: Environment variables only
- **CORS**: Configurable origin whitelist

## Build & Deployment

### Build Pipeline

```
1. TypeScript compilation
2. Dependency resolution (Turborepo)
3. Parallel builds:
   - packages/core
   - packages/ai
   - packages/ui
   - apps/api
   - apps/web
4. Artifact generation
```

### Deployment Options

#### Local (SQLite)

```bash
pnpm install
pnpm build
pnpm start
```

#### Docker (PostgreSQL)

```bash
docker-compose up -d
```

#### Cloud (Planned)

- **Web**: Vercel
- **API**: Railway/Fly.io
- **Database**: Managed PostgreSQL (RDS, Supabase)

## Testing Strategy

### Unit Tests

- **Location**: `packages/core/test/`
- **Framework**: Vitest
- **Coverage**: Business logic, calculations, utilities

### Integration Tests (Planned)

- API endpoint testing
- Database integration
- AI provider mocking

### E2E Tests (Planned)

- **Framework**: Playwright
- **Scope**: Critical user flows
- **Coverage**: Dashboard, transaction import

## Performance Considerations

### Frontend

- Next.js App Router for optimal loading
- Code splitting by route
- Image optimization
- Font optimization (Inter from Google Fonts)

### Backend

- Fastify for high performance
- Database connection pooling
- Query optimization with Drizzle
- Response caching (planned)

### AI

- Token usage tracking
- Rate limiting (planned)
- Fallback responses when AI unavailable

## Extension Points

### Adding a New AI Provider

1. Implement `LLMProvider` interface
2. Create adapter in `packages/ai/adapters/`
3. Update factory in `packages/ai/factory.ts`
4. Add environment variable
5. Update documentation

### Adding a New Transaction Source

1. Create parser in `packages/core/csv-parser.ts`
2. Add mapping configuration
3. Update API endpoint
4. Add UI for upload

### Adding a New Feature Module

1. Create domain logic in `packages/core`
2. Add database schema in `apps/api/src/db/schema.ts`
3. Create API routes in `apps/api/src/routes/`
4. Build UI in `apps/web/src/app/`
5. Add tests

## Future Architecture Considerations

- **Event Sourcing**: Track all budget changes
- **CQRS**: Separate read/write models
- **GraphQL**: Alternative to REST API
- **Microservices**: Split API into services
- **Real-time**: WebSockets for live updates
- **Offline-first**: Service workers, local storage

## References

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Fastify Best Practices](https://fastify.dev/docs/latest/)
- [Drizzle ORM](https://orm.drizzle.team/)
