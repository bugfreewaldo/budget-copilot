'use client';

import { useMemo } from 'react';
import type { Category, Transaction } from '@/lib/api';

interface SpenderPersonalityProps {
  transactions: Transaction[];
  categories: Category[];
}

interface Archetype {
  id: string;
  name: string;
  emoji: string;
  description: string;
  gradient: string;
  borderColor: string;
}

const ARCHETYPES: Record<string, Archetype> = {
  saver: {
    id: 'saver',
    name: 'The Saver',
    emoji: '🐿️',
    description: 'You save more than you spend. Your future self thanks you!',
    gradient: 'from-green-500/20 to-emerald-500/20',
    borderColor: 'border-green-500/30',
  },
  spender: {
    id: 'spender',
    name: 'The Spender',
    emoji: '💸',
    description:
      'You live in the moment. Just make sure you have an emergency fund.',
    gradient: 'from-red-500/20 to-orange-500/20',
    borderColor: 'border-red-500/30',
  },
  foodie: {
    id: 'foodie',
    name: 'The Foodie',
    emoji: '🍕',
    description:
      'Good food is your passion. Have you tried cooking more at home?',
    gradient: 'from-orange-500/20 to-yellow-500/20',
    borderColor: 'border-orange-500/30',
  },
  fashionista: {
    id: 'fashionista',
    name: 'The Fashionista',
    emoji: '👗',
    description: 'Your style is impeccable. But watch out for impulse buys!',
    gradient: 'from-pink-500/20 to-purple-500/20',
    borderColor: 'border-pink-500/30',
  },
  techie: {
    id: 'techie',
    name: 'The Techie',
    emoji: '📱',
    description: 'Always on the cutting edge. Gadgets are your weakness.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/30',
  },
  nomad: {
    id: 'nomad',
    name: 'The Nomad',
    emoji: '✈️',
    description:
      'The world is your office. Transportation and travel dominate your budget.',
    gradient: 'from-sky-500/20 to-indigo-500/20',
    borderColor: 'border-sky-500/30',
  },
  subscriber: {
    id: 'subscriber',
    name: 'The Subscriber',
    emoji: '📺',
    description:
      'Netflix, Spotify, Disney+... You have a subscription for everything.',
    gradient: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/30',
  },
  homebody: {
    id: 'homebody',
    name: 'The Homebody',
    emoji: '🏠',
    description:
      'Your home is your castle. You invest in comfort and household services.',
    gradient: 'from-amber-500/20 to-orange-500/20',
    borderColor: 'border-amber-500/30',
  },
  entertainer: {
    id: 'entertainer',
    name: 'The Party Animal',
    emoji: '🎉',
    description: 'Life is for enjoying. Entertainment is your star category.',
    gradient: 'from-fuchsia-500/20 to-pink-500/20',
    borderColor: 'border-fuchsia-500/30',
  },
  minimalist: {
    id: 'minimalist',
    name: 'The Minimalist',
    emoji: '🧘',
    description:
      'Less is more. You spend little and on essentials. Financial zen!',
    gradient: 'from-gray-500/20 to-slate-500/20',
    borderColor: 'border-gray-500/30',
  },
  balanced: {
    id: 'balanced',
    name: 'The Balanced',
    emoji: '⚖️',
    description:
      'Not too much, not too little. You have a healthy financial balance.',
    gradient: 'from-cyan-500/20 to-teal-500/20',
    borderColor: 'border-cyan-500/30',
  },
  hustler: {
    id: 'hustler',
    name: 'The Hustler',
    emoji: '💼',
    description: 'Multiple income sources. You are building your empire!',
    gradient: 'from-yellow-500/20 to-amber-500/20',
    borderColor: 'border-yellow-500/30',
  },
  newbie: {
    id: 'newbie',
    name: 'The Newcomer',
    emoji: '🌱',
    description:
      'You are just starting your financial journey. Add more transactions!',
    gradient: 'from-lime-500/20 to-green-500/20',
    borderColor: 'border-lime-500/30',
  },
};

// Keywords to detect category types
const CATEGORY_KEYWORDS = {
  food: [
    'comida',
    'restaurante',
    'delivery',
    'uber eats',
    'rappi',
    'pedidos ya',
    'food',
    'almuerzo',
    'cena',
    'desayuno',
  ],
  fashion: [
    'ropa',
    'zapatos',
    'moda',
    'shopping',
    'tienda',
    'zara',
    'h&m',
    'fashion',
    'vestir',
    'accesorios',
  ],
  tech: [
    'tecnología',
    'tech',
    'electrónica',
    'gadget',
    'apple',
    'samsung',
    'computadora',
    'celular',
    'gaming',
  ],
  transport: [
    'transporte',
    'uber',
    'taxi',
    'gasolina',
    'metro',
    'bus',
    'viaje',
    'avión',
    'vuelo',
    'travel',
  ],
  subscriptions: [
    'suscripción',
    'suscripciones',
    'netflix',
    'spotify',
    'streaming',
    'disney',
    'hbo',
    'prime',
  ],
  home: [
    'hogar',
    'casa',
    'alquiler',
    'servicios',
    'luz',
    'agua',
    'internet',
    'gas',
    'mantenimiento',
  ],
  entertainment: [
    'entretenimiento',
    'ocio',
    'cine',
    'fiesta',
    'bar',
    'club',
    'concierto',
    'diversión',
  ],
};

function matchesCategoryType(
  categoryName: string,
  keywords: string[]
): boolean {
  const lowerName = categoryName.toLowerCase();
  return keywords.some((keyword) => lowerName.includes(keyword));
}

export function SpenderPersonality({
  transactions,
  categories,
}: SpenderPersonalityProps) {
  const personality = useMemo((): Archetype => {
    // Not enough data
    if (transactions.length < 3) {
      return ARCHETYPES.newbie!;
    }

    const expenses = transactions.filter((tx) => tx.type === 'expense');
    const incomes = transactions.filter((tx) => tx.type === 'income');

    const totalExpenses = expenses.reduce(
      (sum, tx) => sum + Math.abs(tx.amountCents),
      0
    );
    const totalIncome = incomes.reduce(
      (sum, tx) => sum + Math.abs(tx.amountCents),
      0
    );

    // Calculate savings rate
    const savingsRate =
      totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0;

    // Calculate spending by category type
    const spendingByType: Record<string, number> = {
      food: 0,
      fashion: 0,
      tech: 0,
      transport: 0,
      subscriptions: 0,
      home: 0,
      entertainment: 0,
    };

    expenses.forEach((tx) => {
      const category = categories.find((c) => c.id === tx.categoryId);
      const categoryName = category?.name || '';

      Object.entries(CATEGORY_KEYWORDS).forEach(([type, keywords]) => {
        if (matchesCategoryType(categoryName, keywords)) {
          spendingByType[type] =
            (spendingByType[type] || 0) + Math.abs(tx.amountCents);
        }
      });
    });

    // Find dominant spending category
    const dominantType = Object.entries(spendingByType)
      .filter(([, amount]) => amount > 0)
      .sort(([, a], [, b]) => b - a)[0];

    const dominantPercentage =
      dominantType && totalExpenses > 0
        ? (dominantType[1] / totalExpenses) * 100
        : 0;

    // Check for multiple income sources (hustler)
    const uniqueIncomeDescriptions = new Set(
      incomes.map((tx) => tx.description.toLowerCase())
    );
    if (
      uniqueIncomeDescriptions.size >= 3 &&
      totalIncome > totalExpenses * 1.5
    ) {
      return ARCHETYPES.hustler!;
    }

    // Check for saver (high savings rate)
    if (savingsRate > 0.3) {
      return ARCHETYPES.saver!;
    }

    // Check for spender (spending more than earning or very low savings)
    if (savingsRate < 0 || (savingsRate < 0.05 && totalExpenses > 0)) {
      return ARCHETYPES.spender!;
    }

    // Check for minimalist (very few transactions, low spending)
    if (transactions.length < 10 && totalExpenses < 50000) {
      // Less than $500
      return ARCHETYPES.minimalist!;
    }

    // Check dominant category (needs to be at least 25% of spending)
    if (dominantType && dominantPercentage > 25) {
      switch (dominantType[0]) {
        case 'food':
          return ARCHETYPES.foodie!;
        case 'fashion':
          return ARCHETYPES.fashionista!;
        case 'tech':
          return ARCHETYPES.techie!;
        case 'transport':
          return ARCHETYPES.nomad!;
        case 'subscriptions':
          return ARCHETYPES.subscriber!;
        case 'home':
          return ARCHETYPES.homebody!;
        case 'entertainment':
          return ARCHETYPES.entertainer!;
      }
    }

    // Default to balanced
    return ARCHETYPES.balanced!;
  }, [transactions, categories]);

  // Calculate a "personality strength" percentage based on data
  const strength = useMemo(() => {
    if (transactions.length < 3) return 0;
    if (transactions.length < 10) return 40;
    if (transactions.length < 25) return 60;
    if (transactions.length < 50) return 80;
    return 95;
  }, [transactions.length]);

  return (
    <div
      className={`bg-gradient-to-br ${personality.gradient} rounded-2xl border ${personality.borderColor} p-4 lg:p-5 relative overflow-hidden`}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 opacity-10 text-6xl flex items-center justify-center">
        {personality.emoji}
      </div>

      <div className="relative z-10">
        <div className="flex items-start gap-3">
          <span className="text-3xl lg:text-4xl">{personality.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-lg lg:text-xl font-bold text-white">
                {personality.name}
              </h4>
              {strength > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                  {strength}% confident
                </span>
              )}
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {personality.description}
            </p>
          </div>
        </div>

        {/* Fun stats */}
        {transactions.length >= 5 && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-4 text-xs text-gray-400">
            <span>📊 Based on {transactions.length} transactions</span>
          </div>
        )}
      </div>
    </div>
  );
}
