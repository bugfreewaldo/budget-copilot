# Contributing to Budget Copilot

First off, thank you for considering contributing to Budget Copilot! It's people like you that make Budget Copilot such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you are creating a bug report, please include as many details as possible using our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

**Good Bug Reports** include:

- A clear and descriptive title
- Exact steps to reproduce the problem
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Node version, browser, etc.)

### Suggesting Features

Feature suggestions are tracked as GitHub issues. When creating a feature request, use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

- A clear use case
- Why this feature would be useful
- Possible implementation approach
- Examples from other apps (if applicable)

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** if you've added code that should be tested
4. **Update documentation** if you've changed APIs or functionality
5. **Ensure tests pass** (`pnpm test`)
6. **Lint your code** (`pnpm lint`)
7. **Format your code** (`pnpm format`)
8. **Write a good commit message** following [Conventional Commits](https://www.conventionalcommits.org/)

## Development Setup

### Prerequisites

- Node.js ≥ 20.0.0
- pnpm ≥ 8.0.0
- Git

### Initial Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/budget-copilot.git
cd budget-copilot

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL-OWNER/budget-copilot.git

# Install dependencies
pnpm install

# Copy environment files
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env

# Start development
pnpm dev
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm --filter @budget-copilot/core test:watch

# Run tests with coverage
pnpm --filter @budget-copilot/core test:coverage
```

### Linting and Formatting

```bash
# Lint all packages
pnpm lint

# Format all files
pnpm format

# Check formatting without making changes
pnpm format:check
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types (use `unknown` if needed)
- Document complex functions with JSDoc comments

### Code Style

We use ESLint and Prettier to maintain consistent code style:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Line length**: 80 characters (soft limit)

### Naming Conventions

- **Files**: kebab-case (`transaction-service.ts`)
- **Components**: PascalCase (`TransactionList.tsx`)
- **Functions**: camelCase (`calculateBalance()`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with "I" prefix optional (`Transaction` or `ITransaction`)

### Project Structure

When adding new features:

- **Domain logic** → `packages/core`
- **UI components** → `packages/ui`
- **AI features** → `packages/ai`
- **API routes** → `apps/api/src/routes`
- **Web pages** → `apps/web/src/app`

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding/updating tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes

### Examples

```bash
feat(ui): add TrendBadge component

Add a new badge component to display spending trends with
up/down/flat indicators.

Closes #123
```

```bash
fix(api): resolve transaction import validation error

The CSV parser was failing on empty category fields.
Now handles optional categories gracefully.

Fixes #456
```

## Branch Naming

- **Feature**: `feat/short-description`
- **Bug fix**: `fix/short-description`
- **Documentation**: `docs/short-description`
- **Refactor**: `refactor/short-description`

Examples:
- `feat/plaid-integration`
- `fix/envelope-calculation`
- `docs/api-endpoints`

## Pull Request Process

1. **Update your fork**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feat/my-feature
   ```

3. **Make your changes** and commit:
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feat/my-feature
   ```

5. **Open a Pull Request** on GitHub

6. **Address review feedback**:
   ```bash
   # Make changes
   git add .
   git commit --amend
   git push --force-with-lease
   ```

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-reviewed my own code
- [ ] Commented hard-to-understand areas
- [ ] Updated documentation
- [ ] Added tests for new features
- [ ] All tests pass locally
- [ ] No new warnings introduced

## Testing Guidelines

### Unit Tests

- Test business logic in `packages/core`
- Use Vitest for testing
- Aim for >80% coverage
- Test edge cases and error conditions

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateEnvelopeBalance } from '../src/envelopes';

describe('calculateEnvelopeBalance', () => {
  it('should calculate balance correctly', () => {
    const envelope = { budgetAmount: 500, /* ... */ };
    const transactions = [/* ... */];

    const balance = calculateEnvelopeBalance(envelope, transactions);

    expect(balance).toBe(350);
  });
});
```

### Integration Tests

- Test API endpoints
- Test database interactions
- Mock external services (AI providers)

### E2E Tests (Planned)

- Test critical user flows
- Use Playwright
- Run in CI/CD

## Documentation

### Code Comments

- Comment **why**, not **what**
- Use JSDoc for public APIs
- Keep comments up to date

Example:
```typescript
/**
 * Calculate the balance remaining in an envelope after transactions
 *
 * @param envelope - The budget envelope
 * @param transactions - Transactions to apply
 * @returns Remaining balance (positive) or overspend (negative)
 */
export function calculateEnvelopeBalance(
  envelope: Envelope,
  transactions: Transaction[]
): number {
  // Implementation
}
```

### Documentation Files

- Update `README.md` for user-facing changes
- Update `docs/architecture.md` for architectural changes
- Update `docs/privacy.md` for data handling changes
- Update `docs/roadmap.md` for new features

## Release Process

(Maintained by core team)

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag
4. Create GitHub release
5. Deploy to production

## Getting Help

- 💬 **Questions**: Open a [Discussion](https://github.com/OWNER/budget-copilot/discussions)
- 🐛 **Bugs**: Open an [Issue](https://github.com/OWNER/budget-copilot/issues)
- 💡 **Ideas**: Open a [Feature Request](https://github.com/OWNER/budget-copilot/issues/new?template=feature_request.md)

## Recognition

Contributors will be recognized in:
- `CONTRIBUTORS.md`
- GitHub Contributors page
- Release notes for significant contributions

---

Thank you for contributing to Budget Copilot! 🎉
