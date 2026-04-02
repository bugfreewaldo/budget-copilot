import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { api, Debt, DebtSummary } from '../../src/lib/api';

const TYPE_EMOJIS: Record<string, string> = {
  credit_card: '\u{1F4B3}',
  personal_loan: '\u{1F4B0}',
  auto_loan: '\u{1F697}',
  mortgage: '\u{1F3E0}',
  student_loan: '\u{1F393}',
  medical: '\u{1F3E5}',
  other: '\u{1F4DD}',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function dangerColor(score: number | null): string {
  if (score === null || score <= 3) return colors.green[400];
  if (score <= 6) return colors.yellow[400];
  return colors.red[400];
}

function dangerLabel(score: number | null): string {
  if (score === null || score <= 3) return 'Safe';
  if (score <= 6) return 'Caution';
  return 'Danger';
}

export default function DebtsScreen() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDebts = useCallback(async () => {
    try {
      const res = await api.getDebts();
      setDebts(res.data);
      setSummary(res.summary);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDebts();
  }, [fetchDebts]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.cyan[400]} />
      </View>
    );
  }

  if (debts.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyIcon}>{'\u{1F389}'}</Text>
        <Text style={styles.emptyTitle}>Sin Deudas</Text>
        <Text style={styles.emptyText}>
          No tienes deudas registradas. Excelente!
        </Text>
      </View>
    );
  }

  const renderDebt = ({ item }: { item: Debt }) => {
    const emoji = TYPE_EMOJIS[item.type] || TYPE_EMOJIS.other;
    const dColor = dangerColor(item.dangerScore);
    const dLabel = dangerLabel(item.dangerScore);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.typeEmoji}>{emoji}</Text>
            <Text style={styles.debtName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <View
            style={[styles.dangerBadge, { backgroundColor: dColor + '22' }]}
          >
            <View style={[styles.dangerDot, { backgroundColor: dColor }]} />
            <Text style={[styles.dangerText, { color: dColor }]}>{dLabel}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Balance</Text>
            <Text style={styles.statValue}>
              {formatCents(item.currentBalanceCents)}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>APR</Text>
            <Text style={styles.statValue}>{item.aprPercent}%</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Pago Min.</Text>
            <Text style={styles.statValue}>
              {formatCents(item.minimumPaymentCents)}
            </Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  100,
                  item.originalBalanceCents > 0
                    ? ((item.originalBalanceCents - item.currentBalanceCents) /
                        item.originalBalanceCents) *
                        100
                    : 0
                )}%`,
                backgroundColor: colors.cyan[400],
              },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={debts}
        keyExtractor={(item) => item.id}
        renderItem={renderDebt}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.cyan[400]}
            colors={[colors.cyan[400]]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          summary ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Deuda Total</Text>
                <Text style={styles.summaryValue}>
                  {formatCents(summary.totalBalanceCents)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Pago Mensual</Text>
                <Text style={styles.summaryValue}>
                  {formatCents(summary.totalMinPaymentCents)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Activas</Text>
                <Text style={styles.summaryValue}>{summary.count}</Text>
              </View>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[950],
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    fontSize: 16,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gray[800],
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.gray[400],
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  typeEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  debtName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  dangerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dangerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  dangerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: colors.gray[400],
    fontSize: 14,
  },
  statValue: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray[800],
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
