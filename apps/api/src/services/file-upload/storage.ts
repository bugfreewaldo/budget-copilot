/**
 * S3/R2 Storage Service
 *
 * Handles pre-signed URL generation and file retrieval from S3-compatible storage.
 * Supports AWS S3, Cloudflare R2, MinIO, and other S3-compatible services.
 *
 * Security considerations:
 * - Pre-signed URLs have short expiration (15 minutes for upload)
 * - Storage keys are namespaced by userId to prevent cross-user access
 * - File names are sanitized to prevent path traversal
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';

// ============================================================================
// Configuration
// ============================================================================

interface StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string; // For R2 or custom S3-compatible endpoints
  accessKeyId: string;
  secretAccessKey: string;
}

function getStorageConfig(): StorageConfig {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || 'auto';
  const endpoint = process.env.S3_ENDPOINT; // e.g., https://<account>.r2.cloudflarestorage.com
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
    // Required for R2 compatibility
    forcePathStyle: !!config.endpoint,
  });

  return s3Client;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sanitize filename to prevent path traversal and other issues
 * - Removes directory separators
 * - Removes null bytes
 * - Limits length
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, '_') // Replace path separators
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\.\./g, '_') // Remove path traversal
    .slice(0, 200); // Limit length
}

/**
 * Generate a unique storage key for a file
 * Format: users/{userId}/uploads/{timestamp}_{uniqueId}_{sanitizedFilename}
 */
export function generateStorageKey(userId: string, filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const timestamp = Date.now();
  const uniqueId = nanoid(8);

  return `users/${userId}/uploads/${timestamp}_${uniqueId}_${sanitized}`;
}

/**
 * Validate that a storage key belongs to a user
 * Prevents accessing other users' files
 */
export function validateStorageKeyOwnership(
  storageKey: string,
  userId: string
): boolean {
  const expectedPrefix = `users/${userId}/uploads/`;
  return storageKey.startsWith(expectedPrefix);
}

// ============================================================================
// Pre-signed URL Generation
// ============================================================================

export interface UploadTarget {
  /** Original index from the request */
  fileIndex: number;
  /** The storage key (S3 object key) */
  storageKey: string;
  /** Pre-signed URL for direct upload */
  uploadUrl: string;
  /** MIME type */
  mimeType: string;
  /** Original filename */
  originalName: string;
  /** File size in bytes */
  size: number;
}

interface GenerateUploadUrlInput {
  userId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  fileIndex: number;
}

/**
 * Generate a pre-signed URL for uploading a file directly to S3/R2
 * The URL expires after 15 minutes
 */
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
    // Add metadata to track the upload
    Metadata: {
      'user-id': input.userId,
      'original-name': input.filename,
    },
  });

  // Pre-signed URLs expire after 15 minutes
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

/**
 * Generate pre-signed URLs for multiple files
 */
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

// ============================================================================
// File Retrieval
// ============================================================================

/**
 * Get a file's contents from S3/R2 as a Buffer
 * Used by parsers to read uploaded files
 */
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

  // Convert the readable stream to a buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Get a file's contents as a base64 string
 * Useful for sending images to vision models
 */
export async function getFileBase64(storageKey: string): Promise<string> {
  const buffer = await getFileBuffer(storageKey);
  return buffer.toString('base64');
}

/**
 * Check if storage is configured
 * Returns false if required environment variables are missing
 */
export function isStorageConfigured(): boolean {
  try {
    getStorageConfig();
    return true;
  } catch {
    return false;
  }
}
