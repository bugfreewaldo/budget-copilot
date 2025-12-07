/**
 * S3/R2 Storage Service
 *
 * Handles pre-signed URL generation and file retrieval from S3-compatible storage.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';

interface StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function getStorageConfig(): StorageConfig {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || 'auto';
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is required');
  }
  if (!accessKeyId) {
    throw new Error('S3_ACCESS_KEY_ID environment variable is required');
  }
  if (!secretAccessKey) {
    throw new Error('S3_SECRET_ACCESS_KEY environment variable is required');
  }

  return {
    bucket,
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
  };
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const config = getStorageConfig();

  s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: !!config.endpoint,
  });

  return s3Client;
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, '_')
    .replace(/\0/g, '')
    .replace(/\.\./g, '_')
    .slice(0, 200);
}

export function generateStorageKey(userId: string, filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const timestamp = Date.now();
  const uniqueId = nanoid(8);

  return `users/${userId}/uploads/${timestamp}_${uniqueId}_${sanitized}`;
}

export function validateStorageKeyOwnership(
  storageKey: string,
  userId: string
): boolean {
  const expectedPrefix = `users/${userId}/uploads/`;
  return storageKey.startsWith(expectedPrefix);
}

export interface UploadTarget {
  fileIndex: number;
  storageKey: string;
  uploadUrl: string;
  mimeType: string;
  originalName: string;
  size: number;
}

interface GenerateUploadUrlInput {
  userId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  fileIndex: number;
}

export async function generateUploadUrl(
  input: GenerateUploadUrlInput
): Promise<UploadTarget> {
  const config = getStorageConfig();
  const client = getS3Client();

  const storageKey = generateStorageKey(input.userId, input.filename);

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ContentType: input.mimeType,
    ContentLength: input.sizeBytes,
    Metadata: {
      'user-id': input.userId,
      'original-name': input.filename,
    },
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

  return {
    fileIndex: input.fileIndex,
    storageKey,
    uploadUrl,
    mimeType: input.mimeType,
    originalName: input.filename,
    size: input.sizeBytes,
  };
}

export async function generateUploadUrls(
  userId: string,
  files: Array<{ name: string; type: string; size: number }>
): Promise<UploadTarget[]> {
  const results = await Promise.all(
    files.map((file, index) =>
      generateUploadUrl({
        userId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        fileIndex: index,
      })
    )
  );

  return results;
}

export async function getFileBuffer(storageKey: string): Promise<Buffer> {
  const config = getStorageConfig();
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`File not found: ${storageKey}`);
  }

  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function getFileBase64(storageKey: string): Promise<string> {
  const buffer = await getFileBuffer(storageKey);
  return buffer.toString('base64');
}

export function isStorageConfigured(): boolean {
  try {
    getStorageConfig();
    return true;
  } catch {
    return false;
  }
}
