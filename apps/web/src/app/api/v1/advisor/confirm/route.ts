import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import {
  advisorSessions,
  transactions,
  debts,
  scheduledBills,
  userProfiles,
  accounts,
  uploadedFiles,
  fileParsedSummaries,
  fileImportedItems,
} from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';
import { type ParsedSummary, isBankStatement } from '@/lib/file-upload/types';
import { learnPatternsFromImport } from '@/lib/import-pipeline/pattern-learner';

export const dynamic = 'force-dynamic';

/**
 * Pending changes structure
 */
interface PendingChanges {
  transactions?: Array<{
    type: 'income' | 'expense';
    amountCents: number;
    description: string;
    date: string;
    categoryGuess?: string;
  }>;
  transactionUpdates?: Array<{
    transactionId: string;
    updates: {
      amountCents?: number;
      description?: string;
      categoryId?: string;
      date?: string;
    };
  }>;
  transactionDeletions?: string[];
  incomeChange?: {
    type: 'monthly_salary' | 'one_time';
    amountCents: number;
    description?: string;
  };
  debtChanges?: Array<{
    debtId?: string;
    type?: string;
    name?: string;
    currentBalanceCents?: number;
    minimumPaymentCents?: number;
    aprPercent?: number;
    dueDay?: number;
  }>;
  billChanges?: Array<{
    billId?: string;
    name?: string;
    amountCents?: number;
    dueDay?: number;
    frequency?: string;
    isActive?: boolean;
  }>;
  fileImport?: {
    fileId: string;
    itemIds: string[];
    categoryOverrides?: Record<
      string,
      { categoryId: string | null; categoryName: string | null }
    >;
  };
}

/**
 * Determine if changes should trigger decision recompute
 */
function shouldRecomputeDecision(changes: PendingChanges): boolean {
  // Any transaction affects cash available
  if (changes.transactions && changes.transactions.length > 0) return true;

  // Transaction updates might affect recent transactions
  if (changes.transactionUpdates && changes.transactionUpdates.length > 0)
    return true;

  // Transaction deletions affect cash
  if (changes.transactionDeletions && changes.transactionDeletions.length > 0)
    return true;

  // Income changes always affect decision
  if (changes.incomeChange) return true;

  // Debt changes affect payment strategy
  if (changes.debtChanges && changes.debtChanges.length > 0) return true;

  // Bill changes affect recurring expenses
  if (changes.billChanges && changes.billChanges.length > 0) return true;

  // File imports typically contain transactions
  if (changes.fileImport) return true;

  return false;
}

/**
 * POST /api/v1/advisor/confirm - Commit pending changes
 *
 * This is the ONLY endpoint that writes data to the database.
 * Triggers decision recompute if necessary.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const user = auth.user;

    // Verify paid user
    if (user.plan === 'free') {
      return errorJson('FORBIDDEN', 'Pro subscription required', 403);
    }

    const body = await request.json();
    const { sessionId, pendingChanges: bodyPendingChanges } = body as {
      sessionId: string;
      pendingChanges?: PendingChanges;
    };

    if (!sessionId) {
      return errorJson('VALIDATION_ERROR', 'Session ID required', 400);
    }

    const db = getDb();

    // Get session
    const [session] = await db
      .select()
      .from(advisorSessions)
      .where(
        and(
          eq(advisorSessions.id, sessionId),
          eq(advisorSessions.userId, user.id)
        )
      );

    if (!session) {
      return errorJson('NOT_FOUND', 'Session not found', 404);
    }

    // Use pending changes from body if provided, otherwise from session
    let changes: PendingChanges;
    if (bodyPendingChanges) {
      changes = bodyPendingChanges;
    } else if (session.pendingChanges) {
      changes = JSON.parse(session.pendingChanges);
    } else {
      return errorJson(
        'VALIDATION_ERROR',
        'No pending changes to confirm.',
        400
      );
    }
    const changesApplied: string[] = [];

    // Get or create default account for transactions
    let [defaultAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, user.id))
      .limit(1);

    if (!defaultAccount) {
      const accountId = nanoid();
      await db.insert(accounts).values({
        id: accountId,
        userId: user.id,
        name: 'Cash',
        type: 'cash',
        createdAt: Date.now(),
      });
      [defaultAccount] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));
    }

    // Apply transactions (only if we have an account)
    if (changes.transactions && defaultAccount) {
      for (const txn of changes.transactions) {
        await db.insert(transactions).values({
          id: nanoid(),
          userId: user.id,
          accountId: defaultAccount.id,
          date: txn.date,
          description: txn.description,
          amountCents:
            txn.type === 'expense'
              ? -Math.abs(txn.amountCents)
              : Math.abs(txn.amountCents),
          type: txn.type,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        changesApplied.push(
          `Transaction: ${txn.description} $${(txn.amountCents / 100).toFixed(2)}`
        );
      }
    } else if (changes.transactions && !defaultAccount) {
      // No account available - skip transactions
      changesApplied.push('Transactions skipped (no account configured)');
    }

    // Apply transaction updates
    if (changes.transactionUpdates) {
      for (const update of changes.transactionUpdates) {
        await db
          .update(transactions)
          .set({
            ...update.updates,
            updatedAt: Date.now(),
          })
          .where(
            and(
              eq(transactions.id, update.transactionId),
              eq(transactions.userId, user.id)
            )
          );
        changesApplied.push(`Transaction updated`);
      }
    }

    // Apply transaction deletions (mark as disputed)
    if (changes.transactionDeletions) {
      for (const txnId of changes.transactionDeletions) {
        // Get original transaction
        const [original] = await db
          .select()
          .from(transactions)
          .where(
            and(eq(transactions.id, txnId), eq(transactions.userId, user.id))
          );

        if (original) {
          await db
            .update(transactions)
            .set({
              description: `[DISPUTED] ${original.description}`,
              updatedAt: Date.now(),
            })
            .where(eq(transactions.id, txnId));
          changesApplied.push(`Transaction disputed`);
        }
      }
    }

    // Apply income changes
    if (changes.incomeChange) {
      // Check if profile exists
      const [existingProfile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id));

      if (existingProfile) {
        await db
          .update(userProfiles)
          .set({
            monthlySalaryCents: changes.incomeChange.amountCents,
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, user.id));
      } else {
        await db.insert(userProfiles).values({
          id: nanoid(),
          userId: user.id,
          monthlySalaryCents: changes.incomeChange.amountCents,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      changesApplied.push(
        `Income updated: $${(changes.incomeChange.amountCents / 100).toFixed(2)}`
      );
    }

    // Apply debt changes
    if (changes.debtChanges) {
      for (const debtChange of changes.debtChanges) {
        if (debtChange.debtId) {
          // Update existing debt
          const updateData: Record<string, unknown> = { updatedAt: Date.now() };
          if (debtChange.currentBalanceCents !== undefined)
            updateData.currentBalanceCents = debtChange.currentBalanceCents;
          if (debtChange.minimumPaymentCents !== undefined)
            updateData.minimumPaymentCents = debtChange.minimumPaymentCents;
          if (debtChange.aprPercent !== undefined)
            updateData.aprPercent = debtChange.aprPercent;

          await db
            .update(debts)
            .set(updateData)
            .where(
              and(eq(debts.id, debtChange.debtId), eq(debts.userId, user.id))
            );
          changesApplied.push(`Debt updated: ${debtChange.name || 'debt'}`);
        } else if (debtChange.name) {
          // Map incoming type to valid debt type
          const validDebtTypes = [
            'credit_card',
            'personal_loan',
            'auto_loan',
            'mortgage',
            'student_loan',
            'medical',
            'other',
          ] as const;
          type ValidDebtType = (typeof validDebtTypes)[number];
          const debtType: ValidDebtType = validDebtTypes.includes(
            debtChange.type as ValidDebtType
          )
            ? (debtChange.type as ValidDebtType)
            : 'other';

          // Create new debt
          await db.insert(debts).values({
            id: nanoid(),
            userId: user.id,
            name: debtChange.name,
            type: debtType,
            originalBalanceCents: debtChange.currentBalanceCents || 0,
            currentBalanceCents: debtChange.currentBalanceCents || 0,
            minimumPaymentCents: debtChange.minimumPaymentCents || 0,
            aprPercent: debtChange.aprPercent || 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          changesApplied.push(`New debt: ${debtChange.name}`);
        }
      }
    }

    // Apply bill changes
    if (changes.billChanges) {
      for (const billChange of changes.billChanges) {
        if (billChange.billId) {
          // Update existing bill
          const updateData: Record<string, unknown> = { updatedAt: Date.now() };
          if (billChange.amountCents !== undefined)
            updateData.amountCents = billChange.amountCents;
          if (billChange.dueDay !== undefined)
            updateData.dueDay = billChange.dueDay;
          if (billChange.isActive !== undefined)
            updateData.status = billChange.isActive ? 'active' : 'paused';

          await db
            .update(scheduledBills)
            .set(updateData)
            .where(
              and(
                eq(scheduledBills.id, billChange.billId),
                eq(scheduledBills.userId, user.id)
              )
            );
          changesApplied.push(
            `Recurring bill updated: ${billChange.name || 'bill'}`
          );
        } else if (billChange.name) {
          // Map incoming frequency to valid frequency
          const validFrequencies = [
            'weekly',
            'biweekly',
            'monthly',
            'quarterly',
            'annually',
          ] as const;
          type ValidFrequency = (typeof validFrequencies)[number];
          let frequency: ValidFrequency = 'monthly';
          if (billChange.frequency) {
            if (billChange.frequency === 'yearly') {
              frequency = 'annually';
            } else if (
              validFrequencies.includes(billChange.frequency as ValidFrequency)
            ) {
              frequency = billChange.frequency as ValidFrequency;
            }
          }

          // Create new bill
          await db.insert(scheduledBills).values({
            id: nanoid(),
            userId: user.id,
            name: billChange.name,
            type: 'other',
            amountCents: billChange.amountCents || 0,
            dueDay: billChange.dueDay || 1,
            frequency,
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          changesApplied.push(`New recurring bill: ${billChange.name}`);
        }
      }
    }

    // Apply file import
    if (changes.fileImport && defaultAccount) {
      const { fileId, itemIds, categoryOverrides } = changes.fileImport;

      // Validate fileImport structure
      if (
        !fileId ||
        !itemIds ||
        !Array.isArray(itemIds) ||
        itemIds.length === 0
      ) {
        console.warn(
          '[advisor/confirm] Invalid fileImport structure:',
          changes.fileImport
        );
        changesApplied.push('Import skipped (invalid data)');
      } else {
        // Verify file ownership
        const file = await db.query.uploadedFiles.findFirst({
          where: and(
            eq(uploadedFiles.id, fileId),
            eq(uploadedFiles.userId, user.id)
          ),
        });

        if (file && file.status === 'processed') {
          // Get the file summary
          const summary = await db.query.fileParsedSummaries.findFirst({
            where: eq(fileParsedSummaries.fileId, fileId),
            orderBy: desc(fileParsedSummaries.createdAt),
          });

          if (summary) {
            try {
              const parsedSummary: ParsedSummary = JSON.parse(
                summary.summaryJson
              );

              if (isBankStatement(parsedSummary)) {
                let importedCount = 0;
                let skippedCount = 0;

                for (const itemId of itemIds) {
                  // Check if already imported
                  const alreadyImported =
                    await db.query.fileImportedItems.findFirst({
                      where: and(
                        eq(fileImportedItems.fileId, fileId),
                        eq(fileImportedItems.parsedItemId, itemId)
                      ),
                    });

                  if (alreadyImported) {
                    skippedCount++;
                    continue;
                  }

                  // Find transaction in summary
                  const tx = parsedSummary.transactions.find(
                    (t) => t.id === itemId
                  );
                  if (!tx) continue;

                  // Determine transaction type
                  const txType: 'income' | 'expense' = tx.isCredit
                    ? 'income'
                    : 'expense';

                  // Convert amount to cents (amount is already in dollars)
                  const amountCents = Math.round(Math.abs(tx.amount) * 100);
                  const finalAmountCents =
                    txType === 'expense' ? -amountCents : amountCents;

                  // Use parsed date or fall back to period start or today
                  const date =
                    tx.date ||
                    parsedSummary.period?.from ||
                    new Date().toISOString().split('T')[0]!;

                  // Get category from override (user selection) or null
                  const categoryOverride = categoryOverrides?.[itemId];
                  const categoryId = categoryOverride?.categoryId ?? null;

                  const transactionId = nanoid();
                  const importId = nanoid();
                  const now = Date.now();

                  // Create transaction
                  await db.insert(transactions).values({
                    id: transactionId,
                    userId: user.id,
                    accountId: defaultAccount.id,
                    date,
                    description: tx.description,
                    amountCents: finalAmountCents,
                    type: txType,
                    categoryId,
                    cleared: false,
                    createdAt: now,
                    updatedAt: now,
                  });

                  // Track import
                  await db.insert(fileImportedItems).values({
                    id: importId,
                    fileId,
                    parsedItemId: itemId,
                    transactionId,
                    createdAt: now,
                  });

                  importedCount++;
                }

                if (importedCount > 0) {
                  changesApplied.push(
                    `${importedCount} transactions imported from file`
                  );

                  // Learn patterns from categorized transactions (fire-and-forget)
                  if (categoryOverrides) {
                    const categorizedTxs = parsedSummary.transactions
                      .filter((t) => categoryOverrides[t.id]?.categoryId)
                      .map((t) => ({
                        description: t.description,
                        categoryId: categoryOverrides[t.id]!.categoryId,
                        categoryName: categoryOverrides[t.id]!.categoryName,
                        source: 'pattern' as const,
                      }));

                    if (categorizedTxs.length > 0) {
                      learnPatternsFromImport(user.id, categorizedTxs)
                        .then(({ learned, updated }) => {
                          console.log(
                            `[patterns] Learned ${learned} new, updated ${updated} existing`
                          );
                        })
                        .catch((err) => {
                          console.error('[patterns] Failed to learn:', err);
                        });
                    }
                  }
                }
                if (skippedCount > 0) {
                  changesApplied.push(
                    `${skippedCount} transactions already imported (skipped)`
                  );
                }
              }
            } catch (err) {
              console.error(
                '[advisor/confirm] Failed to process file import:',
                err
              );
              changesApplied.push('Error importing file');
            }
          }
        }
      }
    } else if (changes.fileImport && !defaultAccount) {
      changesApplied.push('Import skipped (no account configured)');
    }

    // Determine if we should recompute decision
    const decisionRecomputed = shouldRecomputeDecision(changes);

    // Update session - clear pending changes, mark as confirmed
    await db
      .update(advisorSessions)
      .set({
        pendingChanges: null,
        lastConfirmedAt: Date.now(),
        lastDecisionRecompute: decisionRecomputed
          ? Date.now()
          : session.lastDecisionRecompute,
        lastActivityAt: Date.now(),
      })
      .where(eq(advisorSessions.id, sessionId));

    return NextResponse.json({
      data: {
        success: true,
        changesApplied,
        decisionRecomputed,
        message: decisionRecomputed
          ? "Changes applied. Today's decision has been updated."
          : "Changes applied. Today's decision remains the same.",
        redirectTo: decisionRecomputed ? '/dashboard' : null,
      },
    });
  } catch (error) {
    console.error('Failed to confirm pending changes:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to apply changes', 500);
  }
}
