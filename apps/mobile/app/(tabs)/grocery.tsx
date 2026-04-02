import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { api, GroceryList, GroceryItem } from '../../src/lib/api';

// ---------------------------------------------------------------------------
// Grocery Lists Screen (with inline detail view)
// ---------------------------------------------------------------------------

export default function GroceryScreen() {
  // --- Lists view state ---
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [refreshingLists, setRefreshingLists] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  // --- Detail view state ---
  const [selectedList, setSelectedList] = useState<GroceryList | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [refreshingItems, setRefreshingItems] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // === Lists fetching ===

  const fetchLists = useCallback(async () => {
    try {
      const res = await api.getGroceryLists();
      setLists(res.data);
    } catch {
      // silently fail
    } finally {
      setLoadingLists(false);
      setRefreshingLists(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const onRefreshLists = useCallback(() => {
    setRefreshingLists(true);
    fetchLists();
  }, [fetchLists]);

  // === Items fetching ===

  const fetchItems = useCallback(async (listId: string) => {
    setLoadingItems(true);
    try {
      const res = await api.getGroceryItems(listId);
      setItems(res.data);
    } catch {
      // silently fail
    } finally {
      setLoadingItems(false);
      setRefreshingItems(false);
    }
  }, []);

  const onRefreshItems = useCallback(() => {
    if (!selectedList) return;
    setRefreshingItems(true);
    fetchItems(selectedList.id);
  }, [selectedList, fetchItems]);

  // === Actions ===

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name || creatingList) return;
    setCreatingList(true);
    try {
      await api.createGroceryList(name);
      setNewListName('');
      setShowNewListModal(false);
      await fetchLists();
    } catch {
      Alert.alert('Error', 'No se pudo crear la lista');
    } finally {
      setCreatingList(false);
    }
  };

  const handleDeleteList = (list: GroceryList) => {
    Alert.alert('Eliminar Lista', `Eliminar "${list.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteGroceryList(list.id);
            fetchLists();
          } catch {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const handleOpenList = (list: GroceryList) => {
    setSelectedList(list);
    fetchItems(list.id);
  };

  const handleBack = () => {
    setSelectedList(null);
    setItems([]);
    fetchLists();
  };

  const handleAddItem = async () => {
    const name = newItemName.trim();
    if (!name || !selectedList || addingItem) return;
    setAddingItem(true);
    try {
      const qty = newItemQty.trim() || undefined;
      await api.createGroceryItem(selectedList.id, { name, quantity: qty });
      setNewItemName('');
      setNewItemQty('');
      await fetchItems(selectedList.id);
    } catch {
      Alert.alert('Error', 'No se pudo agregar el item');
    } finally {
      setAddingItem(false);
    }
  };

  const handleToggleItem = async (item: GroceryItem) => {
    if (!selectedList) return;
    try {
      await api.toggleGroceryItem(selectedList.id, item.id, !item.checked);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
      );
    } catch {
      // silently fail
    }
  };

  const handleDeleteItem = (item: GroceryItem) => {
    if (!selectedList) return;
    Alert.alert('Eliminar Item', `Eliminar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteGroceryItem(selectedList.id, item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          } catch {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  // === Detail View ===

  if (selectedList) {
    const sortedItems = [...items].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return 0;
    });

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>{'\u2190'} Listas</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {selectedList.name}
          </Text>
        </View>

        {/* Add item row */}
        <View style={styles.addItemRow}>
          <TextInput
            style={styles.addItemInput}
            placeholder="Agregar item..."
            placeholderTextColor={colors.gray[500]}
            value={newItemName}
            onChangeText={setNewItemName}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
          />
          <TextInput
            style={styles.addItemQty}
            placeholder="Cant."
            placeholderTextColor={colors.gray[500]}
            value={newItemQty}
            onChangeText={setNewItemQty}
            keyboardType="default"
          />
          <TouchableOpacity
            style={[
              styles.addItemButton,
              (!newItemName.trim() || addingItem) && styles.buttonDisabled,
            ]}
            onPress={handleAddItem}
            disabled={!newItemName.trim() || addingItem}
          >
            <Text style={styles.addItemButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {loadingItems ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.cyan[400]} />
          </View>
        ) : sortedItems.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>{'\u{1F6D2}'}</Text>
            <Text style={styles.emptyTitle}>Lista Vacia</Text>
            <Text style={styles.emptyText}>
              Agrega items usando el campo de arriba
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedItems}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshingItems}
                onRefresh={onRefreshItems}
                tintColor={colors.cyan[400]}
                colors={[colors.cyan[400]]}
              />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemRow}
                onPress={() => handleToggleItem(item)}
                onLongPress={() => handleDeleteItem(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    item.checked && styles.checkboxChecked,
                  ]}
                >
                  {item.checked && (
                    <Text style={styles.checkmark}>{'\u2713'}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.itemName,
                    item.checked && styles.itemNameChecked,
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.quantity ? (
                  <Text style={styles.itemQty}>{item.quantity}</Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // === Lists View ===

  if (loadingLists) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.cyan[400]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* New list modal */}
      <Modal
        visible={showNewListModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva Lista</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre de la lista"
              placeholderTextColor={colors.gray[500]}
              value={newListName}
              onChangeText={setNewListName}
              autoFocus
              onSubmitEditing={handleCreateList}
              returnKeyType="done"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setShowNewListModal(false);
                  setNewListName('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalCreate,
                  (!newListName.trim() || creatingList) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleCreateList}
                disabled={!newListName.trim() || creatingList}
              >
                {creatingList ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalCreateText}>Crear</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {lists.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>{'\u{1F6D2}'}</Text>
          <Text style={styles.emptyTitle}>Sin Listas</Text>
          <Text style={styles.emptyText}>Crea tu primera lista de compras</Text>
          <TouchableOpacity
            style={styles.createFirstButton}
            onPress={() => setShowNewListModal(true)}
          >
            <Text style={styles.createFirstText}>+ Crear Lista</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshingLists}
              onRefresh={onRefreshLists}
              tintColor={colors.cyan[400]}
              colors={[colors.cyan[400]]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.addListButton}
              onPress={() => setShowNewListModal(true)}
            >
              <Text style={styles.addListButtonText}>+ Nueva Lista</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => {
            const progress =
              item.totalItems > 0
                ? (item.checkedItems / item.totalItems) * 100
                : 0;

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handleOpenList(item)}
                onLongPress={() => handleDeleteList(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.listName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.listCount}>
                    {item.checkedItems}/{item.totalItems}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress}%`,
                        backgroundColor:
                          progress === 100
                            ? colors.green[400]
                            : colors.cyan[400],
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          }}
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
    marginBottom: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // --- Lists view ---
  addListButton: {
    backgroundColor: colors.cyan[400] + '18',
    borderWidth: 1,
    borderColor: colors.cyan[400] + '44',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  addListButtonText: {
    color: colors.cyan[400],
    fontSize: 16,
    fontWeight: '600',
  },
  createFirstButton: {
    backgroundColor: colors.cyan[400],
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  createFirstText: {
    color: colors.gray[950],
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
    marginBottom: 10,
  },
  listName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  listCount: {
    color: colors.gray[400],
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray[800],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // --- Detail view ---
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  backButton: {
    marginRight: 12,
  },
  backText: {
    color: colors.cyan[400],
    fontSize: 16,
    fontWeight: '600',
  },
  detailTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  addItemRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  addItemInput: {
    flex: 1,
    backgroundColor: colors.gray[900],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  addItemQty: {
    width: 64,
    backgroundColor: colors.gray[900],
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.gray[800],
    textAlign: 'center',
  },
  addItemButton: {
    backgroundColor: colors.cyan[400],
    width: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemButtonText: {
    color: colors.gray[950],
    fontSize: 22,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[900],
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray[600],
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.cyan[400],
    borderColor: colors.cyan[400],
  },
  checkmark: {
    color: colors.gray[950],
    fontSize: 14,
    fontWeight: '700',
  },
  itemName: {
    color: colors.white,
    fontSize: 15,
    flex: 1,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: colors.gray[500],
  },
  itemQty: {
    color: colors.gray[400],
    fontSize: 13,
    marginLeft: 8,
    backgroundColor: colors.gray[800],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },

  // --- Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.gray[800],
  },
  modalTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: colors.gray[800],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelText: {
    color: colors.gray[400],
    fontSize: 16,
    fontWeight: '600',
  },
  modalCreate: {
    backgroundColor: colors.cyan[400],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCreateText: {
    color: colors.gray[950],
    fontSize: 16,
    fontWeight: '700',
  },
});
