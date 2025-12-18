'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface PiggyBank {
  id: string;
  name: string;
  targetAmountCents: number;
  currentAmountCents: number;
  emoji: string;
  color: string;
  createdAt: string;
}

interface Deposit {
  id: string;
  piggyId: string;
  amountCents: number;
  note: string;
  createdAt: string;
}

// Fun piggy messages based on savings progress
function getPiggyMessage(percent: number, _name: string): string {
  if (percent === 0) return `¡Oink! Estoy vacío... ¡Aliméntame con ahorros!`;
  if (percent < 25) return `¡Oink oink! Apenas empezando... ¡Sigue así!`;
  if (percent < 50) return `¡Oink! Me estoy llenando... ¡Qué rico!`;
  if (percent < 75) return `¡OINK! ¡Ya casi llegamos a la meta!`;
  if (percent < 100)
    return `¡OINK OINK! ¡Estoy a punto de reventar de felicidad!`;
  return `🎉 ¡META ALCANZADA! ¡Soy el cerdito más feliz del mundo!`;
}

// Get piggy size class based on fullness
function getPiggySize(percent: number): string {
  if (percent < 25) return 'scale-75';
  if (percent < 50) return 'scale-90';
  if (percent < 75) return 'scale-100';
  if (percent < 100) return 'scale-110';
  return 'scale-125';
}

// Animated SVG Piggy Bank Component
function AnimatedPiggy({
  percent,
  color,
  isShaking,
}: {
  percent: number;
  color: string;
  isShaking: boolean;
}) {
  const fillHeight = Math.min(percent, 100);

  return (
    <div
      className={`relative transition-transform duration-500 ${getPiggySize(percent)} ${isShaking ? 'animate-bounce' : ''}`}
    >
      <svg
        viewBox="0 0 200 160"
        className="w-64 h-52 drop-shadow-2xl"
        style={{ filter: 'drop-shadow(0 25px 25px rgb(0 0 0 / 0.15))' }}
      >
        {/* Piggy Body */}
        <ellipse
          cx="100"
          cy="90"
          rx="70"
          ry="55"
          className={`${color} transition-colors duration-300`}
          fill="currentColor"
        />

        {/* Fill level indicator (belly) */}
        <defs>
          <clipPath id="bellyClip">
            <ellipse cx="100" cy="90" rx="60" ry="45" />
          </clipPath>
        </defs>
        <rect
          x="40"
          y={135 - fillHeight * 0.9}
          width="120"
          height={fillHeight * 0.9}
          clipPath="url(#bellyClip)"
          className="fill-yellow-400/40 transition-all duration-700"
        />

        {/* Piggy Snout */}
        <ellipse
          cx="165"
          cy="85"
          rx="18"
          ry="14"
          className={`${color} brightness-90`}
          fill="currentColor"
        />
        <circle cx="160" cy="82" r="3" className="fill-pink-900/50" />
        <circle cx="170" cy="82" r="3" className="fill-pink-900/50" />

        {/* Ears */}
        <ellipse
          cx="55"
          cy="45"
          rx="15"
          ry="20"
          className={`${color} brightness-95`}
          fill="currentColor"
          transform="rotate(-20, 55, 45)"
        />
        <ellipse
          cx="85"
          cy="40"
          rx="15"
          ry="20"
          className={`${color} brightness-95`}
          fill="currentColor"
          transform="rotate(10, 85, 40)"
        />
        <ellipse
          cx="55"
          cy="45"
          rx="8"
          ry="12"
          className="fill-pink-300"
          transform="rotate(-20, 55, 45)"
        />
        <ellipse
          cx="85"
          cy="40"
          rx="8"
          ry="12"
          className="fill-pink-300"
          transform="rotate(10, 85, 40)"
        />

        {/* Eyes */}
        <circle cx="130" cy="70" r="8" className="fill-white" />
        <circle cx="130" cy="70" r="4" className="fill-gray-900" />
        <circle cx="132" cy="68" r="1.5" className="fill-white" />

        {/* Coin Slot */}
        <rect
          x="80"
          y="35"
          width="25"
          height="6"
          rx="3"
          className="fill-gray-800"
        />

        {/* Legs */}
        <rect
          x="50"
          y="135"
          width="18"
          height="20"
          rx="5"
          className={`${color} brightness-90`}
          fill="currentColor"
        />
        <rect
          x="75"
          y="135"
          width="18"
          height="20"
          rx="5"
          className={`${color} brightness-90`}
          fill="currentColor"
        />
        <rect
          x="110"
          y="135"
          width="18"
          height="20"
          rx="5"
          className={`${color} brightness-90`}
          fill="currentColor"
        />
        <rect
          x="135"
          y="135"
          width="18"
          height="20"
          rx="5"
          className={`${color} brightness-90`}
          fill="currentColor"
        />

        {/* Hooves */}
        <rect
          x="50"
          y="150"
          width="18"
          height="5"
          rx="2"
          className="fill-gray-700"
        />
        <rect
          x="75"
          y="150"
          width="18"
          height="5"
          rx="2"
          className="fill-gray-700"
        />
        <rect
          x="110"
          y="150"
          width="18"
          height="5"
          rx="2"
          className="fill-gray-700"
        />
        <rect
          x="135"
          y="150"
          width="18"
          height="5"
          rx="2"
          className="fill-gray-700"
        />

        {/* Curly Tail */}
        <path
          d="M30 85 Q15 75 20 90 Q25 105 15 100"
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          className={color}
          strokeLinecap="round"
        />

        {/* Blush */}
        <circle cx="145" cy="90" r="8" className="fill-pink-300/50" />
      </svg>

      {/* Sparkles when goal reached */}
      {percent >= 100 && (
        <div className="absolute inset-0 pointer-events-none">
          <span className="absolute top-0 left-1/4 text-2xl animate-ping">
            ✨
          </span>
          <span className="absolute top-1/4 right-0 text-2xl animate-ping animation-delay-300">
            ✨
          </span>
          <span className="absolute bottom-1/4 left-0 text-2xl animate-ping animation-delay-500">
            ✨
          </span>
        </div>
      )}
    </div>
  );
}

// Format cents to currency
function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

// Piggy colors available
const PIGGY_COLORS = [
  { name: 'Rosa Clásico', class: 'text-pink-400', bg: 'bg-pink-400' },
  { name: 'Dorado', class: 'text-yellow-500', bg: 'bg-yellow-500' },
  { name: 'Azul', class: 'text-blue-400', bg: 'bg-blue-400' },
  { name: 'Verde', class: 'text-green-400', bg: 'bg-green-400' },
  { name: 'Morado', class: 'text-purple-400', bg: 'bg-purple-400' },
  { name: 'Naranja', class: 'text-orange-400', bg: 'bg-orange-400' },
];

export default function AlcanciaPage(): React.JSX.Element {
  const [piggies, setPiggies] = useState<PiggyBank[]>([]);
  const [selectedPiggy, setSelectedPiggy] = useState<PiggyBank | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<PiggyBank | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  // Form states
  const [newPiggyName, setNewPiggyName] = useState('');
  const [newPiggyTarget, setNewPiggyTarget] = useState('');
  const [newPiggyColor, setNewPiggyColor] = useState(PIGGY_COLORS[0]!);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');

  // Load piggies from localStorage (in a real app, this would be API calls)
  useEffect(() => {
    const stored = localStorage.getItem('budget-copilot-piggies');
    if (stored) {
      const parsed = JSON.parse(stored) as PiggyBank[];
      setPiggies(parsed);
      if (parsed.length > 0) {
        setSelectedPiggy(parsed[0]!);
      }
    }
    const storedDeposits = localStorage.getItem(
      'budget-copilot-piggy-deposits'
    );
    if (storedDeposits) {
      setDeposits(JSON.parse(storedDeposits));
    }
    setLoading(false);
  }, []);

  // Save piggies to localStorage
  const savePiggies = (newPiggies: PiggyBank[]) => {
    localStorage.setItem('budget-copilot-piggies', JSON.stringify(newPiggies));
    setPiggies(newPiggies);
  };

  // Save deposits to localStorage
  const saveDeposits = (newDeposits: Deposit[]) => {
    localStorage.setItem(
      'budget-copilot-piggy-deposits',
      JSON.stringify(newDeposits)
    );
    setDeposits(newDeposits);
  };

  // Create new piggy
  const handleCreatePiggy = () => {
    if (!newPiggyName.trim() || !newPiggyTarget) return;

    const newPiggy: PiggyBank = {
      id: crypto.randomUUID(),
      name: newPiggyName.trim(),
      targetAmountCents: Math.round(parseFloat(newPiggyTarget) * 100),
      currentAmountCents: 0,
      emoji: '🐷',
      color: newPiggyColor.class,
      createdAt: new Date().toISOString(),
    };

    const updated = [...piggies, newPiggy];
    savePiggies(updated);
    setSelectedPiggy(newPiggy);
    setShowCreateModal(false);
    setNewPiggyName('');
    setNewPiggyTarget('');
  };

  // Add deposit to piggy
  const handleDeposit = () => {
    if (!selectedPiggy || !depositAmount) return;

    const amountCents = Math.round(parseFloat(depositAmount) * 100);
    if (amountCents <= 0) return;

    // Trigger shake animation
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);

    // Update piggy
    const updatedPiggies = piggies.map((p) =>
      p.id === selectedPiggy.id
        ? { ...p, currentAmountCents: p.currentAmountCents + amountCents }
        : p
    );
    savePiggies(updatedPiggies);
    setSelectedPiggy({
      ...selectedPiggy,
      currentAmountCents: selectedPiggy.currentAmountCents + amountCents,
    });

    // Add deposit record
    const newDeposit: Deposit = {
      id: crypto.randomUUID(),
      piggyId: selectedPiggy.id,
      amountCents,
      note: depositNote.trim(),
      createdAt: new Date().toISOString(),
    };
    saveDeposits([newDeposit, ...deposits]);

    setShowDepositModal(false);
    setDepositAmount('');
    setDepositNote('');
  };

  // Delete piggy
  const handleDeletePiggy = () => {
    if (!deleteConfirm) return;

    const updated = piggies.filter((p) => p.id !== deleteConfirm.id);
    savePiggies(updated);
    saveDeposits(deposits.filter((d) => d.piggyId !== deleteConfirm.id));

    if (selectedPiggy?.id === deleteConfirm.id) {
      setSelectedPiggy(updated[0] || null);
    }
    setDeleteConfirm(null);
  };

  const selectedPiggyDeposits = deposits.filter(
    (d) => d.piggyId === selectedPiggy?.id
  );
  const progressPercent = selectedPiggy
    ? (selectedPiggy.currentAmountCents / selectedPiggy.targetAmountCents) * 100
    : 0;

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950">
        {/* Animated Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 -left-40 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-0 -right-40 w-96 h-96 bg-yellow-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-40 left-40 w-96 h-96 bg-orange-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
        </div>

        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          {/* Header */}
          <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 lg:mb-2 flex items-center gap-3">
                <span className="text-4xl">🐷</span> Mi Alcancía
              </h1>
              <p className="text-sm lg:text-base text-gray-400">
                ¡Ahorra monedita a monedita y alcanza tus metas!
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all"
            >
              <span>+</span> Nueva Alcancía
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
                <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400">Cargando alcancías...</p>
              </div>
            </div>
          ) : piggies.length === 0 ? (
            // Empty State
            <div className="text-center py-16">
              <div className="text-8xl mb-6 animate-bounce">🐷</div>
              <h2 className="text-2xl font-bold text-white mb-3">
                ¡Crea tu primera alcancía!
              </h2>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Las alcancías te ayudan a ahorrar para metas específicas. ¡Es
                como tener un cerdito guardando tus monedas!
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all text-lg"
              >
                🐷 Crear Mi Primera Alcancía
              </button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Piggy List */}
              <div className="lg:col-span-1 space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Mis Alcancías
                </h3>
                {piggies.map((piggy) => {
                  const percent =
                    (piggy.currentAmountCents / piggy.targetAmountCents) * 100;
                  const isSelected = selectedPiggy?.id === piggy.id;
                  return (
                    <button
                      key={piggy.id}
                      onClick={() => setSelectedPiggy(piggy)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-gray-800/80 border-pink-500/50'
                          : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🐷</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">
                            {piggy.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {formatCents(piggy.currentAmountCents)} /{' '}
                            {formatCents(piggy.targetAmountCents)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold ${
                              percent >= 100
                                ? 'text-green-400'
                                : percent >= 50
                                  ? 'text-yellow-400'
                                  : 'text-pink-400'
                            }`}
                          >
                            {percent.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            percent >= 100
                              ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                              : 'bg-gradient-to-r from-pink-400 to-orange-400'
                          }`}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Piggy Display */}
              {selectedPiggy && (
                <div className="lg:col-span-2">
                  <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-6 lg:p-8">
                    {/* Piggy Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-1">
                          {selectedPiggy.name}
                        </h2>
                        <p className="text-gray-400">
                          Meta: {formatCents(selectedPiggy.targetAmountCents)}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteConfirm(selectedPiggy)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Romper alcancía"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Visual Piggy */}
                    <div className="flex flex-col items-center mb-8">
                      <AnimatedPiggy
                        percent={progressPercent}
                        color={selectedPiggy.color}
                        isShaking={isShaking}
                      />

                      {/* Piggy Speech Bubble */}
                      <div className="mt-4 px-6 py-3 bg-white/10 rounded-2xl border border-white/20 max-w-sm text-center">
                        <p className="text-white font-medium">
                          {getPiggyMessage(progressPercent, selectedPiggy.name)}
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-4 bg-gray-800/50 rounded-xl">
                        <div className="text-2xl font-bold text-pink-400">
                          {formatCents(selectedPiggy.currentAmountCents)}
                        </div>
                        <div className="text-xs text-gray-500">Ahorrado</div>
                      </div>
                      <div className="text-center p-4 bg-gray-800/50 rounded-xl">
                        <div className="text-2xl font-bold text-orange-400">
                          {formatCents(
                            selectedPiggy.targetAmountCents -
                              selectedPiggy.currentAmountCents
                          )}
                        </div>
                        <div className="text-xs text-gray-500">Falta</div>
                      </div>
                      <div className="text-center p-4 bg-gray-800/50 rounded-xl">
                        <div
                          className={`text-2xl font-bold ${progressPercent >= 100 ? 'text-green-400' : 'text-yellow-400'}`}
                        >
                          {progressPercent.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Progreso</div>
                      </div>
                    </div>

                    {/* Add Money Button */}
                    <button
                      onClick={() => setShowDepositModal(true)}
                      className="w-full py-4 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                    >
                      <span className="text-2xl">🪙</span> Agregar Dinero
                    </button>

                    {/* Recent Deposits */}
                    {selectedPiggyDeposits.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          Últimos Depósitos
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedPiggyDeposits.slice(0, 10).map((deposit) => (
                            <div
                              key={deposit.id}
                              className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <span>🪙</span>
                                <span className="text-gray-300">
                                  {deposit.note || 'Depósito'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-green-400 font-medium">
                                  +{formatCents(deposit.amountCents)}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {new Date(
                                    deposit.createdAt
                                  ).toLocaleDateString('es-MX')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Create Piggy Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            <div className="relative bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>🐷</span> Nueva Alcancía
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Nombre de la meta
                  </label>
                  <input
                    type="text"
                    value={newPiggyName}
                    onChange={(e) => setNewPiggyName(e.target.value)}
                    placeholder="Ej: Vacaciones, iPhone, Emergencias..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Meta de ahorro
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={newPiggyTarget}
                      onChange={(e) => setNewPiggyTarget(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Color del cerdito
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {PIGGY_COLORS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setNewPiggyColor(color)}
                        className={`w-10 h-10 rounded-full ${color.bg} transition-all ${
                          newPiggyColor.name === color.name
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110'
                            : 'hover:scale-105'
                        }`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreatePiggy}
                  disabled={!newPiggyName.trim() || !newPiggyTarget}
                  className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear Alcancía
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deposit Modal */}
        {showDepositModal && selectedPiggy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowDepositModal(false)}
            />
            <div className="relative bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>🪙</span> Agregar a {selectedPiggy.name}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Cantidad
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 text-2xl font-bold"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Nota (opcional)
                  </label>
                  <input
                    type="text"
                    value={depositNote}
                    onChange={(e) => setDepositNote(e.target.value)}
                    placeholder="Ej: Ahorro de esta semana"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* Quick amounts */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Montos rápidos
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[10, 50, 100, 200, 500].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setDepositAmount(amount.toString())}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all"
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeposit}
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                  className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>🐷</span> ¡Depositar!
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteConfirm !== null}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeletePiggy}
          title="Romper Alcancía"
          message={`¿Seguro que quieres romper la alcancía "${deleteConfirm?.name}"? Esto eliminará todo el historial de depósitos.`}
          confirmText="Romper"
          cancelText="Cancelar"
          variant="danger"
        />
      </div>
    </Sidebar>
  );
}
