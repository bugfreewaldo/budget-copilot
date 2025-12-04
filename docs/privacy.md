# Privacy & Data Handling Policy

## Overview

Budget Copilot takes user privacy seriously. This document outlines how we handle, store, and protect your financial data.

## Data Collection

### What We Collect

- **Transaction Data**: Date, description, amount, category
- **Budget Information**: Envelope names, allocated amounts, spending limits
- **Usage Metadata**: API requests, feature usage (for analytics)

### What We DON'T Collect

- ❌ Personally Identifiable Information (PII) sent to AI providers
- ❌ Bank account credentials
- ❌ Social Security Numbers
- ❌ Credit card numbers
- ❌ Passwords (if/when authentication is added)

## Data Storage

### Local Development

- **Database**: SQLite stored locally in `./data/budget.db`
- **Location**: Your local filesystem
- **Access**: Only accessible on your machine

### Production (If Self-Hosted)

- **Database**: PostgreSQL (your own instance)
- **Encryption**: Database-level encryption recommended
- **Backups**: Your responsibility

### Cloud Deployment (Future)

- **Database**: Managed PostgreSQL with encryption at rest
- **Backups**: Automatic encrypted backups
- **Region**: User-selectable data residency

## AI Processing & PII Redaction

### How It Works

Before sending transaction data to AI providers (OpenAI, Anthropic):

1. **Automatic PII Redaction**:
   ```typescript
   // Original
   "Payment to John Doe via john@email.com"

   // Redacted
   "Payment to John Doe via [EMAIL]"
   ```

2. **Redaction Rules** (see `packages/ai/redaction.ts`):
   - Credit card numbers → `[CARD]`
   - SSN patterns → `[SSN]`
   - Email addresses → `[EMAIL]`
   - Phone numbers → `[PHONE]`
   - IP addresses → `[IP]`

3. **Aggregated Summaries Only**:
   - Individual transaction IDs removed
   - Only category totals and patterns sent
   - No identifiable merchant information

### Example

**Original Transaction**:
```json
{
  "id": "txn_123",
  "date": "2024-01-15",
  "description": "Amazon purchase, card ending in 4242",
  "amount": -85.42,
  "metadata": {
    "email": "user@example.com",
    "ip": "192.168.1.1"
  }
}
```

**Sent to AI**:
```json
{
  "date": "2024-01-15",
  "description": "Amazon purchase, card ending in [CARD]",
  "amount": -85.42
}
```

### AI Provider Policies

We only use AI providers with strong privacy commitments:

- **OpenAI**: [Privacy Policy](https://openai.com/privacy)
  - Zero data retention option available
  - API data not used for training (as of Dec 2023)

- **Anthropic (Claude)**: [Privacy Policy](https://www.anthropic.com/privacy)
  - No data training on API inputs
  - Enterprise privacy standards

### Opt-Out

AI features are **optional**:

- App works fully without AI provider keys
- Fallback responses provided when AI unavailable
- No data sent to AI if keys not configured

## Data Sharing

### We Do NOT Share Data With:

- ❌ Third-party advertisers
- ❌ Data brokers
- ❌ Marketing companies
- ❌ Analytics providers (beyond anonymous usage stats)

### We MAY Share With (Future):

- ✅ Cloud infrastructure providers (AWS, GCP) - only if you deploy there
- ✅ AI providers (OpenAI, Anthropic) - only redacted summaries
- ✅ Error tracking services (Sentry) - only crash reports, no PII

## Data Retention

### Local/Self-Hosted

- **Your Control**: You own and control all data
- **Deletion**: Simply delete the database file
- **Retention**: Indefinite, at your discretion

### Cloud (Future)

- **Active Data**: Retained while account is active
- **After Deletion**: 30-day grace period, then permanent deletion
- **Backups**: Purged after 90 days

## User Rights

### You Have the Right To:

1. **Access**: Export all your data in JSON/CSV format
2. **Correction**: Edit or update any transaction or budget
3. **Deletion**: Delete individual transactions or entire account
4. **Portability**: Export data in standard formats
5. **Objection**: Opt out of AI features

### How to Exercise Rights:

- **Export Data**: (Feature planned) `Settings → Export Data`
- **Delete Data**:
  - Local: Delete `./data/budget.db`
  - Cloud: (Feature planned) `Settings → Delete Account`

## Security Measures

### In Transit

- **HTTPS**: All web traffic encrypted with TLS 1.3
- **API Requests**: Encrypted end-to-end
- **Database Connections**: TLS/SSL required for PostgreSQL

### At Rest

- **Database Encryption**: Recommended for production deployments
- **Environment Variables**: Never committed to version control
- **API Keys**: Stored securely in environment files

### Application Security

- **Input Validation**: Zod schemas for all API requests
- **SQL Injection**: Prevented by Drizzle ORM parameterization
- **XSS Protection**: React's built-in escaping
- **CSRF**: (Planned) Token-based protection

## Compliance

### Current Status

- ✅ Privacy-by-design architecture
- ✅ PII redaction before AI processing
- ✅ User data control (local-first option)
- 🔄 GDPR compliance (in progress)
- 🔄 CCPA compliance (in progress)

### Future Compliance Goals

- **GDPR** (EU): Right to access, portability, deletion
- **CCPA** (California): Consumer privacy rights
- **SOC 2** (Enterprise): Security and availability controls

## Open Source Transparency

Budget Copilot is open source, which means:

- 👁️ **Auditable Code**: Anyone can review our data handling
- 🔍 **No Hidden Tracking**: All data collection is visible in code
- 🤝 **Community Oversight**: Security researchers can report issues

## Incident Response

### In Case of a Data Breach:

1. **Immediate**: Contain and assess impact
2. **24 Hours**: Notify affected users
3. **72 Hours**: Report to relevant authorities (if required)
4. **Ongoing**: Publish post-mortem and prevention steps

### Reporting Security Issues:

- **Email**: security@budget-copilot.dev (planned)
- **GitHub**: Private security advisory
- **Response Time**: Within 48 hours

## Third-Party Services

### Current

| Service | Purpose | Data Shared | Privacy Policy |
|---------|---------|-------------|----------------|
| OpenAI | AI summaries | Redacted transactions | [Link](https://openai.com/privacy) |
| Anthropic | AI summaries | Redacted transactions | [Link](https://www.anthropic.com/privacy) |

### Future (Planned)

| Service | Purpose | Data Shared | Privacy Policy |
|---------|---------|-------------|----------------|
| Plaid | Bank connections | Read-only transaction data | [Link](https://plaid.com/legal/) |
| Sentry | Error tracking | Crash reports (no PII) | [Link](https://sentry.io/privacy/) |

## Children's Privacy

Budget Copilot is not intended for users under 13 years of age. We do not knowingly collect data from children.

## Changes to This Policy

- **Notification**: Users notified of material changes via email/app
- **Effective Date**: Changes take effect 30 days after notification
- **History**: Previous versions available in git history

## Contact

For privacy questions or concerns:

- **Email**: privacy@budget-copilot.dev (planned)
- **GitHub Issues**: Tag with `privacy` label
- **Mail**: (To be determined)

---

**Last Updated**: January 2024

**Version**: 1.0.0

This policy applies to Budget Copilot version 0.1.0 and later.
