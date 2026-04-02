'use client';

import { useMemo } from 'react';
import type { Transaction, Category } from '@/lib/api';

// ─── Spending personality archetypes (pattern-based, NOT balance-based) ───

interface SpendingProfile {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  strengths: string[];
  blindSpots: string[];
  bookRec: string;
}

const PROFILES = {
  disciplined_saver: {
    id: 'disciplined_saver',
    name: 'The Disciplined Saver',
    emoji: '🏦',
    tagline: 'Steady hand, strong foundation',
    description:
      'You consistently spend less than you earn and keep non-essential spending in check. Your habits build wealth over time.',
    strengths: [
      'Strong savings habit',
      'Low impulse spending',
      'Bills always covered',
    ],
    blindSpots: [
      'May under-invest in experiences',
      'Could miss growth opportunities',
    ],
    bookRec: '"Die With Zero" by Bill Perkins — balance saving with living',
  },
  mindful_spender: {
    id: 'mindful_spender',
    name: 'The Mindful Spender',
    emoji: '🧘',
    tagline: 'Intentional with every dollar',
    description:
      "You spend on what matters and cut what doesn't. Most of your money goes to essentials and planned categories.",
    strengths: ['Balanced budget', 'Intentional choices', 'Low waste'],
    blindSpots: [
      'May overthink small purchases',
      'Could benefit from automating more',
    ],
    bookRec:
      '"I Will Teach You to Be Rich" by Ramit Sethi — spend guilt-free on what you love',
  },
  lifestyle_spender: {
    id: 'lifestyle_spender',
    name: 'The Lifestyle Spender',
    emoji: '🛍️',
    tagline: 'Living large, saving later',
    description:
      'A significant portion of your income goes to dining, entertainment, and shopping. You enjoy the present but may want to plan for tomorrow.',
    strengths: ['Enjoys life', 'Social connections', 'Experiences over things'],
    blindSpots: [
      'Savings rate is low',
      'Vulnerable to income disruptions',
      'Lifestyle creep risk',
    ],
    bookRec:
      '"The Psychology of Money" by Morgan Housel — wealth is what you don\'t spend',
  },
  debt_warrior: {
    id: 'debt_warrior',
    name: 'The Debt Warrior',
    emoji: '⚔️',
    tagline: 'Fighting to break free',
    description:
      "A large share of your spending goes to loan payments and credit card bills. You're working hard to get out of debt.",
    strengths: [
      'Committed to debt payoff',
      'Disciplined repayment',
      'Aware of obligations',
    ],
    blindSpots: [
      'May not have emergency buffer',
      'Debt fatigue risk',
      'Need to build savings alongside',
    ],
    bookRec:
      '"The Total Money Makeover" by Dave Ramsey — baby steps to freedom',
  },
  essentials_first: {
    id: 'essentials_first',
    name: 'The Essentials-First',
    emoji: '🏠',
    tagline: 'Needs before wants',
    description:
      'Nearly all your spending covers necessities — housing, utilities, groceries, insurance. You keep discretionary spending minimal.',
    strengths: [
      'Needs are covered',
      'Low financial risk',
      'Responsible priorities',
    ],
    blindSpots: [
      'May feel restricted',
      'Important to allow some joy spending',
      'Watch for burnout',
    ],
    bookRec:
      '"Your Money or Your Life" by Vicki Robin — align spending with your values',
  },
  foodie: {
    id: 'foodie',
    name: 'The Foodie',
    emoji: '🍽️',
    tagline: 'The way to your wallet is through your stomach',
    description:
      'Dining out and food delivery make up a large chunk of your spending. Great taste, but it adds up fast.',
    strengths: [
      'Social life',
      'Culinary experiences',
      'Supporting local businesses',
    ],
    blindSpots: [
      'Eating out costs 3-5x home cooking',
      'Small daily amounts compound',
      'Meal planning saves big',
    ],
    bookRec:
      '"The Automatic Millionaire" by David Bach — the latte factor is real',
  },
  optimizer: {
    id: 'optimizer',
    name: 'The Optimizer',
    emoji: '📊',
    tagline: 'Every cent has a purpose',
    description:
      'You track everything, spend efficiently across categories, and keep a healthy balance. Your financial game is strong.',
    strengths: [
      'Full financial awareness',
      'Balanced across categories',
      'Strong saving rate',
    ],
    blindSpots: [
      "Don't let tracking become obsession",
      "It's okay to splurge sometimes",
    ],
    bookRec:
      '"The Simple Path to Wealth" by JL Collins — simplicity beats complexity',
  },
  getting_started: {
    id: 'getting_started',
    name: 'The Fresh Start',
    emoji: '🌱',
    tagline: 'Every journey starts with a single step',
    description:
      "You're just beginning to track your finances. Keep adding transactions and you'll unlock deeper insights soon!",
    strengths: [
      'Taking the first step',
      'Building awareness',
      'Open to learning',
    ],
    blindSpots: ['Need more data for patterns', 'Consistency is key'],
    bookRec:
      '"Get Good with Money" by Tiffany Aliche — build your financial wholeness',
  },
};

// ─── Category pattern keywords for classification ───

const ESSENTIAL_KEYWORDS = [
  'rent',
  'mortgage',
  'utilities',
  'water',
  'electric',
  'gas',
  'insurance',
  'grocery',
  'groceries',
  'health',
  'medical',
  'medication',
  'transport',
  'fuel',
  'phone',
  'internet',
  'loan',
  'payment',
  'life insurance',
];

const DINING_KEYWORDS = [
  'restaurant',
  'dining',
  'food',
  'eat',
  'delivery',
  'uber eats',
  'doordash',
  'rappi',
  'coffee',
  'cafe',
  'bar',
  'takeout',
];

const LIFESTYLE_KEYWORDS = [
  'shopping',
  'clothes',
  'clothing',
  'entertainment',
  'streaming',
  'subscription',
  'gym',
  'travel',
  'vacation',
  'hobby',
  'electronics',
  'amazon',
  'luxury',
];

const DEBT_KEYWORDS = [
  'loan',
  'credit card',
  'debt',
  'payment',
  'mortgage',
  'interest',
  'student loan',
  'car loan',
  'auto loan',
];

function matchesKeywords(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// ─── Analysis engine ───

interface FinancialAnalysis {
  profile: SpendingProfile;
  savingsRate: number;
  essentialsPercent: number;
  diningPercent: number;
  lifestylePercent: number;
  debtPercent: number;
  topCategory: { name: string; emoji: string; percent: number } | null;
  transactionCount: number;
  avgTransactionSize: number;
  insights: string[];
  quote: string;
}

function analyzeFinances(
  transactions: Transaction[],
  categories: Category[]
): FinancialAnalysis {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const incomes = transactions.filter((t) => t.type === 'income');

  const totalIncome = incomes.reduce((s, t) => s + Math.abs(t.amountCents), 0);
  const totalExpenses = expenses.reduce(
    (s, t) => s + Math.abs(t.amountCents),
    0
  );

  // Not enough data
  if (expenses.length < 3) {
    return {
      profile: PROFILES.getting_started,
      savingsRate: 0,
      essentialsPercent: 0,
      diningPercent: 0,
      lifestylePercent: 0,
      debtPercent: 0,
      topCategory: null,
      transactionCount: transactions.length,
      avgTransactionSize: 0,
      insights: ['Keep adding transactions to unlock your financial profile!'],
      quote:
        '"The journey of a thousand miles begins with a single step." — Lao Tzu',
    };
  }

  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  // Classify spending by pattern
  let essentialsCents = 0;
  let diningCents = 0;
  let lifestyleCents = 0;
  let debtCents = 0;

  const categorySpending = new Map<string, number>();

  expenses.forEach((tx) => {
    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
    const name = cat?.name || tx.description;
    const amt = Math.abs(tx.amountCents);

    if (cat) {
      categorySpending.set(cat.id, (categorySpending.get(cat.id) || 0) + amt);
    }

    if (matchesKeywords(name, DEBT_KEYWORDS)) {
      debtCents += amt;
    } else if (matchesKeywords(name, ESSENTIAL_KEYWORDS)) {
      essentialsCents += amt;
    } else if (matchesKeywords(name, DINING_KEYWORDS)) {
      diningCents += amt;
    } else if (matchesKeywords(name, LIFESTYLE_KEYWORDS)) {
      lifestyleCents += amt;
    }
  });

  const essentialsPercent =
    totalExpenses > 0 ? (essentialsCents / totalExpenses) * 100 : 0;
  const diningPercent =
    totalExpenses > 0 ? (diningCents / totalExpenses) * 100 : 0;
  const lifestylePercent =
    totalExpenses > 0 ? (lifestyleCents / totalExpenses) * 100 : 0;
  const debtPercent = totalExpenses > 0 ? (debtCents / totalExpenses) * 100 : 0;
  const savingsRate =
    totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Top category
  let topCategory: FinancialAnalysis['topCategory'] = null;
  let maxSpend = 0;
  categorySpending.forEach((amount, catId) => {
    if (amount > maxSpend) {
      maxSpend = amount;
      const cat = categoryMap.get(catId);
      if (cat) {
        topCategory = {
          name: cat.name,
          emoji: cat.emoji || '📂',
          percent: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        };
      }
    }
  });

  const avgTransactionSize =
    expenses.length > 0
      ? expenses.reduce((s, t) => s + Math.abs(t.amountCents), 0) /
        expenses.length
      : 0;

  // ─── Profile selection (pattern-based, NOT balance-based) ───
  let profile: SpendingProfile;

  if (debtPercent > 35) {
    profile = PROFILES.debt_warrior;
  } else if (diningPercent > 25) {
    profile = PROFILES.foodie;
  } else if (lifestylePercent > 30) {
    profile = PROFILES.lifestyle_spender;
  } else if (essentialsPercent > 70) {
    profile = PROFILES.essentials_first;
  } else if (savingsRate > 30 && lifestylePercent < 15 && diningPercent < 10) {
    profile = PROFILES.disciplined_saver;
  } else if (
    savingsRate > 10 &&
    essentialsPercent > 40 &&
    lifestylePercent < 20 &&
    diningPercent < 15
  ) {
    profile = PROFILES.mindful_spender;
  } else if (savingsRate > 15 && expenses.length > 10) {
    profile = PROFILES.optimizer;
  } else {
    profile = PROFILES.mindful_spender;
  }

  // ─── Generate insights ───
  const insights: string[] = [];

  if (savingsRate > 20) {
    insights.push(
      `You're saving ${savingsRate.toFixed(0)}% of your income this month — that's above the recommended 20%.`
    );
  } else if (savingsRate > 0) {
    insights.push(
      `You're saving ${savingsRate.toFixed(0)}% of your income. Aim for 20% to build a strong buffer.`
    );
  } else if (totalIncome > 0) {
    insights.push(
      "You're spending more than you earn this month. Look for areas to cut back."
    );
  }

  if (diningPercent > 20) {
    insights.push(
      `${diningPercent.toFixed(0)}% of spending goes to dining/food out. Cooking at home 2 more meals/week could save you ~$${((diningCents * 0.3) / 100).toFixed(0)}/month.`
    );
  }

  if (essentialsPercent > 60) {
    insights.push(
      `${essentialsPercent.toFixed(0)}% goes to essentials — your needs are well covered.`
    );
  }

  if (debtPercent > 20) {
    insights.push(
      `${debtPercent.toFixed(0)}% of spending is debt payments. Consider the avalanche method to minimize interest.`
    );
  }

  if (topCategory && topCategory.percent > 30) {
    insights.push(
      `${topCategory.emoji} ${topCategory.name} is your biggest category at ${topCategory.percent.toFixed(0)}% of spending.`
    );
  }

  if (insights.length === 0) {
    insights.push(
      'Your spending looks balanced across categories. Keep it up!'
    );
  }

  // Quote selection
  const quotes = [
    '"Do not save what is left after spending, but spend what is left after saving." — Warren Buffett',
    '"Wealth is not about having a lot of money; it\'s about having a lot of options." — Chris Rock',
    '"The habit of saving is itself an education." — George Clason, The Richest Man in Babylon',
    '"Financial peace isn\'t the acquisition of stuff. It\'s learning to live on less than you make." — Dave Ramsey',
    '"Money is a terrible master but an excellent servant." — P.T. Barnum',
    '"It\'s not how much money you make, but how much you keep." — Robert Kiyosaki',
    '"Compound interest is the eighth wonder of the world." — Albert Einstein',
  ];
  const quote = quotes[Math.floor(expenses.length % quotes.length)];

  return {
    profile,
    savingsRate,
    essentialsPercent,
    diningPercent,
    lifestylePercent,
    debtPercent,
    topCategory,
    transactionCount: transactions.length,
    avgTransactionSize,
    insights,
    quote,
  };
}

// ─── Component ───

interface FinancialInsightsProps {
  transactions: Transaction[];
  categories: Category[];
  isLoading: boolean;
}

export function FinancialInsights({
  transactions,
  categories,
  isLoading,
}: FinancialInsightsProps) {
  const analysis = useMemo(
    () => analyzeFinances(transactions, categories),
    [transactions, categories]
  );

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-48" />
          <div className="h-20 bg-gray-800 rounded" />
          <div className="h-4 bg-gray-800 rounded w-64" />
        </div>
      </div>
    );
  }

  const { profile, savingsRate, insights, quote, topCategory } = analysis;

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 overflow-hidden">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-purple-500/10 border-b border-gray-800 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center">
            <span className="text-3xl sm:text-4xl">{profile.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-purple-400 font-medium uppercase tracking-wider mb-0.5">
              Your Financial Profile
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              {profile.name}
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">{profile.tagline}</p>
          </div>
        </div>
        <p className="text-sm text-gray-300 mt-3 leading-relaxed">
          {profile.description}
        </p>
      </div>

      {/* Spending Breakdown Bar */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">
          Spending Pattern
        </p>
        <div className="h-3 rounded-full bg-gray-800 overflow-hidden flex">
          {analysis.essentialsPercent > 0 && (
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${analysis.essentialsPercent}%` }}
              title={`Essentials: ${analysis.essentialsPercent.toFixed(0)}%`}
            />
          )}
          {analysis.debtPercent > 0 && (
            <div
              className="bg-orange-500 transition-all"
              style={{ width: `${analysis.debtPercent}%` }}
              title={`Debt: ${analysis.debtPercent.toFixed(0)}%`}
            />
          )}
          {analysis.diningPercent > 0 && (
            <div
              className="bg-pink-500 transition-all"
              style={{ width: `${analysis.diningPercent}%` }}
              title={`Dining: ${analysis.diningPercent.toFixed(0)}%`}
            />
          )}
          {analysis.lifestylePercent > 0 && (
            <div
              className="bg-purple-500 transition-all"
              style={{ width: `${analysis.lifestylePercent}%` }}
              title={`Lifestyle: ${analysis.lifestylePercent.toFixed(0)}%`}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {analysis.essentialsPercent > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Essentials {analysis.essentialsPercent.toFixed(0)}%
            </span>
          )}
          {analysis.debtPercent > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              Debt {analysis.debtPercent.toFixed(0)}%
            </span>
          )}
          {analysis.diningPercent > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-pink-500" />
              Dining {analysis.diningPercent.toFixed(0)}%
            </span>
          )}
          {analysis.lifestylePercent > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Lifestyle {analysis.lifestylePercent.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-800">
        <div className="bg-gray-950 p-3 sm:p-4 text-center">
          <p className="text-lg sm:text-xl font-bold text-white">
            {savingsRate > 0 ? '+' : ''}
            {savingsRate.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500">Savings Rate</p>
        </div>
        <div className="bg-gray-950 p-3 sm:p-4 text-center">
          <p className="text-lg sm:text-xl font-bold text-white">
            {analysis.transactionCount}
          </p>
          <p className="text-xs text-gray-500">Transactions</p>
        </div>
        {topCategory && (
          <div className="bg-gray-950 p-3 sm:p-4 text-center col-span-2 sm:col-span-1">
            <p className="text-lg sm:text-xl font-bold text-white">
              {topCategory.emoji} {topCategory.percent.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500">{topCategory.name}</p>
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="p-4 sm:p-6 space-y-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
          Insights
        </p>
        <ul className="space-y-2.5">
          {insights.map((insight, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="text-cyan-400 flex-shrink-0 mt-0.5">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <span className="text-gray-300">{insight}</span>
            </li>
          ))}
        </ul>

        {/* Strengths & Blind Spots */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
            <p className="text-xs text-green-400 font-medium mb-2">Strengths</p>
            <ul className="space-y-1">
              {profile.strengths.map((s, i) => (
                <li
                  key={i}
                  className="text-xs text-gray-400 flex items-center gap-1.5"
                >
                  <span className="text-green-500">+</span> {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs text-amber-400 font-medium mb-2">Watch For</p>
            <ul className="space-y-1">
              {profile.blindSpots.map((b, i) => (
                <li
                  key={i}
                  className="text-xs text-gray-400 flex items-center gap-1.5"
                >
                  <span className="text-amber-500">!</span> {b}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Book Recommendation */}
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 mt-3">
          <p className="text-xs text-purple-400 font-medium mb-1">
            Recommended Reading
          </p>
          <p className="text-sm text-gray-300">{profile.bookRec}</p>
        </div>

        {/* Quote */}
        <blockquote className="border-l-2 border-cyan-500/30 pl-3 mt-4">
          <p className="text-xs text-gray-500 italic">{quote}</p>
        </blockquote>
      </div>
    </div>
  );
}
