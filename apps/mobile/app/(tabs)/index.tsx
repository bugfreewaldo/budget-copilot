import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { api, type Transaction, type Category } from '../../src/lib/api';

// ─── Financial Profile Types & Data ───

interface SpendingProfile {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
}

const PROFILES: Record<string, SpendingProfile> = {
  disciplined_saver: {
    id: 'disciplined_saver',
    name: 'The Disciplined Saver',
    emoji: '\u{1F3E6}',
    tagline: 'Steady hand, strong foundation',
  },
  mindful_spender: {
    id: 'mindful_spender',
    name: 'The Mindful Spender',
    emoji: '\u{1F9D8}',
    tagline: 'Intentional with every dollar',
  },
  lifestyle_spender: {
    id: 'lifestyle_spender',
    name: 'The Lifestyle Spender',
    emoji: '\u{1F6CD}\uFE0F',
    tagline: 'Living large, saving later',
  },
  debt_warrior: {
    id: 'debt_warrior',
    name: 'The Debt Warrior',
    emoji: '\u2694\uFE0F',
    tagline: 'Fighting to break free',
  },
  essentials_first: {
    id: 'essentials_first',
    name: 'The Essentials-First',
    emoji: '\u{1F3E0}',
    tagline: 'Needs before wants',
  },
  foodie: {
    id: 'foodie',
    name: 'The Foodie',
    emoji: '\u{1F37D}\uFE0F',
    tagline: 'The way to your wallet is through your stomach',
  },
  optimizer: {
    id: 'optimizer',
    name: 'The Optimizer',
    emoji: '\u{1F4CA}',
    tagline: 'Every cent has a purpose',
  },
  getting_started: {
    id: 'getting_started',
    name: 'The Fresh Start',
    emoji: '\u{1F331}',
    tagline: 'Every journey starts with a single step',
  },
};

// ─── Keyword Classification ───

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

// ─── Analysis Engine ───

interface FinancialAnalysis {
  profile: SpendingProfile;
  savingsRate: number;
  transactionCount: number;
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

  if (expenses.length < 3) {
    return {
      profile: PROFILES.getting_started,
      savingsRate: 0,
      transactionCount: transactions.length,
    };
  }

  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  let essentialsCents = 0;
  let diningCents = 0;
  let lifestyleCents = 0;
  let debtCents = 0;

  expenses.forEach((tx) => {
    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
    const name = cat?.name || tx.description;
    const amt = Math.abs(tx.amountCents);

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

  return {
    profile,
    savingsRate,
    transactionCount: transactions.length,
  };
}

// ─── Helpers ───

function formatCurrency(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function getMonthRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const from = `${year}-${pad(month + 1)}-01`;
  const to = `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`;

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const label = `${monthNames[month]} ${year}`;

  return { from, to, label };
}

// ─── Category bar colors ───

const CATEGORY_COLORS = [
  colors.cyan[400],
  colors.purple[400],
  colors.green[400],
  colors.red[400],
  colors.yellow[400],
];

// ─── Component ───

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [balanceCents, setBalanceCents] = useState(0);

  const { from, to, label: monthLabel } = useMemo(() => getMonthRange(), []);

  const fetchData = useCallback(async () => {
    try {
      const [txRes, balRes, catRes] = await Promise.all([
        api.getTransactions({ from, to }),
        api.getBalance(),
        api.getCategories({ flat: true, limit: 500 }),
      ]);

      setTransactions(txRes.data ?? []);
      setBalanceCents(balRes.data?.currentBalanceCents ?? 0);
      setCategories(catRes.data ?? []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ─── Computed values ───

  const income = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + Math.abs(t.amountCents), 0),
    [transactions]
  );

  const expenses = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + Math.abs(t.amountCents), 0),
    [transactions]
  );

  const balance = useMemo(() => income - expenses, [income, expenses]);

  const savingsRate = useMemo(
    () => (income > 0 ? ((income - expenses) / income) * 100 : 0),
    [income, expenses]
  );

  const topCategories = useMemo(() => {
    const expenseTxs = transactions.filter((t) => t.type === 'expense');
    const catMap = new Map<
      string,
      { name: string; emoji: string; totalCents: number }
    >();

    const categoryLookup = new Map<string, Category>();
    categories.forEach((c) => categoryLookup.set(c.id, c));

    expenseTxs.forEach((tx) => {
      const catId = tx.categoryId || '__uncategorized';
      const cat = tx.categoryId ? categoryLookup.get(tx.categoryId) : null;
      const existing = catMap.get(catId);
      if (existing) {
        existing.totalCents += Math.abs(tx.amountCents);
      } else {
        catMap.set(catId, {
          name: cat?.name || 'Uncategorized',
          emoji: cat?.emoji || '\u{1F4C2}',
          totalCents: Math.abs(tx.amountCents),
        });
      }
    });

    return Array.from(catMap.values())
      .sort((a, b) => b.totalCents - a.totalCents)
      .slice(0, 5);
  }, [transactions, categories]);

  const maxCategorySpend = useMemo(
    () => (topCategories.length > 0 ? topCategories[0].totalCents : 1),
    [topCategories]
  );

  const analysis = useMemo(
    () => analyzeFinances(transactions, categories),
    [transactions, categories]
  );

  // ─── Loading state ───

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.cyan[400]} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // ─── Savings rate message ───

  let savingsMessage: string;
  let savingsColor: string;
  if (savingsRate > 20) {
    savingsMessage = `Saving ${savingsRate.toFixed(0)}% of income — above the recommended 20%`;
    savingsColor = colors.green[400];
  } else if (savingsRate > 0) {
    savingsMessage = `Saving ${savingsRate.toFixed(0)}% of income — aim for 20%`;
    savingsColor = colors.yellow[400];
  } else {
    savingsMessage = 'Spending more than you earn this month';
    savingsColor = colors.red[400];
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.cyan[400]}
        />
      }
    >
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerMonth}>{monthLabel}</Text>
      </View>

      {/* ─── Summary Cards ─── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.summaryCardsContainer}
      >
        {/* Income */}
        <View style={styles.summaryCard}>
          <View
            style={[styles.summaryDot, { backgroundColor: colors.green[400] }]}
          />
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryAmount, { color: colors.green[400] }]}>
            +{formatCurrency(income)}
          </Text>
        </View>

        {/* Expenses */}
        <View style={styles.summaryCard}>
          <View
            style={[styles.summaryDot, { backgroundColor: colors.red[400] }]}
          />
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={[styles.summaryAmount, { color: colors.red[400] }]}>
            -{formatCurrency(expenses)}
          </Text>
        </View>

        {/* Balance */}
        <View style={styles.summaryCard}>
          <View
            style={[styles.summaryDot, { backgroundColor: colors.cyan[400] }]}
          />
          <Text style={styles.summaryLabel}>Balance</Text>
          <Text
            style={[
              styles.summaryAmount,
              { color: balance >= 0 ? colors.cyan[400] : colors.red[400] },
            ]}
          >
            {balance >= 0 ? '+' : '-'}
            {formatCurrency(balance)}
          </Text>
        </View>
      </ScrollView>

      {/* ─── Monthly Balance ─── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Monthly Balance</Text>
        <Text style={styles.monthlyBalanceAmount}>
          {balance >= 0 ? '+' : '-'}
          {formatCurrency(balance)}
        </Text>
        <Text style={[styles.savingsMessage, { color: savingsColor }]}>
          {savingsMessage}
        </Text>
      </View>

      {/* ─── Spending by Category ─── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Spending by Category</Text>
        {topCategories.length === 0 ? (
          <Text style={styles.emptyText}>No expenses this month</Text>
        ) : (
          <View style={styles.categoryList}>
            {topCategories.map((cat, index) => {
              const barWidth =
                maxCategorySpend > 0
                  ? (cat.totalCents / maxCategorySpend) * 100
                  : 0;
              const barColor = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
              return (
                <View key={cat.name + index} style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    <Text style={styles.categoryAmount}>
                      {formatCurrency(cat.totalCents)}
                    </Text>
                  </View>
                  <View style={styles.barBackground}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.max(barWidth, 2)}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ─── Financial Profile ─── */}
      <View style={styles.card}>
        <Text style={styles.profileLabel}>YOUR FINANCIAL PROFILE</Text>
        <View style={styles.profileHeader}>
          <View style={styles.profileEmojiContainer}>
            <Text style={styles.profileEmoji}>{analysis.profile.emoji}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{analysis.profile.name}</Text>
            <Text style={styles.profileTagline}>
              {analysis.profile.tagline}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {analysis.savingsRate > 0 ? '+' : ''}
              {analysis.savingsRate.toFixed(0)}%
            </Text>
            <Text style={styles.statLabel}>Savings Rate</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{analysis.transactionCount}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
        </View>
      </View>

      {/* Bottom spacer for tab bar */}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[950],
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.gray[950],
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.gray[400],
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerMonth: {
    color: colors.gray[400],
    fontSize: 14,
  },

  // Summary cards
  summaryCardsContainer: {
    gap: 12,
    paddingRight: 4,
  },
  summaryCard: {
    backgroundColor: colors.gray[900],
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray[800],
    width: 150,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  summaryLabel: {
    color: colors.gray[400],
    fontSize: 13,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '700',
  },

  // Card
  card: {
    backgroundColor: colors.gray[900],
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },

  // Section title
  sectionTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Monthly balance
  monthlyBalanceAmount: {
    color: colors.white,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  savingsMessage: {
    fontSize: 13,
  },

  // Category spending
  emptyText: {
    color: colors.gray[500],
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  categoryList: {
    gap: 14,
  },
  categoryRow: {
    gap: 6,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryEmoji: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  categoryName: {
    flex: 1,
    color: colors.gray[300],
    fontSize: 14,
  },
  categoryAmount: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  barBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray[800],
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },

  // Financial profile
  profileLabel: {
    color: colors.purple[400],
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  profileEmojiContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileEmoji: {
    fontSize: 28,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileTagline: {
    color: colors.gray[400],
    fontSize: 13,
    marginTop: 2,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.gray[950],
    borderRadius: 10,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.gray[800],
  },
  statValue: {
    color: colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: colors.gray[500],
    fontSize: 11,
    marginTop: 2,
  },
});
