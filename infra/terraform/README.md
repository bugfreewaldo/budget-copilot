# Terraform Infrastructure

Infrastructure as Code for deploying Budget Copilot to the cloud.

## Status

🚧 **Placeholder** - Terraform configurations will be added when cloud deployment is ready.

## Planned Cloud Providers

- AWS (primary target)
- Google Cloud Platform
- Azure
- Vercel (for Next.js web app)
- Railway/Fly.io (for API service)

## Planned Resources

### AWS Example

- VPC and networking
- RDS PostgreSQL instance
- ECS/Fargate for API containers
- S3 for file storage
- CloudFront for CDN
- Route53 for DNS
- ACM for SSL certificates

## Getting Started

_Instructions will be added when configurations are complete._

## Structure (Planned)

```
terraform/
├── modules/
│   ├── networking/
│   ├── database/
│   ├── compute/
│   └── storage/
├── environments/
│   ├── dev/
│   ├── staging/
│   └── production/
└── variables.tf
```

## Contributing

If you'd like to contribute Terraform configurations, please see the main [contributing guide](../../CONTRIBUTING.md).
