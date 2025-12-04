/**
 * Document Parser Service
 *
 * Handles parsing of screenshots, PDFs, and receipts from Panama banks.
 * Uses AI (Claude) to extract transaction data from images and documents.
 *
 * This is the core differentiator - Panama banks don't expose APIs,
 * so this service enables users to upload screenshots and have them
 * automatically parsed into transactions.
 */

import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { documents, transactionInbox } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { NewDocument, NewTransactionInboxItem } from '../../db/schema.js';

// Types for extracted data
export interface ExtractedTransaction {
  date?: string; // ISO date
  description: string;
  amount: number; // In cents, negative for expenses
  merchant?: string;
  category?: string; // AI-suggested category name
  confidence: number; // 0-1
}

export interface ExtractedBalance {
  accountName?: string;
  balance: number; // In cents
  balanceType: 'available' | 'current' | 'credit_limit' | 'minimum_payment';
  asOfDate?: string;
}

export interface ExtractionResult {
  transactions: ExtractedTransaction[];
  balances: ExtractedBalance[];
  rawText?: string;
  documentType: 'bank_statement' | 'credit_card' | 'receipt' | 'screenshot' | 'unknown';
  bankName?: string;
  accountNumber?: string; // Last 4 digits only for privacy
  statementPeriod?: {
    start: string;
    end: string;
  };
  confidence: number; // Overall extraction confidence
}

// Prompt templates for AI extraction
const EXTRACTION_PROMPT = `You are a financial document parser specialized in extracting transaction data from Panama bank screenshots and statements.

Analyze the provided image and extract ALL financial information you can find.

IMPORTANT GUIDELINES:
1. Extract EVERY transaction visible, including pending ones
2. Convert amounts to cents (multiply by 100)
3. Expenses should be NEGATIVE amounts
4. Income/deposits should be POSITIVE amounts
5. Dates should be in ISO format (YYYY-MM-DD)
6. Extract merchant names as cleanly as possible (remove POS codes, terminal IDs)
7. Look for: transactions, balances, due dates, minimum payments, credit limits

COMMON PANAMA BANKS to recognize:
- Banco General
- Banistmo
- BAC Credomatic
- Multibank
- Global Bank
- Banco Nacional de Panama
- Caja de Ahorros

Return your response as a JSON object with this structure:
{
  "documentType": "bank_statement" | "credit_card" | "receipt" | "screenshot" | "unknown",
  "bankName": "string or null",
  "accountNumber": "last 4 digits or null",
  "statementPeriod": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } | null,
  "transactions": [
    {
      "date": "YYYY-MM-DD or null if not visible",
      "description": "cleaned description",
      "amount": number (in cents, negative for expenses),
      "merchant": "merchant name or null",
      "category": "suggested category or null",
      "confidence": 0.0 to 1.0
    }
  ],
  "balances": [
    {
      "accountName": "string or null",
      "balance": number (in cents),
      "balanceType": "available" | "current" | "credit_limit" | "minimum_payment",
      "asOfDate": "YYYY-MM-DD or null"
    }
  ],
  "confidence": 0.0 to 1.0 (overall extraction confidence)
}

Be thorough - extract everything visible. If you can't read something clearly, make your best guess and lower the confidence score.`;

/**
 * Parse a document (image or PDF) and extract financial data
 */
export async function parseDocument(
  filePath: string,
  sourceType: NewDocument['sourceType'],
  mimeType: string,
  fileName: string,
  fileSizeBytes?: number
): Promise<{ documentId: string; inboxItems: number }> {
  const db = await getDb();
  const documentId = nanoid();
  const now = Date.now();

  // Create document record
  await db.insert(documents).values({
    id: documentId,
    fileName,
    mimeType,
    filePath,
    fileSizeBytes,
    status: 'processing',
    sourceType,
    createdAt: now,
  });

  try {
    // Extract data using AI
    const extractionResult = await extractDataFromDocument(filePath, mimeType);

    // Store extraction results
    await db
      .update(documents)
      .set({
        status: 'completed',
        extractedData: JSON.stringify(extractionResult),
        extractionConfidence: extractionResult.confidence,
        processedAt: Date.now(),
      })
      .where(eq(documents.id, documentId));

    // Create inbox items for each extracted transaction
    let inboxItemsCreated = 0;
    for (const tx of extractionResult.transactions) {
      await db.insert(transactionInbox).values({
        id: nanoid(),
        documentId,
        rawDescription: tx.description,
        rawAmountCents: tx.amount,
        rawDate: tx.date,
        rawMerchant: tx.merchant,
        suggestionConfidence: tx.confidence,
        status: 'pending',
        createdAt: now,
      });
      inboxItemsCreated++;
    }

    return { documentId, inboxItems: inboxItemsCreated };
  } catch (error) {
    // Mark document as failed
    await db
      .update(documents)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processedAt: Date.now(),
      })
      .where(eq(documents.id, documentId));

    throw error;
  }
}

/**
 * Extract financial data from a document using AI
 * This is the core AI integration point
 */
async function extractDataFromDocument(
  filePath: string,
  mimeType: string
): Promise<ExtractionResult> {
  // For now, we'll use the AI package from the workspace
  // In production, this would call Claude's vision API

  // TODO: Integrate with @budget-copilot/ai package
  // The AI package should handle:
  // 1. Reading the image/PDF
  // 2. Sending to Claude with the extraction prompt
  // 3. Parsing the JSON response

  // Placeholder implementation - returns empty result
  // This will be replaced with actual AI extraction
  console.log(`[DocumentParser] Would extract from: ${filePath} (${mimeType})`);

  return {
    transactions: [],
    balances: [],
    documentType: 'unknown',
    confidence: 0,
  };
}

/**
 * Get pending documents awaiting processing
 */
export async function getPendingDocuments() {
  const db = await getDb();
  return db.query.documents.findMany({
    where: eq(documents.status, 'pending'),
    orderBy: (docs, { asc }) => [asc(docs.createdAt)],
  });
}

/**
 * Get document by ID with its inbox items
 */
export async function getDocumentWithInbox(documentId: string) {
  const db = await getDb();

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });

  if (!document) return null;

  const inboxItems = await db.query.transactionInbox.findMany({
    where: eq(transactionInbox.documentId, documentId),
  });

  return { document, inboxItems };
}

/**
 * Retry processing a failed document
 */
export async function retryDocument(documentId: string): Promise<{ inboxItems: number }> {
  const db = await getDb();

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.status !== 'failed') {
    throw new Error('Can only retry failed documents');
  }

  // Reset status and retry
  await db
    .update(documents)
    .set({
      status: 'processing',
      errorMessage: null,
    })
    .where(eq(documents.id, documentId));

  try {
    const extractionResult = await extractDataFromDocument(
      document.filePath,
      document.mimeType
    );

    await db
      .update(documents)
      .set({
        status: 'completed',
        extractedData: JSON.stringify(extractionResult),
        extractionConfidence: extractionResult.confidence,
        processedAt: Date.now(),
      })
      .where(eq(documents.id, documentId));

    // Create inbox items
    let inboxItemsCreated = 0;
    const now = Date.now();

    for (const tx of extractionResult.transactions) {
      await db.insert(transactionInbox).values({
        id: nanoid(),
        documentId,
        rawDescription: tx.description,
        rawAmountCents: tx.amount,
        rawDate: tx.date,
        rawMerchant: tx.merchant,
        suggestionConfidence: tx.confidence,
        status: 'pending',
        createdAt: now,
      });
      inboxItemsCreated++;
    }

    return { inboxItems: inboxItemsCreated };
  } catch (error) {
    await db
      .update(documents)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processedAt: Date.now(),
      })
      .where(eq(documents.id, documentId));

    throw error;
  }
}

export { EXTRACTION_PROMPT };
