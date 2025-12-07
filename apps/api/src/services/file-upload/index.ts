/**
 * File Upload Service
 *
 * Main entry point for the file upload and parsing subsystem.
 *
 * This service provides:
 * - Pre-signed URL generation for direct S3/R2 uploads
 * - File parsing (images, PDFs, Excel/CSV)
 * - Transaction extraction and import
 *
 * Architecture:
 * - storage.ts: S3/R2 storage helpers
 * - llm.ts: LLM abstractions (vision, text models)
 * - parseFile.ts: Main parsing orchestrator
 * - parsers/: Individual parser modules
 * - types.ts: Type definitions
 */

// Storage
export {
  generateUploadUrl,
  generateUploadUrls,
  getFileBuffer,
  getFileBase64,
  validateStorageKeyOwnership,
  generateStorageKey,
  isStorageConfigured,
  type UploadTarget,
} from './storage.js';

// Parsing
export { parseFile, reparseFile, isFileBeingParsed } from './parseFile.js';

// Types
export {
  type DocumentType,
  type ParsedSummary,
  type ParsedReceipt,
  type ParsedBankStatement,
  type ParsedTransactionRow,
  isReceipt,
  isBankStatement,
  validateParsedSummary,
  isAllowedMimeType,
  isImageMimeType,
  isPdfMimeType,
  isSpreadsheetMimeType,
  FILE_UPLOAD_CONFIG,
} from './types.js';

// LLM
export {
  callVisionModel,
  callTextModel,
  extractJsonFromResponse,
  safeParseJson,
} from './llm.js';

// Parsers
export { parseImageDocument } from './parsers/imageParser.js';
export { parsePdfDocument } from './parsers/pdfParser.js';
export { parseExcelDocument } from './parsers/excelParser.js';
