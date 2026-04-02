import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { api, Goal, GoalSummary } from '../../src/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getPiggyMessage(progressPercent: number): string {
  if (progressPercent >= 100) return 'Goal reached!';
  if (progressPercent >= 75) return 'About to burst!';
  if (progressPercent >= 50) return 'Almost there!';
  if (progressPercent >= 25) return "I'm filling up!";
  if (progressPercent > 0) return 'Just getting started...';
  return 'Feed me some savings!';
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return colors.green[400];
  if (percent >= 60) return colors.cyan[400];
  if (percent >= 30) return colors.purple[400];
  return colors.red[400];
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return {
        label: 'Completed',
        bg: colors.green[400],
        text: colors.green[950] ?? colors.black,
      };
    case 'paused':
      return {
        label: 'Paused',
        bg: colors.yellow[400],
        text: colors.yellow[950] ?? colors.black,
      };
    default:
      return {
        label: 'Active',
        bg: colors.cyan[400],
        text: colors.cyan[950] ?? colors.black,
      };
  }
}

const GOAL_TYPES = [
  { value: 'savings', label: 'Savings' },
  { value: 'debt_payoff', label: 'Debt Payoff' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
] as const;

const PIGGY_TYPES = ['savings', 'emergency_fund'];

// ---------------------------------------------------------------------------
// Summary Cards
// ---------------------------------------------------------------------------

function SummaryCards({ summary }: { summary: GoalSummary }) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{summary.activeCount}</Text>
        <Text style={styles.summaryLabel}>Active Goals</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>
          {formatCurrency(summary.totalCurrentCents)}
        </Text>
        <Text style={styles.summaryLabel}>Total Saved</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>
          {summary.overallProgressPercent}%
        </Text>
        <Text style={styles.summaryLabel}>Progress</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Goal Card
// ---------------------------------------------------------------------------

function GoalCard({
  goal,
  onContribute,
}: {
  goal: Goal;
  onContribute: (goal: Goal) => void;
}) {
  const progressColor = getProgressColor(goal.progressPercent);
  const badge = getStatusBadge(goal.status);
  const emoji =
    goal.emoji ||
    (PIGGY_TYPES.includes(goal.goalType) ? '\uD83D\uDC37' : '\uD83C\uDFAF');
  const showPiggy = PIGGY_TYPES.includes(goal.goalType);

  return (
    <View style={styles.goalCard}>
      {/* Header */}
      <View style={styles.goalHeader}>
        <View style={styles.goalTitleRow}>
          <Text style={styles.goalEmoji}>{emoji}</Text>
          <Text style={styles.goalName} numberOfLines={1}>
            {goal.name}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${Math.min(goal.progressPercent, 100)}%`,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>
      <View style={styles.progressLabels}>
        <Text style={styles.progressPercent}>{goal.progressPercent}%</Text>
        <Text style={styles.progressAmount}>
          {formatCurrency(goal.currentAmountCents)} /{' '}
          {formatCurrency(goal.targetAmountCents)}
        </Text>
      </View>

      {/* Piggy message */}
      {showPiggy && (
        <Text style={styles.piggyMessage}>
          {'\uD83D\uDC37'} {getPiggyMessage(goal.progressPercent)}
        </Text>
      )}

      {/* Contribute button */}
      {goal.status === 'active' && (
        <TouchableOpacity
          style={styles.contributeBtn}
          onPress={() => onContribute(goal)}
        >
          <Text style={styles.contributeBtnText}>Contribute</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Add Goal Modal
// ---------------------------------------------------------------------------

function AddGoalModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [goalType, setGoalType] = useState('savings');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setEmoji('');
    setGoalType('savings');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate('');
  };

  const handleSave = async () => {
    if (!name.trim() || !targetAmount.trim()) {
      Alert.alert('Required', 'Please enter a name and target amount.');
      return;
    }
    const targetCents = Math.round(parseFloat(targetAmount) * 100);
    if (isNaN(targetCents) || targetCents <= 0) {
      Alert.alert('Invalid', 'Target amount must be a positive number.');
      return;
    }
    const currentCents = currentAmount
      ? Math.round(parseFloat(currentAmount) * 100)
      : 0;

    setSaving(true);
    try {
      await api.createGoal({
        name: name.trim(),
        goal_type: goalType,
        target_amount_cents: targetCents,
        current_amount_cents: currentCents,
        target_date: targetDate || undefined,
        emoji: emoji || undefined,
      });
      reset();
      onSave();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not create goal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>New Goal</Text>

            {/* Name */}
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.gray[500]}
              placeholder="e.g. Emergency Fund"
              value={name}
              onChangeText={setName}
            />

            {/* Emoji */}
            <Text style={styles.inputLabel}>Emoji (optional)</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.gray[500]}
              placeholder="e.g. \uD83C\uDFE0"
              value={emoji}
              onChangeText={setEmoji}
            />

            {/* Goal Type */}
            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typePicker}>
              {GOAL_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.typeChip,
                    goalType === t.value && styles.typeChipActive,
                  ]}
                  onPress={() => setGoalType(t.value)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      goalType === t.value && styles.typeChipTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Target Amount */}
            <Text style={styles.inputLabel}>Target Amount ($)</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.gray[500]}
              placeholder="1000.00"
              keyboardType="decimal-pad"
              value={targetAmount}
              onChangeText={setTargetAmount}
            />

            {/* Current Amount */}
            <Text style={styles.inputLabel}>Current Amount ($, optional)</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.gray[500]}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={currentAmount}
              onChangeText={setCurrentAmount}
            />

            {/* Target Date */}
            <Text style={styles.inputLabel}>
              Target Date (optional, YYYY-MM-DD)
            </Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.gray[500]}
              placeholder="2026-12-31"
              value={targetDate}
              onChangeText={setTargetDate}
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  reset();
                  onClose();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Create Goal</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Contribute Modal
// ---------------------------------------------------------------------------

function ContributeModal({
  visible,
  goal,
  onClose,
  onSave,
}: {
  visible: boolean;
  goal: Goal | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  if (!goal) return null;

  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const newTotal =
    goal.currentAmountCents + (isNaN(amountCents) ? 0 : amountCents);
  const newPercent =
    goal.targetAmountCents > 0
      ? Math.min(Math.round((newTotal / goal.targetAmountCents) * 100), 100)
      : 0;

  const handleContribute = async () => {
    if (!amount.trim() || isNaN(amountCents) || amountCents <= 0) {
      Alert.alert('Invalid', 'Please enter a positive amount.');
      return;
    }
    setSaving(true);
    try {
      await api.contributeToGoal(goal.id, amountCents);
      setAmount('');
      onSave();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not contribute.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Contribute to {goal.name}</Text>

          {/* Current progress */}
          <View style={styles.contributeInfo}>
            <Text style={styles.contributeLabel}>Current</Text>
            <Text style={styles.contributeValue}>
              {formatCurrency(goal.currentAmountCents)} /{' '}
              {formatCurrency(goal.targetAmountCents)} ({goal.progressPercent}%)
            </Text>
          </View>

          {/* Amount input */}
          <Text style={styles.inputLabel}>Amount ($)</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={colors.gray[500]}
            placeholder="50.00"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />

          {/* New total preview */}
          {amountCents > 0 && (
            <View style={styles.contributeInfo}>
              <Text style={styles.contributeLabel}>New Total</Text>
              <Text
                style={[styles.contributeValue, { color: colors.green[400] }]}
              >
                {formatCurrency(newTotal)} ({newPercent}%)
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setAmount('');
                onClose();
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleContribute}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Add Funds</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await api.getGoals();
      setGoals(res.data);
      setSummary(res.summary);
    } catch {
      // silently fail — user will see empty state
    }
  }, []);

  useEffect(() => {
    fetchGoals().finally(() => setLoading(false));
  }, [fetchGoals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGoals();
    setRefreshing(false);
  }, [fetchGoals]);

  const handleGoalCreated = () => {
    setShowAddModal(false);
    fetchGoals();
  };

  const handleContributed = () => {
    setContributeGoal(null);
    fetchGoals();
  };

  // Loading
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.cyan[400]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          goals.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.cyan[400]}
          />
        }
        ListHeaderComponent={
          summary && goals.length > 0 ? (
            <SummaryCards summary={summary} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\uD83C\uDFAF'}</Text>
            <Text style={styles.emptyTitle}>No Goals Yet</Text>
            <Text style={styles.emptyText}>
              Set a savings goal and start tracking your progress. You got this!
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyBtnText}>Create Your First Goal</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <GoalCard goal={item} onContribute={setContributeGoal} />
        )}
      />

      {/* FAB */}
      {goals.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Modals */}
      <AddGoalModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleGoalCreated}
      />
      <ContributeModal
        visible={contributeGoal !== null}
        goal={contributeGoal}
        onClose={() => setContributeGoal(null)}
        onSave={handleContributed}
      />
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  // Summary
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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  summaryValue: {
    color: colors.cyan[400],
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryLabel: {
    color: colors.gray[400],
    fontSize: 12,
  },

  // Goal card
  goalCard: {
    backgroundColor: colors.gray[900],
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  goalEmoji: {
    fontSize: 22,
    marginRight: 8,
  },
  goalName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Progress bar
  progressBarBg: {
    height: 8,
    backgroundColor: colors.gray[800],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressPercent: {
    color: colors.gray[300],
    fontSize: 13,
    fontWeight: '600',
  },
  progressAmount: {
    color: colors.gray[400],
    fontSize: 12,
  },

  // Piggy
  piggyMessage: {
    color: colors.green[400],
    fontSize: 13,
    marginBottom: 8,
  },

  // Contribute button
  contributeBtn: {
    backgroundColor: colors.cyan[400],
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  contributeBtnText: {
    color: colors.gray[950],
    fontWeight: '700',
    fontSize: 14,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
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
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  emptyBtn: {
    backgroundColor: colors.cyan[400],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyBtnText: {
    color: colors.gray[950],
    fontWeight: '700',
    fontSize: 15,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cyan[400],
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    color: colors.gray[950],
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.gray[900],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  inputLabel: {
    color: colors.gray[400],
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.gray[800],
    color: colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.gray[700] ?? colors.gray[800],
  },

  // Type picker
  typePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.gray[800],
    borderWidth: 1,
    borderColor: colors.gray[700] ?? colors.gray[800],
  },
  typeChipActive: {
    backgroundColor: colors.cyan[400],
    borderColor: colors.cyan[400],
  },
  typeChipText: {
    color: colors.gray[400],
    fontSize: 13,
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: colors.gray[950],
    fontWeight: '700',
  },

  // Modal actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[700] ?? colors.gray[800],
  },
  cancelBtnText: {
    color: colors.gray[400],
    fontWeight: '600',
    fontSize: 15,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.cyan[400],
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    color: colors.gray[950],
    fontWeight: '700',
    fontSize: 15,
  },

  // Contribute modal info
  contributeInfo: {
    marginTop: 12,
  },
  contributeLabel: {
    color: colors.gray[400],
    fontSize: 13,
    marginBottom: 2,
  },
  contributeValue: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
