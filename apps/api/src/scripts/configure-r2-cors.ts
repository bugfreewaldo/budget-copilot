/**
 * Configure CORS on the Cloudflare R2 bucket
 * Run: cd apps/api && npx tsx --require dotenv/config src/scripts/configure-r2-cors.ts
 */

import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

async function main() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || 'auto';
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    console.error(
      'Missing required env vars: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY'
    );
    process.exit(1);
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: !!endpoint,
  });

  const corsRules = [
    {
      AllowedOrigins: [
        'http://localhost:3001',
        'http://localhost:3000',
        'https://budgetcopilot.app',
        'https://www.budgetcopilot.app',
      ],
      AllowedMethods: ['GET', 'PUT', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    },
  ];

  console.log(`Configuring CORS on bucket: ${bucket}`);
  console.log('Rules:', JSON.stringify(corsRules, null, 2));

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: corsRules },
    })
  );

  console.log('CORS configured successfully!');
}

main().catch((err) => {
  console.error('Failed to configure CORS:', err);
  process.exit(1);
});
