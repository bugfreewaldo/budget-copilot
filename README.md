# Budget Copilot

<div align="center">

**AI-Powered Budget Management & Financial Insights**

[![CI Status](https://img.shields.io/github/workflow/status/yourusername/budget-copilot/CI?label=CI&logo=github)](https://github.com/yourusername/budget-copilot/actions)
[![License](https://img.shields.io/badge/license-TBD-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange?logo=pnpm)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-latest-red?logo=turborepo)](https://turbo.build/repo)

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Overview

Budget Copilot is an intelligent budget tracking application that combines envelope budgeting with AI-powered insights. Track your spending, categorize transactions automatically, and get personalized financial recommendations—all while keeping your data private and secure.

### Key Highlights

- 🤖 **AI-Powered Insights** - Get intelligent spending analysis and recommendations
- 📊 **Envelope Budgeting** - Allocate funds to digital envelopes and track in real-time
- 🔒 **Privacy-First** - PII redaction before AI processing, local-first data storage
- 🎨 **Modern Stack** - Next.js 14, TypeScript, Tailwind CSS, Fastify
- 📦 **Monorepo** - Clean architecture with Turborepo and pnpm workspaces
- 🐳 **Docker Ready** - Easy deployment with Docker Compose
- 🌐 **Cloud Ready** - SQLite for local dev, PostgreSQL for production

---

## Features

### Current (MVP)

- ✅ Transaction import from CSV
- ✅ Automatic transaction categorization
- ✅ Envelope budgeting system
- ✅ Monthly variance analysis
- ✅ Spending projections
- ✅ AI-powered transaction summaries
- ✅ Dashboard with budget overview

### Planned (Beta)

- 🔄 Bank account integration (Plaid)
- 📱 Mobile app (React Native/Expo)
- 📧 Budget alerts and notifications
- 📈 Advanced analytics and charts
- 🎯 Goal tracking
- 👥 Multi-user support

See the full [roadmap](docs/roadmap.md) for details.

---

## Architecture

This is a TypeScript monorepo built with:

```
budget-copilot/
├── apps/
│   ├── web/         # Next.js 14 web app
│   ├── api/         # Fastify API service
│   └── mobile/      # React Native app (planned)
├── packages/
│   ├── ui/          # Shared React components
│   ├── core/        # Domain logic (framework-agnostic)
│   ├── ai/          # LLM provider adapters
│   └── config/      # Shared configs (ESLint, Prettier, etc.)
├── infra/
│   ├── docker/      # Docker Compose setup
│   └── terraform/   # IaC (planned)
└── docs/            # Documentation
```

For more details, see [Architecture Documentation](docs/architecture.md).

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20.0.0
- [pnpm](https://pnpm.io/) ≥ 8.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/budget-copilot.git
cd budget-copilot

# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env

# (Optional) Add your OpenAI or Anthropic API key to apps/api/.env
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...

# Run database migrations
pnpm --filter api db:migrate

# Seed sample data (optional, creates 1 account, 3 categories, envelopes & transactions)
pnpm --filter api db:seed
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Or run specific apps
pnpm --filter api dev    # API on http://localhost:4000
pnpm --filter web dev    # Web app on http://localhost:3000

# Or use shortcuts
pnpm api:dev    # API on http://localhost:4000
pnpm web:dev    # Web app on http://localhost:3000
```

**API Endpoints**: [http://localhost:4000/health](http://localhost:4000/health)
**Web App**: [http://localhost:3000](http://localhost:3000)

### Building

```bash
# Build all packages and apps
pnpm build

# Run production build
cd apps/web && pnpm start
cd apps/api && pnpm start
```

### Docker

```bash
# Start with PostgreSQL
cd infra/docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Project Structure

| Package/App | Description | Tech Stack |
|------------|-------------|------------|
| `apps/web` | Next.js web application | Next.js 14, React 18, Tailwind CSS |
| `apps/api` | Fastify REST API | Fastify, Drizzle ORM, Zod |
| `apps/mobile` | Mobile app (planned) | React Native, Expo |
| `packages/ui` | Shared UI components | React, Tailwind CSS |
| `packages/core` | Domain logic | Pure TypeScript, Vitest |
| `packages/ai` | LLM provider adapters | OpenAI SDK, Anthropic SDK |
| `packages/config` | Shared configs | ESLint, Prettier, TypeScript |

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `pnpm format` | Format code with Prettier |
| `pnpm web:dev` | Run web app only |
| `pnpm api:dev` | Run API service only |

---

## Documentation

- [Architecture](docs/architecture.md) - System design and data flow
- [Privacy Policy](docs/privacy.md) - Data handling and PII redaction
- [Roadmap](docs/roadmap.md) - Feature timeline and milestones
- [Docker Setup](infra/docker/README.md) - Docker deployment guide

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Run tests and linting (`pnpm test && pnpm lint`)
5. Commit using conventional commits (`git commit -m 'feat: add amazing feature'`)
6. Push to your fork (`git push origin feat/amazing-feature`)
7. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

---

## Tech Stack

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS 3.4
- **UI Components**: Custom component library
- **State**: React Hooks

### Backend

- **Framework**: Fastify 4
- **Language**: TypeScript 5.3
- **ORM**: Drizzle ORM
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Validation**: Zod

### AI/ML

- **Providers**: OpenAI, Anthropic (Claude)
- **Features**: Transaction summarization, spending insights
- **Privacy**: PII redaction before API calls

### DevOps

- **Monorepo**: Turborepo + pnpm workspaces
- **CI/CD**: GitHub Actions
- **Containers**: Docker, Docker Compose
- **IaC**: Terraform (planned)
- **Linting**: ESLint, Prettier
- **Git Hooks**: Husky, lint-staged, commitlint

---

## License

License TBD - This project is currently private.

---

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Turborepo](https://turbo.build/repo)
- [Tailwind CSS](https://tailwindcss.com/)
- [Fastify](https://fastify.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)

---

<div align="center">

**[⬆ Back to Top](#budget-copilot)**

Made with ❤️ using TypeScript and modern web technologies

**Project Maintainer**: PhD. Osvaldo Restrepo
**Email**: me@osvaldorestrepo.dev
**Website**: https://osvaldorestrepo.dev

</div>
