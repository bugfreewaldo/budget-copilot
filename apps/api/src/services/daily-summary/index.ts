/**
 * Daily AI Summary Generator Service
 *
 * Generates the morning "financial weather" briefing that provides users with:
 * - Weather emoji and headline summarizing their financial state
 * - Current balance and cash runway projections
 * - Yesterday's spending/income activity
 * - Upcoming bills and due dates
 * - AI-generated coaching tips and warnings
 *
 * This is the "personality" layer of Budget Copilot - turning dry numbers
 * into actionable, emotionally intelligent guidance.
 */

import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import {
  dailySummaries,
  transactions,
  recurringTransactions,
  debts,
  goals,
  cashRunway,
  envelopes,
} from '../../db/schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

// Types
export interface FinancialWeather {
  emoji: string;
  headline: string;
  description: string;
  riskLevel: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy';
}

export interface DailySummaryData {
  id: string;
  summaryDate: string;
  weather: FinancialWeather;
  currentBalanceCents: number;
  cashRunwayDays: number | null;
  safeToSpendCents: number | null;
  yesterdaySpentCents: number;
  yesterdayEarnedCents: number;
  billsDueCount: number;
  billsDueAmountCents: number;
  summaryText: string;
  coachingTips: string[];
  warnings: string[];
  opportunities: string[];
  generatedAt: number;
}

interface AccountBalance {
  id: string;
  name: string;
  type: string;
  balanceCents: number;
}

interface UpcomingBill {
  id: string;
  name: string;
  amountCents: number;
  dueDate: string;
  daysUntilDue: number;
}

/**
 * Generate today's financial summary
 */
export async function generateDailySummary(
  forDate?: string
): Promise<DailySummaryData> {
  const db = await getDb();
  const summaryDate = forDate || new Date().toISOString().split('T')[0];
  const now = Date.now();

  // Gather all financial data
  const [
    accountBalances,
    yesterdayActivity,
    upcomingBills,
    activeDebts,
    activeGoals,
    latestRunway,
    budgetStatus,
  ] = await Promise.all([
    getAccountBalances(),
    getYesterdayActivity(summaryDate),
    getUpcomingBills(summaryDate, 7), // Next 7 days
    getActiveDebts(),
    getActiveGoals(),
    getLatestCashRunway(),
    getCurrentMonthBudgetStatus(summaryDate),
  ]);

  // Calculate totals
  const totalBalanceCents = accountBalances.reduce(
    (sum, acc) => sum + acc.balanceCents,
    0
  );

  const billsDueToday = upcomingBills.filter((b) => b.daysUntilDue <= 1);
  const billsDueThisWeek = upcomingBills.filter((b) => b.daysUntilDue <= 7);

  // Determine financial weather
  const weather = calculateFinancialWeather({
    totalBalanceCents,
    cashRunwayDays: latestRunway?.daysUntilZero || null,
    yesterdaySpentCents: yesterdayActivity.spent,
    billsDueCount: billsDueToday.length,
    billsDueAmountCents: billsDueToday.reduce(
      (sum, b) => sum + b.amountCents,
      0
    ),
    budgetStatus,
    activeDebts,
  });

  // Generate coaching content
  const coachingTips = generateCoachingTips({
    weather,
    accountBalances,
    yesterdayActivity,
    upcomingBills: billsDueThisWeek,
    activeDebts,
    activeGoals,
    budgetStatus,
  });

  const warnings = generateWarnings({
    totalBalanceCents,
    cashRunwayDays: latestRunway?.daysUntilZero || null,
    upcomingBills: billsDueThisWeek,
    activeDebts,
    budgetStatus,
  });

  const opportunities = generateOpportunities({
    yesterdayActivity,
    activeGoals,
    budgetStatus,
    totalBalanceCents,
  });

  // Generate summary text
  const summaryText = generateSummaryText({
    weather,
    totalBalanceCents,
    yesterdayActivity,
    billsDueToday,
    cashRunwayDays: latestRunway?.daysUntilZero || null,
  });

  // Save to database
  const summaryId = nanoid();
  await db.insert(dailySummaries).values({
    id: summaryId,
    summaryDate,
    weatherEmoji: weather.emoji,
    weatherHeadline: weather.headline,
    currentBalanceCents: totalBalanceCents,
    cashRunwayDays: latestRunway?.daysUntilZero || null,
    safeToSpendCents: latestRunway?.safeToSpendTodayCents || null,
    yesterdaySpentCents: yesterdayActivity.spent,
    yesterdayEarnedCents: yesterdayActivity.earned,
    billsDueCount: billsDueToday.length,
    billsDueAmountCents: billsDueToday.reduce(
      (sum, b) => sum + b.amountCents,
      0
    ),
    summaryText,
    coachingTips: JSON.stringify(coachingTips),
    warnings: JSON.stringify(warnings),
    opportunities: JSON.stringify(opportunities),
    generatedAt: now,
  });

  return {
    id: summaryId,
    summaryDate,
    weather,
    currentBalanceCents: totalBalanceCents,
    cashRunwayDays: latestRunway?.daysUntilZero || null,
    safeToSpendCents: latestRunway?.safeToSpendTodayCents || null,
    yesterdaySpentCents: yesterdayActivity.spent,
    yesterdayEarnedCents: yesterdayActivity.earned,
    billsDueCount: billsDueToday.length,
    billsDueAmountCents: billsDueToday.reduce(
      (sum, b) => sum + b.amountCents,
      0
    ),
    summaryText,
    coachingTips,
    warnings,
    opportunities,
    generatedAt: now,
  };
}

/**
 * Get today's summary if it exists
 */
export async function getTodaySummary(
  date?: string
): Promise<DailySummaryData | null> {
  const db = await getDb();
  const summaryDate = date || new Date().toISOString().split('T')[0];

  const summary = await db.query.dailySummaries.findFirst({
    where: eq(dailySummaries.summaryDate, summaryDate),
  });

  if (!summary) return null;

  return {
    id: summary.id,
    summaryDate: summary.summaryDate,
    weather: {
      emoji: summary.weatherEmoji,
      headline: summary.weatherHeadline,
      description: '',
      riskLevel: determineRiskLevelFromEmoji(summary.weatherEmoji),
    },
    currentBalanceCents: summary.currentBalanceCents,
    cashRunwayDays: summary.cashRunwayDays,
    safeToSpendCents: summary.safeToSpendCents,
    yesterdaySpentCents: summary.yesterdaySpentCents || 0,
    yesterdayEarnedCents: summary.yesterdayEarnedCents || 0,
    billsDueCount: summary.billsDueCount || 0,
    billsDueAmountCents: summary.billsDueAmountCents || 0,
    summaryText: summary.summaryText,
    coachingTips: summary.coachingTips ? JSON.parse(summary.coachingTips) : [],
    warnings: summary.warnings ? JSON.parse(summary.warnings) : [],
    opportunities: summary.opportunities
      ? JSON.parse(summary.opportunities)
      : [],
    generatedAt: summary.generatedAt,
  };
}

/**
 * Get or generate today's summary
 */
export async function getOrGenerateDailySummary(
  date?: string
): Promise<DailySummaryData> {
  const existing = await getTodaySummary(date);
  if (existing) return existing;
  return generateDailySummary(date);
}

/**
 * Get recent summaries for history view
 */
export async function getRecentSummaries(
  limit = 7
): Promise<DailySummaryData[]> {
  const db = await getDb();

  const summaries = await db.query.dailySummaries.findMany({
    orderBy: [desc(dailySummaries.summaryDate)],
    limit,
  });

  return summaries.map((summary) => ({
    id: summary.id,
    summaryDate: summary.summaryDate,
    weather: {
      emoji: summary.weatherEmoji,
      headline: summary.weatherHeadline,
      description: '',
      riskLevel: determineRiskLevelFromEmoji(summary.weatherEmoji),
    },
    currentBalanceCents: summary.currentBalanceCents,
    cashRunwayDays: summary.cashRunwayDays,
    safeToSpendCents: summary.safeToSpendCents,
    yesterdaySpentCents: summary.yesterdaySpentCents || 0,
    yesterdayEarnedCents: summary.yesterdayEarnedCents || 0,
    billsDueCount: summary.billsDueCount || 0,
    billsDueAmountCents: summary.billsDueAmountCents || 0,
    summaryText: summary.summaryText,
    coachingTips: summary.coachingTips ? JSON.parse(summary.coachingTips) : [],
    warnings: summary.warnings ? JSON.parse(summary.warnings) : [],
    opportunities: summary.opportunities
      ? JSON.parse(summary.opportunities)
      : [],
    generatedAt: summary.generatedAt,
  }));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getAccountBalances(): Promise<AccountBalance[]> {
  const db = await getDb();
  const { accounts } = await import('../../db/schema.js');
  const allAccounts = await db.select().from(accounts);

  const balances: AccountBalance[] = [];

  for (const account of allAccounts) {
    // Calculate balance from transactions
    const txList = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, account.id));

    // Sum up all transactions for this account
    const total = txList.reduce((sum, tx) => sum + tx.amountCents, 0);

    balances.push({
      id: account.id,
      name: account.name,
      type: account.type,
      balanceCents: total,
    });
  }

  return balances;
}

async function getYesterdayActivity(todayDate: string): Promise<{
  spent: number;
  earned: number;
  transactionCount: number;
}> {
  const db = await getDb();

  // Calculate yesterday's date
  const today = new Date(todayDate);
  today.setDate(today.getDate() - 1);
  const yesterdayDate = today.toISOString().split('T')[0];

  const txs = await db.query.transactions.findMany({
    where: eq(transactions.date, yesterdayDate),
  });

  let spent = 0;
  let earned = 0;

  for (const tx of txs) {
    if (tx.amountCents < 0) {
      spent += Math.abs(tx.amountCents);
    } else {
      earned += tx.amountCents;
    }
  }

  return {
    spent,
    earned,
    transactionCount: txs.length,
  };
}

async function getUpcomingBills(
  fromDate: string,
  daysAhead: number
): Promise<UpcomingBill[]> {
  const db = await getDb();

  const recurring = await db.query.recurringTransactions.findMany({
    where: and(
      eq(recurringTransactions.status, 'active'),
      eq(recurringTransactions.type, 'expense')
    ),
  });

  const bills: UpcomingBill[] = [];
  const today = new Date(fromDate);
  const endDate = new Date(fromDate);
  endDate.setDate(endDate.getDate() + daysAhead);

  for (const rec of recurring) {
    if (rec.nextExpectedDate) {
      const dueDate = new Date(rec.nextExpectedDate);
      if (dueDate >= today && dueDate <= endDate) {
        const daysUntilDue = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        bills.push({
          id: rec.id,
          name: rec.name,
          amountCents: Math.abs(rec.expectedAmountCents),
          dueDate: rec.nextExpectedDate,
          daysUntilDue,
        });
      }
    }
  }

  // Also check debts with due dates
  const activeDebts = await db.query.debts.findMany({
    where: eq(debts.status, 'active'),
  });

  for (const debt of activeDebts) {
    if (debt.nextDueDate) {
      const dueDate = new Date(debt.nextDueDate);
      if (dueDate >= today && dueDate <= endDate) {
        const daysUntilDue = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        bills.push({
          id: debt.id,
          name: `${debt.name} (min payment)`,
          amountCents: debt.minimumPaymentCents || 0,
          dueDate: debt.nextDueDate,
          daysUntilDue,
        });
      }
    }
  }

  return bills.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

async function getActiveDebts() {
  const db = await getDb();
  return db.query.debts.findMany({
    where: eq(debts.status, 'active'),
  });
}

async function getActiveGoals() {
  const db = await getDb();
  return db.query.goals.findMany({
    where: eq(goals.status, 'active'),
  });
}

async function getLatestCashRunway() {
  const db = await getDb();
  const latest = await db.query.cashRunway.findFirst({
    orderBy: [desc(cashRunway.calculatedAt)],
  });
  return latest;
}

async function getCurrentMonthBudgetStatus(date: string) {
  const db = await getDb();
  const month = date.substring(0, 7); // YYYY-MM

  // Get all envelopes for this month
  const monthEnvelopes = await db.query.envelopes.findMany({
    where: eq(envelopes.month, month),
  });

  // Get spending per category for this month
  const startOfMonth = `${month}-01`;
  const endOfMonth = `${month}-31`;

  const categorySpending: Record<string, number> = {};

  const txs = await db.query.transactions.findMany({
    where: and(
      gte(transactions.date, startOfMonth),
      lte(transactions.date, endOfMonth)
    ),
  });

  for (const tx of txs) {
    if (tx.categoryId && tx.amountCents < 0) {
      categorySpending[tx.categoryId] =
        (categorySpending[tx.categoryId] || 0) + Math.abs(tx.amountCents);
    }
  }

  // Calculate budget status
  let totalBudgeted = 0;
  let totalSpent = 0;
  const overBudgetCategories: string[] = [];

  for (const envelope of monthEnvelopes) {
    totalBudgeted += envelope.budgetCents;
    const spent = categorySpending[envelope.categoryId] || 0;
    totalSpent += spent;

    if (spent > envelope.budgetCents) {
      overBudgetCategories.push(envelope.categoryId);
    }
  }

  return {
    totalBudgeted,
    totalSpent,
    remainingBudget: totalBudgeted - totalSpent,
    percentUsed: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
    overBudgetCategories,
  };
}

// ============================================================================
// WEATHER & CONTENT GENERATION
// ============================================================================

interface WeatherInputs {
  totalBalanceCents: number;
  cashRunwayDays: number | null;
  yesterdaySpentCents: number;
  billsDueCount: number;
  billsDueAmountCents: number;
  budgetStatus: {
    percentUsed: number;
    overBudgetCategories: string[];
  };
  activeDebts: Array<{ dangerScore: number | null }>;
}

function calculateFinancialWeather(inputs: WeatherInputs): FinancialWeather {
  const {
    totalBalanceCents,
    cashRunwayDays,
    billsDueCount,
    billsDueAmountCents,
    budgetStatus,
    activeDebts,
  } = inputs;

  // Calculate danger factors
  let dangerScore = 0;

  // Low balance danger
  if (totalBalanceCents < 0) {
    dangerScore += 40;
  } else if (totalBalanceCents < 10000) {
    // Less than $100
    dangerScore += 25;
  } else if (totalBalanceCents < 50000) {
    // Less than $500
    dangerScore += 10;
  }

  // Cash runway danger
  if (cashRunwayDays !== null) {
    if (cashRunwayDays < 7) {
      dangerScore += 30;
    } else if (cashRunwayDays < 14) {
      dangerScore += 15;
    } else if (cashRunwayDays < 30) {
      dangerScore += 5;
    }
  }

  // Bills due danger
  if (billsDueCount > 0 && billsDueAmountCents > totalBalanceCents) {
    dangerScore += 20;
  } else if (billsDueCount > 3) {
    dangerScore += 10;
  }

  // Budget status danger
  if (budgetStatus.percentUsed > 100) {
    dangerScore += 15;
  } else if (budgetStatus.percentUsed > 80) {
    dangerScore += 5;
  }

  // Debt danger
  const highDangerDebts = activeDebts.filter(
    (d) => d.dangerScore && d.dangerScore > 70
  );
  if (highDangerDebts.length > 0) {
    dangerScore += 10;
  }

  // Determine weather based on danger score
  if (dangerScore >= 60) {
    return {
      emoji: '⛈️',
      headline: 'Financial Storm Alert',
      description:
        'Critical attention needed. Multiple financial concerns require immediate action.',
      riskLevel: 'stormy',
    };
  } else if (dangerScore >= 40) {
    return {
      emoji: '🌧️',
      headline: 'Rainy Day Finances',
      description: 'Some challenges ahead. Stay cautious with spending.',
      riskLevel: 'rainy',
    };
  } else if (dangerScore >= 20) {
    return {
      emoji: '☁️',
      headline: 'Cloudy with Caution',
      description: 'Things are okay but keep an eye on your finances.',
      riskLevel: 'cloudy',
    };
  } else if (dangerScore >= 10) {
    return {
      emoji: '⛅',
      headline: 'Partly Sunny',
      description: 'Mostly good shape with a few things to watch.',
      riskLevel: 'partly_cloudy',
    };
  } else {
    return {
      emoji: '☀️',
      headline: 'Clear Financial Skies',
      description: 'Looking great! Keep up the good work.',
      riskLevel: 'sunny',
    };
  }
}

interface CoachingInputs {
  weather: FinancialWeather;
  accountBalances: AccountBalance[];
  yesterdayActivity: { spent: number; earned: number };
  upcomingBills: UpcomingBill[];
  activeDebts: Array<{
    name: string;
    aprPercent: number;
    dangerScore: number | null;
  }>;
  activeGoals: Array<{ name: string; progressPercent: number }>;
  budgetStatus: { percentUsed: number; remainingBudget: number };
}

function generateCoachingTips(inputs: CoachingInputs): string[] {
  const tips: string[] = [];
  const { weather, upcomingBills, activeDebts, activeGoals, budgetStatus } =
    inputs;

  // Weather-based tips
  if (weather.riskLevel === 'stormy' || weather.riskLevel === 'rainy') {
    tips.push(
      'Consider postponing non-essential purchases until finances stabilize.'
    );
  }

  // Bill-based tips
  if (upcomingBills.length > 0) {
    const nextBill = upcomingBills[0];
    if (nextBill.daysUntilDue <= 1) {
      tips.push(
        `${nextBill.name} is due today or tomorrow. Make sure you have funds ready.`
      );
    }
  }

  // Debt-based tips
  const highAprDebts = activeDebts.filter((d) => d.aprPercent > 20);
  if (highAprDebts.length > 0) {
    tips.push(
      `High-interest debt alert: ${highAprDebts[0].name} at ${highAprDebts[0].aprPercent}% APR. Even small extra payments help!`
    );
  }

  // Goal-based tips
  const nearGoals = activeGoals.filter((g) => g.progressPercent > 80);
  if (nearGoals.length > 0) {
    tips.push(
      `You're ${nearGoals[0].progressPercent.toFixed(0)}% toward "${nearGoals[0].name}"! Keep going!`
    );
  }

  // Budget-based tips
  if (budgetStatus.percentUsed < 50) {
    tips.push("You're on track with your budget this month. Great discipline!");
  } else if (budgetStatus.percentUsed > 80 && budgetStatus.percentUsed < 100) {
    tips.push(
      'Budget is getting tight. Consider where you can cut back for the rest of the month.'
    );
  }

  // Default tip if none generated
  if (tips.length === 0) {
    tips.push('Keep tracking your expenses to stay on top of your finances!');
  }

  return tips.slice(0, 3); // Max 3 tips
}

interface WarningInputs {
  totalBalanceCents: number;
  cashRunwayDays: number | null;
  upcomingBills: UpcomingBill[];
  activeDebts: Array<{
    name: string;
    dangerScore: number | null;
    nextDueDate: string | null;
  }>;
  budgetStatus: { overBudgetCategories: string[] };
}

function generateWarnings(inputs: WarningInputs): string[] {
  const warnings: string[] = [];
  const {
    totalBalanceCents,
    cashRunwayDays,
    upcomingBills,
    activeDebts,
    budgetStatus,
  } = inputs;

  // Balance warnings
  if (totalBalanceCents < 0) {
    warnings.push(
      '⚠️ Your balance is negative. Take immediate action to avoid fees.'
    );
  } else if (totalBalanceCents < 10000) {
    warnings.push('⚠️ Balance below $100. Be very careful with spending.');
  }

  // Cash runway warnings
  if (cashRunwayDays !== null && cashRunwayDays < 7) {
    warnings.push(
      `⚠️ Only ${cashRunwayDays} days of runway left at current spending rate.`
    );
  }

  // Bill coverage warnings
  const totalBillsDue = upcomingBills.reduce(
    (sum, b) => sum + b.amountCents,
    0
  );
  if (totalBillsDue > totalBalanceCents) {
    warnings.push(
      '⚠️ Upcoming bills exceed current balance. Prioritize essential payments.'
    );
  }

  // Debt warnings
  const dangerDebts = activeDebts.filter(
    (d) => d.dangerScore && d.dangerScore > 70
  );
  for (const debt of dangerDebts.slice(0, 2)) {
    warnings.push(
      `⚠️ ${debt.name} has a high danger score. Consider accelerating payoff.`
    );
  }

  // Budget warnings
  if (budgetStatus.overBudgetCategories.length > 0) {
    warnings.push(
      `⚠️ ${budgetStatus.overBudgetCategories.length} budget categories are over limit.`
    );
  }

  return warnings.slice(0, 4); // Max 4 warnings
}

interface OpportunityInputs {
  yesterdayActivity: { spent: number; earned: number };
  activeGoals: Array<{ name: string; progressPercent: number }>;
  budgetStatus: { remainingBudget: number };
  totalBalanceCents: number;
}

function generateOpportunities(inputs: OpportunityInputs): string[] {
  const opportunities: string[] = [];
  const { yesterdayActivity, activeGoals, budgetStatus, totalBalanceCents } =
    inputs;

  // Savings opportunities
  if (yesterdayActivity.spent === 0) {
    opportunities.push(
      '💡 No-spend day yesterday! Consider making it a streak.'
    );
  }

  // Budget surplus opportunity
  if (budgetStatus.remainingBudget > 50000) {
    // More than $500 left
    opportunities.push(
      '💡 Budget surplus this month! Consider putting extra toward savings or debt.'
    );
  }

  // Goal acceleration
  const nearGoals = activeGoals.filter(
    (g) => g.progressPercent > 50 && g.progressPercent < 90
  );
  if (nearGoals.length > 0) {
    opportunities.push(
      `💡 "${nearGoals[0].name}" is over halfway done. A small boost could accelerate completion.`
    );
  }

  // High balance opportunity
  if (totalBalanceCents > 500000) {
    // More than $5000
    opportunities.push(
      "💡 Strong balance! Consider opening a high-yield savings account if you haven't."
    );
  }

  return opportunities.slice(0, 3); // Max 3 opportunities
}

function generateSummaryText(inputs: {
  weather: FinancialWeather;
  totalBalanceCents: number;
  yesterdayActivity: { spent: number; earned: number };
  billsDueToday: UpcomingBill[];
  cashRunwayDays: number | null;
}): string {
  const {
    weather,
    totalBalanceCents,
    yesterdayActivity,
    billsDueToday,
    cashRunwayDays,
  } = inputs;

  const balanceFormatted = formatCurrency(totalBalanceCents);
  const spentFormatted = formatCurrency(yesterdayActivity.spent);

  let summary = `${weather.emoji} ${weather.headline}\n\n`;
  summary += `Current balance: ${balanceFormatted}\n`;

  if (cashRunwayDays !== null) {
    summary += `Cash runway: ${cashRunwayDays} days\n`;
  }

  if (yesterdayActivity.spent > 0 || yesterdayActivity.earned > 0) {
    summary += `\nYesterday: `;
    if (yesterdayActivity.spent > 0) {
      summary += `Spent ${spentFormatted}`;
    }
    if (yesterdayActivity.earned > 0) {
      summary += `${yesterdayActivity.spent > 0 ? ', ' : ''}Earned ${formatCurrency(yesterdayActivity.earned)}`;
    }
    summary += '\n';
  }

  if (billsDueToday.length > 0) {
    summary += `\n📅 ${billsDueToday.length} bill(s) due today/tomorrow totaling ${formatCurrency(
      billsDueToday.reduce((sum, b) => sum + b.amountCents, 0)
    )}`;
  }

  return summary;
}

function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

function determineRiskLevelFromEmoji(
  emoji: string
): 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy' {
  switch (emoji) {
    case '☀️':
      return 'sunny';
    case '⛅':
      return 'partly_cloudy';
    case '☁️':
      return 'cloudy';
    case '🌧️':
      return 'rainy';
    case '⛈️':
      return 'stormy';
    default:
      return 'cloudy';
  }
}

/**
 * Mark a summary as sent (for push notification tracking)
 */
export async function markSummaryAsSent(summaryId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(dailySummaries)
    .set({ sentAt: Date.now() })
    .where(eq(dailySummaries.id, summaryId));
}

/**
 * Mark a summary as opened (for engagement tracking)
 */
export async function markSummaryAsOpened(summaryId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(dailySummaries)
    .set({ openedAt: Date.now() })
    .where(eq(dailySummaries.id, summaryId));
}

/**
 * Calculate and store cash runway data
 * This should be called periodically to keep runway data fresh
 */
export async function updateCashRunway(): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  // Get current balance
  const accountBalances = await getAccountBalances();
  const currentBalance = accountBalances.reduce(
    (sum, acc) => sum + acc.balanceCents,
    0
  );

  // Calculate daily burn rate from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const recentTxs = await db.query.transactions.findMany({
    where: and(
      gte(transactions.date, thirtyDaysAgoStr),
      lte(transactions.date, today)
    ),
  });

  let totalSpent = 0;
  for (const tx of recentTxs) {
    if (tx.amountCents < 0) {
      totalSpent += Math.abs(tx.amountCents);
    }
  }

  const dailyBurnRate = Math.round(totalSpent / 30);
  const weeklyBurnRate = dailyBurnRate * 7;

  // Get upcoming bills (next 30 days)
  const upcomingBills = await getUpcomingBills(today, 30);
  const upcomingBillsTotal = upcomingBills.reduce(
    (sum, b) => sum + b.amountCents,
    0
  );

  // Calculate days until zero
  let daysUntilZero: number | null = null;
  let zeroDate: string | null = null;

  if (dailyBurnRate > 0) {
    daysUntilZero = Math.floor(currentBalance / dailyBurnRate);
    if (daysUntilZero > 0) {
      const zeroDateObj = new Date();
      zeroDateObj.setDate(zeroDateObj.getDate() + daysUntilZero);
      zeroDate = zeroDateObj.toISOString().split('T')[0];
    }
  }

  // Calculate safe to spend
  const safeToSpendToday =
    Math.max(0, currentBalance - upcomingBillsTotal) / 30;
  const safeToSpendWeek = safeToSpendToday * 7;

  // Save to database
  await db.insert(cashRunway).values({
    id: nanoid(),
    currentBalanceCents: currentBalance,
    calculatedAt: now,
    daysUntilZero,
    zeroDate,
    dailyBurnRateCents: dailyBurnRate,
    weeklyBurnRateCents: weeklyBurnRate,
    upcomingBillsCents: upcomingBillsTotal,
    upcomingBillsCount: upcomingBills.length,
    safeToSpendTodayCents: Math.round(safeToSpendToday),
    safeToSpendWeekCents: Math.round(safeToSpendWeek),
    createdAt: now,
  });
}
