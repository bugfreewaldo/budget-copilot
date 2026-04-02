import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { colors } from '../../src/theme/colors';
import { api } from '../../src/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledBill {
  id: string;
  name: string;
  type: string;
  amountCents: number;
  dueDay: number;
  frequency: string;
  status: string;
  nextDueDate: string;
  autoPay: boolean;
  isVariable: boolean;
  amountHistory: string | null;
  notes: string | null;
}

interface ScheduledIncome {
  id: string;
  name: string;
  source: string;
  amountCents: number;
  payDay: number;
  frequency: string;
  status: string;
  nextPayDate: string;
  isVariable: boolean;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_EMOJIS: Record<string, string> = {
  mortgage: '\u{1F3E0}',
  rent: '\u{1F3E2}',
  auto_loan: '\u{1F697}',
  credit_card: '\u{1F4B3}',
  personal_loan: '\u{1F4B0}',
  student_loan: '\u{1F393}',
  utility: '\u{1F4A1}',
  insurance: '\u{1F6E1}\uFE0F',
  subscription: '\u{1F4FA}',
  other: '\u{1F4DD}',
};

const SOURCE_EMOJIS: Record<string, string> = {
  salary: '\u{1F4BC}',
  freelance: '\u{1F4BB}',
  business: '\u{1F3EA}',
  investment: '\u{1F4C8}',
  rental: '\u{1F3E0}',
  side_hustle: '\u{1F319}',
  bonus: '\u{1F381}',
};

const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  weekly: 4,
  biweekly: 2,
  semimonthly: 2,
  monthly: 1,
  quarterly: 1 / 3,
  annually: 1 / 12,
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  semimonthly: 'Semi-monthly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseAmountHistory(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function monthlyAmount(cents: number, frequency: string): number {
  const mult = FREQUENCY_MULTIPLIERS[frequency] ?? 1;
  return cents * mult;
}

function ordinalDay(day: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  return `${day}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type Tab = 'expenses' | 'income';

function SummaryBar({
  totalBills,
  totalIncome,
}: {
  totalBills: number;
  totalIncome: number;
}) {
  const net = totalIncome - totalBills;

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Monthly Bills</Text>
        <Text style={[styles.summaryValue, { color: colors.red[400] }]}>
          {formatCurrency(totalBills)}
        </Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Monthly Income</Text>
        <Text style={[styles.summaryValue, { color: colors.green[400] }]}>
          {formatCurrency(totalIncome)}
        </Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Net Balance</Text>
        <Text
          style={[
            styles.summaryValue,
            { color: net >= 0 ? colors.green[400] : colors.red[400] },
          ]}
        >
          {net >= 0 ? '+' : ''}
          {formatCurrency(net)}
        </Text>
      </View>
    </View>
  );
}

function TabToggle({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, active === 'expenses' && styles.tabActive]}
        onPress={() => onSelect('expenses')}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.tabText,
            active === 'expenses' && styles.tabTextActive,
          ]}
        >
          Expenses
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, active === 'income' && styles.tabActive]}
        onPress={() => onSelect('income')}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.tabText, active === 'income' && styles.tabTextActive]}
        >
          Income
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function BillCard({ bill }: { bill: ScheduledBill }) {
  const emoji = TYPE_EMOJIS[bill.type] || TYPE_EMOJIS.other;
  const history = parseAmountHistory(bill.amountHistory);
  const hasHistory = bill.isVariable && history.length > 0;
  const min = hasHistory ? Math.min(...history) : 0;
  const max = hasHistory ? Math.max(...history) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {bill.name}
            </Text>
            {bill.autoPay && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Auto-pay</Text>
              </View>
            )}
            {bill.isVariable && (
              <View style={[styles.badge, styles.variableBadge]}>
                <Text style={[styles.badgeText, styles.variableBadgeText]}>
                  Variable
                </Text>
              </View>
            )}
          </View>
          <View style={styles.cardDetails}>
            <Text style={styles.cardFrequency}>
              {FREQUENCY_LABELS[bill.frequency] || bill.frequency} &middot; Due{' '}
              {ordinalDay(bill.dueDay)}
            </Text>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    bill.status === 'active'
                      ? colors.green[400]
                      : colors.gray[500],
                },
              ]}
            />
          </View>
          {hasHistory && (
            <Text style={styles.cardRange}>
              Range: {formatCurrency(min)} - {formatCurrency(max)}
            </Text>
          )}
        </View>
        <Text style={[styles.cardAmount, { color: colors.red[400] }]}>
          {bill.isVariable ? '~' : ''}
          {formatCurrency(
            hasHistory ? Math.round(average(history)) : bill.amountCents
          )}
        </Text>
      </View>
    </View>
  );
}

function IncomeCard({ income }: { income: ScheduledIncome }) {
  const emoji = SOURCE_EMOJIS[income.source] || '\u{1F4B5}';

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {income.name}
            </Text>
            {income.isVariable && (
              <View style={[styles.badge, styles.variableBadge]}>
                <Text style={[styles.badgeText, styles.variableBadgeText]}>
                  Variable
                </Text>
              </View>
            )}
          </View>
          <View style={styles.cardDetails}>
            <Text style={styles.cardFrequency}>
              {FREQUENCY_LABELS[income.frequency] || income.frequency} &middot;
              Pay day {ordinalDay(income.payDay)}
            </Text>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    income.status === 'active'
                      ? colors.green[400]
                      : colors.gray[500],
                },
              ]}
            />
          </View>
        </View>
        <Text style={[styles.cardAmount, { color: colors.green[400] }]}>
          {formatCurrency(income.amountCents)}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({ type }: { type: Tab }) {
  const isExpenses = type === 'expenses';
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>
        {isExpenses ? '\u{1F4CB}' : '\u{1F4B8}'}
      </Text>
      <Text style={styles.emptyTitle}>
        {isExpenses ? 'No Recurring Bills' : 'No Recurring Income'}
      </Text>
      <Text style={styles.emptyText}>
        {isExpenses
          ? 'Add your recurring bills to track monthly expenses'
          : 'Add your income sources to track monthly earnings'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function RecurringScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [bills, setBills] = useState<ScheduledBill[]>([]);
  const [incomes, setIncomes] = useState<ScheduledIncome[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [billsRes, incomeRes] = await Promise.all([
        api.getScheduledBills(),
        api.getScheduledIncome(),
      ]);
      setBills(billsRes.data);
      setIncomes(incomeRes.data);
    } catch {
      // silently fail — user can pull to refresh
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const totalMonthlyBills = useMemo(() => {
    return bills.reduce((sum, b) => {
      const history = parseAmountHistory(b.amountHistory);
      const cents =
        b.isVariable && history.length > 0
          ? Math.round(average(history))
          : b.amountCents;
      return sum + monthlyAmount(cents, b.frequency);
    }, 0);
  }, [bills]);

  const totalMonthlyIncome = useMemo(() => {
    return incomes.reduce((sum, i) => {
      return sum + monthlyAmount(i.amountCents, i.frequency);
    }, 0);
  }, [incomes]);

  const renderBill = useCallback(
    ({ item }: { item: ScheduledBill }) => <BillCard bill={item} />,
    []
  );

  const renderIncome = useCallback(
    ({ item }: { item: ScheduledIncome }) => <IncomeCard income={item} />,
    []
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SummaryBar
        totalBills={totalMonthlyBills}
        totalIncome={totalMonthlyIncome}
      />
      <TabToggle active={activeTab} onSelect={setActiveTab} />

      {activeTab === 'expenses' ? (
        bills.length === 0 ? (
          <EmptyState type="expenses" />
        ) : (
          <FlatList
            data={bills}
            keyExtractor={(item) => item.id}
            renderItem={renderBill}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.cyan[400]}
              />
            }
          />
        )
      ) : incomes.length === 0 ? (
        <EmptyState type="income" />
      ) : (
        <FlatList
          data={incomes}
          keyExtractor={(item) => item.id}
          renderItem={renderIncome}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.cyan[400]}
            />
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[950],
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.gray[400],
    fontSize: 16,
  },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.gray[900],
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.gray[800],
  },
  summaryLabel: {
    color: colors.gray[400],
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Tab toggle
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: colors.gray[900],
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.cyan[600],
  },
  tabText: {
    color: colors.gray[400],
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.white,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },

  // Card
  card: {
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardFrequency: {
    color: colors.gray[400],
    fontSize: 13,
  },
  cardRange: {
    color: colors.yellow[400],
    fontSize: 12,
    marginTop: 2,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },

  // Badges
  badge: {
    backgroundColor: colors.cyan[600],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  variableBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.yellow[400],
  },
  variableBadgeText: {
    color: colors.yellow[400],
  },

  // Status dot
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 8,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.gray[400],
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
