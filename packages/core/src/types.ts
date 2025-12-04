import { z } from 'zod';

/**
 * Core domain types for budget management
 */

export const TransactionSchema = z.object({
  id: z.string(),
  date: z.date(),
  description: z.string(),
  amount: z.number(),
  categoryId: z.string().optional(),
  accountId: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['income', 'expense', 'transfer']),
  parentId: z.string().optional(),
  rules: z.array(z.string()).optional(),
});

export type Category = z.infer<typeof CategorySchema>;

export const EnvelopeSchema = z.object({
  id: z.string(),
  name: z.string(),
  budgetAmount: z.number(),
  currentAmount: z.number(),
  period: z.enum(['monthly', 'quarterly', 'annual']),
  categoryIds: z.array(z.string()),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

export const BudgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  envelopes: z.array(EnvelopeSchema),
});

export type Budget = z.infer<typeof BudgetSchema>;

export interface MonthlyVariance {
  month: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

export interface ProjectionResult {
  period: string;
  projected: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}
