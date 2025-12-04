/**
 * Debt Copilot Engine
 *
 * Comprehensive debt tracking and payoff projection system.
 * Calculates "death dates" (payoff dates), danger scores,
 * and provides intelligent payoff strategies.
 *
 * Key features:
 * - Debt payoff projections with interest calculations
 * - Danger score calculation (cashflow threat assessment)
 * - Payoff strategy recommendations (avalanche vs snowball)
 * - "What-if" simulations for extra payments
 */

import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { debts, debtPayments } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { Debt, NewDebt, DebtPayment, NewDebtPayment } from '../../db/schema.js';

// Types
export interface DebtWithProjections extends Debt {
  monthlyInterestCents: number;
  monthsToPayoff: number | null; // null if never (min payment doesn't cover interest)
  totalInterestCents: number;
  payoffDate: string | null;
  monthlyPaymentNeeded: number; // To pay off in reasonable time
}

export interface PayoffStrategy {
  name: 'avalanche' | 'snowball' | 'hybrid';
  description: string;
  totalInterestSaved: number;
  monthsToDebtFree: number;
  payoffOrder: Array<{
    debtId: string;
    debtName: string;
    payoffMonth: number;
    totalPaid: number;
    interestPaid: number;
  }>;
}

export interface WhatIfResult {
  originalPayoffDate: string | null;
  newPayoffDate: string | null;
  monthsSaved: number;
  interestSaved: number;
  extraMonthlyPayment: number;
}

/**
 * Create a new debt
 */
export async function createDebt(debt: Omit<NewDebt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Debt> {
  const db = await getDb();
  const now = Date.now();
  const id = nanoid();

  // Calculate initial projections
  const projections = calculateDebtProjections({
    ...debt,
    id,
    createdAt: now,
    updatedAt: now,
    status: debt.status || 'active',
    deathDate: null,
    totalInterestProjectedCents: null,
    dangerScore: null,
  } as Debt);

  const newDebt: NewDebt = {
    ...debt,
    id,
    deathDate: projections.payoffDate,
    totalInterestProjectedCents: projections.totalInterestCents,
    dangerScore: calculateDangerScore(debt.currentBalanceCents, debt.aprPercent, debt.minimumPaymentCents || 0),
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(debts).values(newDebt);

  return db.query.debts.findFirst({
    where: eq(debts.id, id),
  }) as Promise<Debt>;
}

/**
 * Get all debts with projections
 */
export async function getAllDebts(): Promise<DebtWithProjections[]> {
  const db = await getDb();

  const allDebts = await db.query.debts.findMany({
    where: eq(debts.status, 'active'),
    orderBy: [desc(debts.dangerScore)],
  });

  return allDebts.map((debt) => ({
    ...debt,
    ...calculateDebtProjections(debt),
  }));
}

/**
 * Get debt by ID with projections
 */
export async function getDebt(id: string): Promise<DebtWithProjections | null> {
  const db = await getDb();

  const debt = await db.query.debts.findFirst({
    where: eq(debts.id, id),
  });

  if (!debt) return null;

  return {
    ...debt,
    ...calculateDebtProjections(debt),
  };
}

/**
 * Update debt balance (after payment or new charges)
 */
export async function updateDebtBalance(
  debtId: string,
  newBalanceCents: number
): Promise<Debt> {
  const db = await getDb();
  const now = Date.now();

  const debt = await db.query.debts.findFirst({
    where: eq(debts.id, debtId),
  });

  if (!debt) {
    throw new Error('Debt not found');
  }

  // Recalculate projections
  const updatedDebt = { ...debt, currentBalanceCents: newBalanceCents };
  const projections = calculateDebtProjections(updatedDebt as Debt);

  await db
    .update(debts)
    .set({
      currentBalanceCents: newBalanceCents,
      deathDate: projections.payoffDate,
      totalInterestProjectedCents: projections.totalInterestCents,
      dangerScore: calculateDangerScore(newBalanceCents, debt.aprPercent, debt.minimumPaymentCents || 0),
      updatedAt: now,
      status: newBalanceCents <= 0 ? 'paid_off' : 'active',
    })
    .where(eq(debts.id, debtId));

  return db.query.debts.findFirst({
    where: eq(debts.id, debtId),
  }) as Promise<Debt>;
}

/**
 * Record a debt payment
 */
export async function recordDebtPayment(
  debtId: string,
  amountCents: number,
  paymentDate: string,
  transactionId?: string
): Promise<DebtPayment> {
  const db = await getDb();
  const now = Date.now();

  const debt = await db.query.debts.findFirst({
    where: eq(debts.id, debtId),
  });

  if (!debt) {
    throw new Error('Debt not found');
  }

  // Calculate principal vs interest split
  const monthlyInterest = Math.round((debt.currentBalanceCents * (debt.aprPercent / 100)) / 12);
  const interestCents = Math.min(amountCents, monthlyInterest);
  const principalCents = amountCents - interestCents;

  const paymentId = nanoid();

  const payment: NewDebtPayment = {
    id: paymentId,
    debtId,
    transactionId,
    amountCents,
    principalCents,
    interestCents,
    paymentDate,
    createdAt: now,
  };

  await db.insert(debtPayments).values(payment);

  // Update debt balance
  const newBalance = Math.max(0, debt.currentBalanceCents - principalCents);
  await updateDebtBalance(debtId, newBalance);

  return db.query.debtPayments.findFirst({
    where: eq(debtPayments.id, paymentId),
  }) as Promise<DebtPayment>;
}

/**
 * Get payment history for a debt
 */
export async function getDebtPayments(debtId: string): Promise<DebtPayment[]> {
  const db = await getDb();

  return db.query.debtPayments.findMany({
    where: eq(debtPayments.debtId, debtId),
    orderBy: [desc(debtPayments.paymentDate)],
  });
}

/**
 * Calculate debt projections (payoff date, total interest, etc.)
 */
function calculateDebtProjections(debt: Debt): {
  monthlyInterestCents: number;
  monthsToPayoff: number | null;
  totalInterestCents: number;
  payoffDate: string | null;
  monthlyPaymentNeeded: number;
} {
  const balance = debt.currentBalanceCents;
  const apr = debt.aprPercent;
  const minPayment = debt.minimumPaymentCents || 0;

  // Monthly interest rate
  const monthlyRate = apr / 100 / 12;
  const monthlyInterestCents = Math.round(balance * monthlyRate);

  // If minimum payment doesn't cover interest, debt will never be paid off
  if (minPayment <= monthlyInterestCents && minPayment > 0) {
    return {
      monthlyInterestCents,
      monthsToPayoff: null,
      totalInterestCents: 0, // Infinite
      payoffDate: null,
      monthlyPaymentNeeded: monthlyInterestCents + Math.round(balance / 60), // 5 year payoff
    };
  }

  // Calculate months to payoff using amortization formula
  // n = -log(1 - (r * P) / M) / log(1 + r)
  // where P = principal, r = monthly rate, M = monthly payment
  let monthsToPayoff: number;
  let totalInterestCents: number;

  if (minPayment > 0 && monthlyRate > 0) {
    const numerator = -Math.log(1 - (monthlyRate * balance) / minPayment);
    const denominator = Math.log(1 + monthlyRate);
    monthsToPayoff = Math.ceil(numerator / denominator);

    // Calculate total interest
    totalInterestCents = Math.round(minPayment * monthsToPayoff - balance);
  } else if (minPayment > 0) {
    // 0% APR
    monthsToPayoff = Math.ceil(balance / minPayment);
    totalInterestCents = 0;
  } else {
    // No minimum payment set
    monthsToPayoff = Math.ceil(balance / (monthlyInterestCents + Math.round(balance / 60)));
    totalInterestCents = monthlyInterestCents * monthsToPayoff;
  }

  // Calculate payoff date
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + monthsToPayoff);
  const payoffDateStr = payoffDate.toISOString().split('T')[0];

  // Calculate payment needed for 3-year payoff
  const targetMonths = 36;
  let monthlyPaymentNeeded: number;
  if (monthlyRate > 0) {
    // M = P * (r * (1 + r)^n) / ((1 + r)^n - 1)
    const factor = Math.pow(1 + monthlyRate, targetMonths);
    monthlyPaymentNeeded = Math.round(balance * (monthlyRate * factor) / (factor - 1));
  } else {
    monthlyPaymentNeeded = Math.round(balance / targetMonths);
  }

  return {
    monthlyInterestCents,
    monthsToPayoff,
    totalInterestCents,
    payoffDate: payoffDateStr,
    monthlyPaymentNeeded,
  };
}

/**
 * Calculate danger score (0-100)
 * Higher = more dangerous to cashflow
 */
function calculateDangerScore(
  balanceCents: number,
  aprPercent: number,
  minimumPaymentCents: number
): number {
  let score = 0;

  // Factor 1: High APR (max 30 points)
  // 0% = 0 points, 30%+ = 30 points
  score += Math.min(30, aprPercent);

  // Factor 2: Balance size (max 30 points)
  // Scale: $1000 = 10 points, $10000+ = 30 points
  const balanceDollars = balanceCents / 100;
  score += Math.min(30, Math.round(balanceDollars / 333));

  // Factor 3: Payment vs Interest ratio (max 40 points)
  // If payment barely covers interest = high danger
  const monthlyInterest = (balanceCents * (aprPercent / 100)) / 12;
  if (minimumPaymentCents > 0) {
    const paymentRatio = minimumPaymentCents / monthlyInterest;
    if (paymentRatio < 1.1) {
      score += 40; // Payment barely covers interest
    } else if (paymentRatio < 1.5) {
      score += 30;
    } else if (paymentRatio < 2) {
      score += 20;
    } else if (paymentRatio < 3) {
      score += 10;
    }
  }

  return Math.min(100, Math.round(score));
}

/**
 * Generate payoff strategies
 */
export async function getPayoffStrategies(
  extraMonthlyBudgetCents: number = 0
): Promise<PayoffStrategy[]> {
  const allDebts = await getAllDebts();
  const activeDebts = allDebts.filter((d) => d.status === 'active' && d.currentBalanceCents > 0);

  if (activeDebts.length === 0) {
    return [];
  }

  const strategies: PayoffStrategy[] = [];

  // Avalanche: Highest APR first
  const avalancheOrder = [...activeDebts].sort((a, b) => b.aprPercent - a.aprPercent);
  strategies.push(calculateStrategy('avalanche', avalancheOrder, extraMonthlyBudgetCents));

  // Snowball: Lowest balance first
  const snowballOrder = [...activeDebts].sort((a, b) => a.currentBalanceCents - b.currentBalanceCents);
  strategies.push(calculateStrategy('snowball', snowballOrder, extraMonthlyBudgetCents));

  // Hybrid: Balance danger score
  const hybridOrder = [...activeDebts].sort((a, b) => (b.dangerScore || 0) - (a.dangerScore || 0));
  strategies.push(calculateStrategy('hybrid', hybridOrder, extraMonthlyBudgetCents));

  return strategies;
}

/**
 * Calculate a specific payoff strategy
 */
function calculateStrategy(
  name: 'avalanche' | 'snowball' | 'hybrid',
  orderedDebts: DebtWithProjections[],
  extraMonthlyBudgetCents: number
): PayoffStrategy {
  const descriptions = {
    avalanche: 'Pay highest interest rate first - saves the most money',
    snowball: 'Pay smallest balance first - quick wins for motivation',
    hybrid: 'Pay most dangerous debts first - protects your cashflow',
  };

  // Simulate payoff
  const simulation = simulatePayoff(orderedDebts, extraMonthlyBudgetCents);

  return {
    name,
    description: descriptions[name],
    totalInterestSaved: simulation.interestSaved,
    monthsToDebtFree: simulation.totalMonths,
    payoffOrder: simulation.payoffOrder,
  };
}

/**
 * Simulate debt payoff with given order and extra payment
 */
function simulatePayoff(
  orderedDebts: DebtWithProjections[],
  extraMonthlyBudgetCents: number
): {
  totalMonths: number;
  interestSaved: number;
  payoffOrder: PayoffStrategy['payoffOrder'];
} {
  // Clone debts for simulation
  const simDebts = orderedDebts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: d.currentBalanceCents,
    apr: d.aprPercent,
    minPayment: d.minimumPaymentCents || 0,
    totalPaid: 0,
    interestPaid: 0,
    paidOffMonth: 0,
  }));

  let month = 0;
  let extraAvailable = extraMonthlyBudgetCents;
  const payoffOrder: PayoffStrategy['payoffOrder'] = [];

  // Simulate month by month
  while (simDebts.some((d) => d.balance > 0) && month < 360) {
    // 30 year max
    month++;

    // Reset extra budget each month
    let monthlyExtra = extraAvailable;

    for (const debt of simDebts) {
      if (debt.balance <= 0) continue;

      // Calculate interest
      const monthlyRate = debt.apr / 100 / 12;
      const interest = Math.round(debt.balance * monthlyRate);
      debt.interestPaid += interest;
      debt.balance += interest;

      // Make minimum payment
      const payment = Math.min(debt.balance, debt.minPayment);
      debt.balance -= payment;
      debt.totalPaid += payment;

      // Apply extra payment to first debt in order
      if (monthlyExtra > 0 && simDebts.indexOf(debt) === simDebts.findIndex((d) => d.balance > 0)) {
        const extraPayment = Math.min(monthlyExtra, debt.balance);
        debt.balance -= extraPayment;
        debt.totalPaid += extraPayment;
        monthlyExtra -= extraPayment;
      }

      // Check if paid off
      if (debt.balance <= 0 && debt.paidOffMonth === 0) {
        debt.paidOffMonth = month;
        debt.balance = 0;

        // Add freed up minimum payment to extra budget
        extraAvailable += debt.minPayment;

        payoffOrder.push({
          debtId: debt.id,
          debtName: debt.name,
          payoffMonth: month,
          totalPaid: debt.totalPaid,
          interestPaid: debt.interestPaid,
        });
      }
    }
  }

  // Calculate interest saved vs minimum payments only
  const totalInterestPaid = simDebts.reduce((sum, d) => sum + d.interestPaid, 0);
  const baselineInterest = orderedDebts.reduce((sum, d) => sum + d.totalInterestCents, 0);
  const interestSaved = Math.max(0, baselineInterest - totalInterestPaid);

  return {
    totalMonths: month,
    interestSaved,
    payoffOrder,
  };
}

/**
 * What-if simulation: What if I pay $X extra per month?
 */
export async function whatIfExtraPayment(
  debtId: string,
  extraMonthlyCents: number
): Promise<WhatIfResult> {
  const debt = await getDebt(debtId);

  if (!debt) {
    throw new Error('Debt not found');
  }

  const originalProjections = calculateDebtProjections(debt);

  // Calculate new projections with extra payment
  const newMinPayment = (debt.minimumPaymentCents || 0) + extraMonthlyCents;
  const simulatedDebt = { ...debt, minimumPaymentCents: newMinPayment };
  const newProjections = calculateDebtProjections(simulatedDebt as Debt);

  const monthsSaved =
    originalProjections.monthsToPayoff && newProjections.monthsToPayoff
      ? originalProjections.monthsToPayoff - newProjections.monthsToPayoff
      : 0;

  const interestSaved = originalProjections.totalInterestCents - newProjections.totalInterestCents;

  return {
    originalPayoffDate: originalProjections.payoffDate,
    newPayoffDate: newProjections.payoffDate,
    monthsSaved,
    interestSaved,
    extraMonthlyPayment: extraMonthlyCents,
  };
}

/**
 * Get debt summary statistics
 */
export async function getDebtSummary(): Promise<{
  totalDebtCents: number;
  totalMinimumPaymentCents: number;
  highestApr: number;
  averageApr: number;
  debtCount: number;
  projectedInterestCents: number;
  earliestPayoffDate: string | null;
  latestPayoffDate: string | null;
  averageDangerScore: number;
}> {
  const allDebts = await getAllDebts();
  const activeDebts = allDebts.filter((d) => d.status === 'active');

  if (activeDebts.length === 0) {
    return {
      totalDebtCents: 0,
      totalMinimumPaymentCents: 0,
      highestApr: 0,
      averageApr: 0,
      debtCount: 0,
      projectedInterestCents: 0,
      earliestPayoffDate: null,
      latestPayoffDate: null,
      averageDangerScore: 0,
    };
  }

  const totalDebtCents = activeDebts.reduce((sum, d) => sum + d.currentBalanceCents, 0);
  const totalMinimumPaymentCents = activeDebts.reduce((sum, d) => sum + (d.minimumPaymentCents || 0), 0);
  const highestApr = Math.max(...activeDebts.map((d) => d.aprPercent));
  const averageApr = activeDebts.reduce((sum, d) => sum + d.aprPercent, 0) / activeDebts.length;
  const projectedInterestCents = activeDebts.reduce((sum, d) => sum + d.totalInterestCents, 0);

  const payoffDates = activeDebts.map((d) => d.payoffDate).filter(Boolean) as string[];
  const earliestPayoffDate = payoffDates.length > 0 ? payoffDates.sort()[0] : null;
  const latestPayoffDate = payoffDates.length > 0 ? payoffDates.sort().reverse()[0] : null;

  const averageDangerScore =
    activeDebts.reduce((sum, d) => sum + (d.dangerScore || 0), 0) / activeDebts.length;

  return {
    totalDebtCents,
    totalMinimumPaymentCents,
    highestApr,
    averageApr: Math.round(averageApr * 100) / 100,
    debtCount: activeDebts.length,
    projectedInterestCents,
    earliestPayoffDate,
    latestPayoffDate,
    averageDangerScore: Math.round(averageDangerScore),
  };
}
