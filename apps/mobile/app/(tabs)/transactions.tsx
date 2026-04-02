import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { api, Transaction, Category, Account } from '../../src/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthRange(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function formatCents(cents: number) {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const MONTH_NAMES = [
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

type TypeFilter = 'all' | 'income' | 'expense';

// ---------------------------------------------------------------------------
// Section list data builder
// ---------------------------------------------------------------------------

interface SectionItem {
  type: 'header';
  dateLabel: string;
  key: string;
}

interface TransactionItem {
  type: 'transaction';
  transaction: Transaction;
  key: string;
}

type ListItem = SectionItem | TransactionItem;

function buildSectionedList(transactions: Transaction[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';
  for (const t of transactions) {
    if (t.date !== lastDate) {
      lastDate = t.date;
      items.push({
        type: 'header',
        dateLabel: formatDateLabel(t.date),
        key: `header-${t.date}`,
      });
    }
    items.push({ type: 'transaction', transaction: t, key: t.id });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(todayISO());
  const [formAccountId, setFormAccountId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // Category lookup map
  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // Current month
  const now = new Date();
  const { from, to } = getMonthRange(now);

  // ------------------------------- data loading ----------------------------

  const fetchData = useCallback(async () => {
    try {
      const [txRes, catRes, accRes] = await Promise.all([
        api.getTransactions({ from, to }),
        api.getCategories({ flat: true, limit: 500 }),
        api.getAccounts(),
      ]);
      setTransactions(txRes.data);
      setCategories(catRes.data);
      setAccounts(accRes.data);
      if (accRes.data.length > 0 && !formAccountId) {
        setFormAccountId(accRes.data[0].id);
      }
    } catch (e) {
      console.error('Failed to load transactions', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ------------------------------- filtered data ---------------------------

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return transactions;
    return transactions.filter((t) => t.type === typeFilter);
  }, [transactions, typeFilter]);

  const listData = useMemo(() => buildSectionedList(filtered), [filtered]);

  // ------------------------------- summaries -------------------------------

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + Math.abs(t.amountCents), 0),
    [transactions]
  );
  const totalExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + Math.abs(t.amountCents), 0),
    [transactions]
  );

  // ------------------------------- delete ----------------------------------

  const handleDelete = useCallback((tx: Transaction) => {
    Alert.alert('Delete Transaction', `Delete "${tx.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTransaction(tx.id);
            setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete transaction');
          }
        },
      },
    ]);
  }, []);

  // ------------------------------- create ----------------------------------

  const handleCreate = useCallback(async () => {
    if (!formDescription.trim() || !formAmount || !formAccountId) {
      Alert.alert(
        'Missing fields',
        'Please fill in amount, description, and account.'
      );
      return;
    }
    const cents = Math.round(parseFloat(formAmount) * 100);
    if (isNaN(cents) || cents <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid positive number.');
      return;
    }
    setFormSaving(true);
    try {
      await api.createTransaction({
        date: formDate,
        description: formDescription.trim(),
        amountCents: cents,
        type: formType,
        accountId: formAccountId,
        categoryId: formCategoryId || undefined,
      });
      setModalVisible(false);
      resetForm();
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'Failed to create transaction');
    } finally {
      setFormSaving(false);
    }
  }, [
    formDescription,
    formAmount,
    formAccountId,
    formDate,
    formType,
    formCategoryId,
    fetchData,
  ]);

  const resetForm = () => {
    setFormType('expense');
    setFormAmount('');
    setFormDescription('');
    setFormDate(todayISO());
    setFormCategoryId('');
  };

  // ------------------------------- renders ---------------------------------

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{item.dateLabel}</Text>
          </View>
        );
      }

      const tx = item.transaction;
      const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
      const isIncome = tx.type === 'income';

      return (
        <Pressable style={styles.txRow} onLongPress={() => handleDelete(tx)}>
          <View style={styles.txEmoji}>
            <Text style={styles.txEmojiText}>
              {cat?.emoji || (isIncome ? '+' : '-')}
            </Text>
          </View>
          <View style={styles.txInfo}>
            <Text style={styles.txDescription} numberOfLines={1}>
              {tx.description}
            </Text>
            <Text style={styles.txCategory}>
              {cat?.name || (isIncome ? 'Income' : 'Expense')}
            </Text>
          </View>
          <Text
            style={[
              styles.txAmount,
              { color: isIncome ? colors.green[400] : colors.red[400] },
            ]}
          >
            {isIncome ? '+' : '-'}
            {formatCents(tx.amountCents)}
          </Text>
        </Pressable>
      );
    },
    [categoryMap, handleDelete]
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  // ------------------------------- loading ---------------------------------

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.cyan[400]} />
      </View>
    );
  }

  // ------------------------------- main UI ---------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Text style={styles.headerMonth}>
          {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, { color: colors.green[400] }]}>
              +{formatCents(totalIncome)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: colors.red[400] }]}>
              -{formatCents(totalExpense)}
            </Text>
          </View>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
      >
        {(['all', 'income', 'expense'] as TypeFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, typeFilter === f && styles.chipActive]}
            onPress={() => setTypeFilter(f)}
          >
            <Text
              style={[
                styles.chipText,
                typeFilter === f && styles.chipTextActive,
              ]}
            >
              {f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expense'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Transactions</Text>
          <Text style={styles.emptyText}>
            {typeFilter !== 'all'
              ? `No ${typeFilter} transactions this month`
              : 'Tap + to add your first transaction'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.cyan[400]}
              colors={[colors.cyan[400]]}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Transaction Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Transaction</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            style={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            {/* Type toggle */}
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  formType === 'expense' && styles.typeBtnActiveExpense,
                ]}
                onPress={() => setFormType('expense')}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    formType === 'expense' && styles.typeBtnTextActive,
                  ]}
                >
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  formType === 'income' && styles.typeBtnActiveIncome,
                ]}
                onPress={() => setFormType('income')}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    formType === 'income' && styles.typeBtnTextActive,
                  ]}
                >
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.gray[500]}
              keyboardType="decimal-pad"
              value={formAmount}
              onChangeText={setFormAmount}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Groceries"
              placeholderTextColor={colors.gray[500]}
              value={formDescription}
              onChangeText={setFormDescription}
            />

            {/* Date */}
            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder={todayISO()}
              placeholderTextColor={colors.gray[500]}
              value={formDate}
              onChangeText={setFormDate}
            />

            {/* Account picker */}
            <Text style={styles.fieldLabel}>Account</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
            >
              {accounts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.pickerChip,
                    formAccountId === a.id && styles.pickerChipActive,
                  ]}
                  onPress={() => setFormAccountId(a.id)}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      formAccountId === a.id && styles.pickerChipTextActive,
                    ]}
                  >
                    {a.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Category picker */}
            <Text style={styles.fieldLabel}>Category (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
            >
              <TouchableOpacity
                style={[
                  styles.pickerChip,
                  formCategoryId === '' && styles.pickerChipActive,
                ]}
                onPress={() => setFormCategoryId('')}
              >
                <Text
                  style={[
                    styles.pickerChipText,
                    formCategoryId === '' && styles.pickerChipTextActive,
                  ]}
                >
                  None
                </Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.pickerChip,
                    formCategoryId === c.id && styles.pickerChipActive,
                  ]}
                  onPress={() => setFormCategoryId(c.id)}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      formCategoryId === c.id && styles.pickerChipTextActive,
                    ]}
                  >
                    {c.emoji ? `${c.emoji} ` : ''}
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, formSaving && styles.saveBtnDisabled]}
              onPress={handleCreate}
              disabled={formSaving}
            >
              {formSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Save Transaction</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
    flex: 1,
    backgroundColor: colors.gray[950],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.gray[900],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  headerTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  headerMonth: {
    color: colors.gray[400],
    fontSize: 14,
    marginTop: 2,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: colors.gray[400],
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.gray[800],
    marginHorizontal: 16,
  },

  // Filter bar
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray[900],
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  chipActive: {
    backgroundColor: colors.cyan[600],
    borderColor: colors.cyan[600],
  },
  chipText: {
    color: colors.gray[400],
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.white,
  },

  // List
  listContent: {
    paddingBottom: 100,
  },
  dateHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  dateHeaderText: {
    color: colors.gray[400],
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[800],
  },
  txEmoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[800],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txEmojiText: {
    fontSize: 18,
  },
  txInfo: {
    flex: 1,
    marginRight: 8,
  },
  txDescription: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '500',
  },
  txCategory: {
    color: colors.gray[400],
    fontSize: 13,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    flex: 1,
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

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cyan[400],
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.cyan[400],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: {
    color: colors.gray[950],
    fontSize: 28,
    fontWeight: '700',
    marginTop: -2,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.gray[950],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.gray[900],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  modalCancel: {
    color: colors.cyan[400],
    fontSize: 16,
  },
  modalTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Type toggle
  typeToggle: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.gray[900],
  },
  typeBtnActiveExpense: {
    backgroundColor: colors.red[400],
  },
  typeBtnActiveIncome: {
    backgroundColor: colors.green[400],
  },
  typeBtnText: {
    color: colors.gray[400],
    fontSize: 15,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: colors.white,
  },

  // Fields
  fieldLabel: {
    color: colors.gray[400],
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.gray[900],
    borderWidth: 1,
    borderColor: colors.gray[800],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 16,
  },

  // Picker row
  pickerRow: {
    gap: 8,
    paddingVertical: 4,
  },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray[900],
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  pickerChipActive: {
    backgroundColor: colors.cyan[600],
    borderColor: colors.cyan[600],
  },
  pickerChipText: {
    color: colors.gray[400],
    fontSize: 14,
  },
  pickerChipTextActive: {
    color: colors.white,
  },

  // Save button
  saveBtn: {
    backgroundColor: colors.cyan[400],
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.gray[950],
    fontSize: 16,
    fontWeight: '700',
  },
});
