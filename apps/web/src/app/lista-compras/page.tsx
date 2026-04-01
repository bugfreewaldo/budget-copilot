'use client';

import { useState, useMemo } from 'react';
import {
  useGroceryLists,
  useGroceryItems,
  useGroceryStores,
  useItemPrices,
} from '@/lib/hooks';
import {
  createGroceryList,
  deleteGroceryList,
  updateGroceryList,
  createGroceryItem,
  updateGroceryItem,
  deleteGroceryItem,
  createGroceryStore,
  deleteGroceryStore,
  setItemPrice,
  deleteItemPrice,
  type GroceryList,
  type GroceryItem,
  type GroceryStore,
  type GroceryItemPrice,
} from '@/lib/api';
import { Sidebar } from '@/components/layout';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const STORE_COLORS = [
  '#06b6d4',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#10b981',
  '#ec4899',
  '#6366f1',
  '#f97316',
];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatPrice(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

// ─── Price comparison sub-component for a single item ───
function ItemPriceRow({
  item,
  stores,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: GroceryItem;
  stores: GroceryStore[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { prices, refresh: refreshPrices } = useItemPrices(item.id);
  const [addingPrice, setAddingPrice] = useState(false);
  const [priceStoreId, setPriceStoreId] = useState('');
  const [priceValue, setPriceValue] = useState('');

  const priceByStore = useMemo(() => {
    const map: Record<string, GroceryItemPrice> = {};
    prices.forEach((p) => {
      map[p.storeId] = p;
    });
    return map;
  }, [prices]);

  const cheapestPrice = useMemo(() => {
    if (prices.length === 0) return null;
    return Math.min(...prices.map((p) => p.priceCents));
  }, [prices]);

  async function handleAddPrice(e: React.FormEvent) {
    e.preventDefault();
    if (!priceStoreId || !priceValue) return;
    const cents = Math.round(parseFloat(priceValue) * 100);
    if (isNaN(cents) || cents <= 0) return;
    try {
      await setItemPrice(item.id, { storeId: priceStoreId, priceCents: cents });
      setPriceValue('');
      setPriceStoreId('');
      setAddingPrice(false);
      refreshPrices();
    } catch (err) {
      console.error('Failed to set price:', err);
    }
  }

  async function handleDeletePrice(priceId: string) {
    try {
      await deleteItemPrice(item.id, priceId);
      refreshPrices();
    } catch (err) {
      console.error('Failed to delete price:', err);
    }
  }

  return (
    <li
      className={`px-3 py-2.5 rounded-xl group transition-all ${
        item.checked ? 'bg-gray-800/30' : 'hover:bg-gray-800/50'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`flex-shrink-0 w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
            item.checked
              ? 'bg-green-500 border-green-500'
              : 'border-gray-600 hover:border-cyan-500'
          }`}
        >
          {item.checked && (
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>

        {/* Item content */}
        <div className="flex-1 min-w-0">
          <span
            className={`text-sm ${item.checked ? 'text-gray-500 line-through' : 'text-white'}`}
          >
            {item.name}
          </span>
          {item.quantity && (
            <span className="ml-2 text-xs text-gray-500">
              ({item.quantity})
            </span>
          )}
        </div>

        {/* Price tags */}
        {prices.length > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {stores.map((store) => {
              const price = priceByStore[store.id];
              if (!price) return null;
              const isCheapest =
                cheapestPrice !== null &&
                price.priceCents === cheapestPrice &&
                prices.length > 1;
              return (
                <span
                  key={store.id}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                    isCheapest
                      ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                  title={`${store.name}: ${formatPrice(price.priceCents)}`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: store.color }}
                  />
                  {formatPrice(price.priceCents)}
                </span>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => setAddingPrice(!addingPrice)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-gray-700 transition-colors"
            title="Set price"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
            title="Edit"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors"
            title="Delete"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Inline price form */}
      {addingPrice && (
        <form
          onSubmit={handleAddPrice}
          className="flex items-center gap-2 mt-2 ml-8"
        >
          <select
            value={priceStoreId}
            onChange={(e) => setPriceStoreId(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="">Select store...</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              placeholder="0.00"
              className="w-24 pl-5 pr-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={!priceStoreId || !priceValue}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => setAddingPrice(false)}
            className="px-2 py-1.5 text-gray-500 hover:text-white text-xs transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Existing prices (expandable on hover for management) */}
      {addingPrice && prices.length > 0 && (
        <div className="ml-8 mt-2 space-y-1">
          {prices.map((price) => {
            const store = stores.find((s) => s.id === price.storeId);
            return (
              <div
                key={price.id}
                className="flex items-center gap-2 text-xs text-gray-500"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: store?.color || '#666' }}
                />
                <span>{store?.name || 'Unknown'}</span>
                <span className="text-gray-400">
                  {formatPrice(price.priceCents)}
                </span>
                <button
                  onClick={() => handleDeletePrice(price.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                  title="Remove price"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

// ─── Main page ───
export default function GroceryListPage() {
  const { lists, isLoading, refresh: refreshLists } = useGroceryLists();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const {
    items,
    isLoading: itemsLoading,
    refresh: refreshItems,
  } = useGroceryItems(selectedListId);
  const { stores, refresh: refreshStores } = useGroceryStores();

  // Create list
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  // Edit list
  const [editingList, setEditingList] = useState<GroceryList | null>(null);
  const [editListName, setEditListName] = useState('');

  // Delete list
  const [deletingList, setDeletingList] = useState<GroceryList | null>(null);

  // Add item
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Edit item
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQty, setEditItemQty] = useState('');

  // Stores management
  const [showStoreManager, setShowStoreManager] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreColor, setNewStoreColor] = useState(STORE_COLORS[0]);

  const selectedList = lists.find((l) => l.id === selectedListId) || null;

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim() || creatingList) return;
    setCreatingList(true);
    try {
      const created = await createGroceryList({ name: newListName.trim() });
      setNewListName('');
      setShowCreateList(false);
      await refreshLists();
      setSelectedListId(created.id);
    } catch (err) {
      console.error('Failed to create list:', err);
    } finally {
      setCreatingList(false);
    }
  }

  async function handleUpdateList() {
    if (!editingList || !editListName.trim()) return;
    try {
      await updateGroceryList(editingList.id, { name: editListName.trim() });
      setEditingList(null);
      refreshLists();
    } catch (err) {
      console.error('Failed to update list:', err);
    }
  }

  async function handleDeleteList() {
    if (!deletingList) return;
    try {
      await deleteGroceryList(deletingList.id);
      if (selectedListId === deletingList.id) setSelectedListId(null);
      setDeletingList(null);
      refreshLists();
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedListId || !newItemName.trim() || addingItem) return;
    setAddingItem(true);
    try {
      await createGroceryItem(selectedListId, {
        name: newItemName.trim(),
        quantity: newItemQty.trim() || undefined,
      });
      setNewItemName('');
      setNewItemQty('');
      refreshItems();
      refreshLists();
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setAddingItem(false);
    }
  }

  async function handleToggleItem(item: GroceryItem) {
    if (!selectedListId) return;
    try {
      await updateGroceryItem(selectedListId, item.id, {
        checked: !item.checked,
      });
      refreshItems();
      refreshLists();
    } catch (err) {
      console.error('Failed to toggle item:', err);
    }
  }

  async function handleUpdateItem() {
    if (!selectedListId || !editingItem || !editItemName.trim()) return;
    try {
      await updateGroceryItem(selectedListId, editingItem.id, {
        name: editItemName.trim(),
        quantity: editItemQty.trim() || null,
      });
      setEditingItem(null);
      refreshItems();
    } catch (err) {
      console.error('Failed to update item:', err);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!selectedListId) return;
    try {
      await deleteGroceryItem(selectedListId, itemId);
      refreshItems();
      refreshLists();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  }

  async function handleClearChecked() {
    if (!selectedListId) return;
    const checkedItems = items.filter((i) => i.checked);
    try {
      await Promise.all(
        checkedItems.map((item) => deleteGroceryItem(selectedListId, item.id))
      );
      refreshItems();
      refreshLists();
    } catch (err) {
      console.error('Failed to clear checked items:', err);
    }
  }

  async function handleAddStore(e: React.FormEvent) {
    e.preventDefault();
    if (!newStoreName.trim()) return;
    try {
      await createGroceryStore({
        name: newStoreName.trim(),
        color: newStoreColor,
      });
      setNewStoreName('');
      setNewStoreColor(STORE_COLORS[(stores.length + 1) % STORE_COLORS.length]);
      refreshStores();
    } catch (err) {
      console.error('Failed to add store:', err);
    }
  }

  async function handleDeleteStore(id: string) {
    try {
      await deleteGroceryStore(id);
      refreshStores();
    } catch (err) {
      console.error('Failed to delete store:', err);
    }
  }

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950 p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="text-3xl">🛒</span>
                Grocery Lists
              </h1>
              <p className="text-gray-400 mt-1">
                Plan your shopping and compare prices
              </p>
            </div>
            <button
              onClick={() => setShowStoreManager(!showStoreManager)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                showStoreManager
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <span className="mr-1.5">🏪</span>
              Stores ({stores.length})
            </button>
          </div>

          {/* Store Manager */}
          {showStoreManager && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 lg:p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Manage Stores
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Add the stores you shop at to compare prices across them.
              </p>
              <form onSubmit={handleAddStore} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Store name (e.g. PriceSmart, Super Baru...)"
                  className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm"
                />
                <div className="flex items-center gap-1.5">
                  {STORE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewStoreColor(color)}
                      className={`w-6 h-6 rounded-full transition-all ${
                        newStoreColor === color
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!newStoreName.trim()}
                  className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Add Store
                </button>
              </form>
              {stores.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {stores.map((store) => (
                    <div
                      key={store.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg group"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: store.color }}
                      />
                      <span className="text-sm text-gray-300">
                        {store.name}
                      </span>
                      <button
                        onClick={() => handleDeleteStore(store.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove store"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lists Panel */}
            <div className="lg:col-span-1">
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">My Lists</h2>
                  <button
                    onClick={() => setShowCreateList(true)}
                    className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                    title="New list"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>

                {/* Create list form */}
                {showCreateList && (
                  <form onSubmit={handleCreateList} className="mb-4">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="List name..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="submit"
                        disabled={creatingList || !newListName.trim()}
                        className="flex-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                      >
                        {creatingList ? 'Creating...' : 'Create'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateList(false);
                          setNewListName('');
                        }}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* List items */}
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400 mx-auto" />
                  </div>
                ) : lists.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-4xl mb-2">📝</p>
                    <p className="text-gray-500 text-sm">
                      No lists yet. Create your first one!
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {lists.map((list) => (
                      <li key={list.id}>
                        <button
                          onClick={() => setSelectedListId(list.id)}
                          className={`w-full text-left px-3 py-3 rounded-xl transition-all group ${
                            selectedListId === list.id
                              ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30'
                              : 'hover:bg-gray-800/50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-medium text-sm ${selectedListId === list.id ? 'text-white' : 'text-gray-300'}`}
                            >
                              {list.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingList(list);
                                  setEditListName(list.name);
                                }}
                                className="p-1 rounded text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all"
                                title="Rename"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingList(list);
                                }}
                                className="p-1 rounded text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                title="Delete"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {list.checkedItems}/{list.totalItems} items
                            </span>
                            {list.totalItems > 0 && (
                              <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-green-400 rounded-full transition-all"
                                  style={{
                                    width: `${(list.checkedItems / list.totalItems) * 100}%`,
                                  }}
                                />
                              </div>
                            )}
                            <span className="text-xs text-gray-600">
                              {formatDate(list.updatedAt)}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Items Panel */}
            <div className="lg:col-span-2">
              {!selectedList ? (
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center">
                  <p className="text-5xl mb-4">🛒</p>
                  <p className="text-gray-400">
                    Select a list or create a new one to get started
                  </p>
                </div>
              ) : (
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 lg:p-6">
                  {/* List header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {selectedList.name}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {selectedList.checkedItems} of {selectedList.totalItems}{' '}
                        completed
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Store legend */}
                      {stores.length > 0 && (
                        <div className="hidden sm:flex items-center gap-2 mr-2">
                          {stores.map((s) => (
                            <div key={s.id} className="flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="text-xs text-gray-500">
                                {s.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {items.some((i) => i.checked) && (
                        <button
                          onClick={handleClearChecked}
                          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors"
                        >
                          Clear checked
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add item form */}
                  <form onSubmit={handleAddItem} className="flex gap-2 mb-6">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Add an item..."
                      className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm"
                    />
                    <input
                      type="text"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      placeholder="Qty"
                      className="w-20 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm text-center"
                    />
                    <button
                      type="submit"
                      disabled={addingItem || !newItemName.trim()}
                      className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                      Add
                    </button>
                  </form>

                  {/* Items list */}
                  {itemsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400 mx-auto" />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-4xl mb-2">✨</p>
                      <p className="text-gray-500 text-sm">
                        This list is empty. Add your first item above!
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <ItemPriceRow
                          key={item.id}
                          item={item}
                          stores={stores}
                          onToggle={() => handleToggleItem(item)}
                          onEdit={() => {
                            setEditingItem(item);
                            setEditItemName(item.name);
                            setEditItemQty(item.quantity || '');
                          }}
                          onDelete={() => handleDeleteItem(item.id)}
                        />
                      ))}
                    </ul>
                  )}

                  {/* Tip */}
                  {stores.length === 0 && items.length > 0 && (
                    <div className="mt-6 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                      <p className="text-sm text-purple-300">
                        <span className="font-medium">Tip:</span> Add stores
                        using the{' '}
                        <button
                          onClick={() => setShowStoreManager(true)}
                          className="underline hover:text-purple-200"
                        >
                          🏪 Stores
                        </button>{' '}
                        button above, then set prices on each item to compare
                        across stores.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit List Modal */}
      {editingList && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setEditingList(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Rename List
            </h3>
            <input
              type="text"
              value={editListName}
              onChange={(e) => setEditListName(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateList();
              }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleUpdateList}
                disabled={!editListName.trim()}
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setEditingList(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Edit Item</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                placeholder="Item name"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-sm"
                autoFocus
              />
              <input
                type="text"
                value={editItemQty}
                onChange={(e) => setEditItemQty(e.target.value)}
                placeholder="Quantity (optional)"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleUpdateItem}
                disabled={!editItemName.trim()}
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete List Confirmation */}
      <ConfirmModal
        isOpen={!!deletingList}
        title="Delete List"
        message={
          deletingList
            ? `Are you sure you want to delete "${deletingList.name}"? All items in this list will be permanently removed.`
            : ''
        }
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeleteList}
        onClose={() => setDeletingList(null)}
      />
    </Sidebar>
  );
}
