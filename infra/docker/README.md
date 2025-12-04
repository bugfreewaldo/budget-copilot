# Docker Infrastructure

Docker setup for Budget Copilot services.

## Services

- **postgres**: PostgreSQL 16 database
- **adminer**: Database management UI (http://localhost:8080)
- **api**: Fastify API service

## Quick Start

### Development Mode (SQLite)

Run the API service locally without Docker:

```bash
# From project root
pnpm dev
```

### Production Mode (PostgreSQL)

Start all services with PostgreSQL:

```bash
cd infra/docker
docker-compose up -d
```

Access points:

- API: http://localhost:4000
- Adminer: http://localhost:8080
- PostgreSQL: localhost:5432

### Development Mode with Docker

Run with hot-reload:

```bash
cd infra/docker
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Database Management

### Using Adminer

1. Navigate to http://localhost:8080
2. Login with:
   - System: PostgreSQL
   - Server: postgres
   - Username: budget_user
   - Password: budget_password
   - Database: budget_copilot

### Using psql

```bash
docker exec -it budget-copilot-db psql -U budget_user -d budget_copilot
```

## Switching Between SQLite and PostgreSQL

### Local Development (SQLite)

```env
DATABASE_URL=./data/budget.db
```

### Docker/Production (PostgreSQL)

```env
DATABASE_URL=postgresql://budget_user:budget_password@postgres:5432/budget_copilot
```

The app uses Drizzle ORM which supports both databases.

## Useful Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f api

# Rebuild API image
docker-compose build api

# Remove all data (including database)
docker-compose down -v
```

## Environment Variables

Copy `.env.example` to `.env` and customize as needed:

```bash
cp .env.example .env
```
