import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { colors } from '../../src/theme/colors';

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Fetch dashboard data
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.cyan[500]}
        />
      }
    >
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance Total</Text>
        <Text style={styles.balanceAmount}>$0.00</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Ingresos</Text>
            <Text style={[styles.balanceItemAmount, styles.income]}>+$0.00</Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Gastos</Text>
            <Text style={[styles.balanceItemAmount, styles.expense]}>-$0.00</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        <View style={styles.quickActions}>
          <View style={styles.actionButton}>
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.actionLabel}>Agregar</Text>
          </View>
          <View style={styles.actionButton}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>Reportes</Text>
          </View>
          <View style={styles.actionButton}>
            <Text style={styles.actionIcon}>🎯</Text>
            <Text style={styles.actionLabel}>Metas</Text>
          </View>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Últimos Movimientos</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No hay movimientos recientes</Text>
          <Text style={styles.emptySubtext}>
            Conecta tu banco o agrega movimientos manualmente
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[950],
  },
  content: {
    padding: 16,
    gap: 24,
  },
  balanceCard: {
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  balanceLabel: {
    color: colors.gray[400],
    fontSize: 14,
    marginBottom: 4,
  },
  balanceAmount: {
    color: colors.white,
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    flex: 1,
  },
  balanceItemLabel: {
    color: colors.gray[500],
    fontSize: 12,
    marginBottom: 2,
  },
  balanceItemAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  income: {
    color: colors.green[400],
  },
  expense: {
    color: colors.red[400],
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionLabel: {
    color: colors.gray[300],
    fontSize: 12,
  },
  emptyState: {
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  emptyText: {
    color: colors.gray[400],
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    color: colors.gray[500],
    fontSize: 14,
    textAlign: 'center',
  },
});
