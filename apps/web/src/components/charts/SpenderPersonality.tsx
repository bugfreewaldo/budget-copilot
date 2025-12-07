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
    name: 'El Ahorrador',
    emoji: '🐿️',
    description: 'Guardas más de lo que gastas. ¡Tu yo del futuro te lo agradece!',
    gradient: 'from-green-500/20 to-emerald-500/20',
    borderColor: 'border-green-500/30',
  },
  spender: {
    id: 'spender',
    name: 'El Gastador',
    emoji: '💸',
    description: 'Vives el momento. Solo asegúrate de tener un colchón de emergencia.',
    gradient: 'from-red-500/20 to-orange-500/20',
    borderColor: 'border-red-500/30',
  },
  foodie: {
    id: 'foodie',
    name: 'El Foodie',
    emoji: '🍕',
    description: 'La buena comida es tu pasión. ¿Has probado cocinar más en casa?',
    gradient: 'from-orange-500/20 to-yellow-500/20',
    borderColor: 'border-orange-500/30',
  },
  fashionista: {
    id: 'fashionista',
    name: 'La Fashionista',
    emoji: '👗',
    description: 'Tu estilo es impecable. ¡Pero ojo con las compras impulsivas!',
    gradient: 'from-pink-500/20 to-purple-500/20',
    borderColor: 'border-pink-500/30',
  },
  techie: {
    id: 'techie',
    name: 'El Techie',
    emoji: '📱',
    description: 'Siempre a la vanguardia tecnológica. Gadgets son tu debilidad.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/30',
  },
  nomad: {
    id: 'nomad',
    name: 'El Nómada',
    emoji: '✈️',
    description: 'El mundo es tu oficina. Transporte y viajes dominan tu presupuesto.',
    gradient: 'from-sky-500/20 to-indigo-500/20',
    borderColor: 'border-sky-500/30',
  },
  subscriber: {
    id: 'subscriber',
    name: 'El Suscriptor',
    emoji: '📺',
    description: 'Netflix, Spotify, Disney+... Tienes una suscripción para todo.',
    gradient: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/30',
  },
  homebody: {
    id: 'homebody',
    name: 'El Hogareño',
    emoji: '🏠',
    description: 'Tu casa es tu castillo. Inviertes en comodidad y servicios del hogar.',
    gradient: 'from-amber-500/20 to-orange-500/20',
    borderColor: 'border-amber-500/30',
  },
  entertainer: {
    id: 'entertainer',
    name: 'El Fiestero',
    emoji: '🎉',
    description: 'La vida es para disfrutarla. Entretenimiento es tu categoría estrella.',
    gradient: 'from-fuchsia-500/20 to-pink-500/20',
    borderColor: 'border-fuchsia-500/30',
  },
  minimalist: {
    id: 'minimalist',
    name: 'El Minimalista',
    emoji: '🧘',
    description: 'Menos es más. Gastas poco y en lo esencial. ¡Zen financiero!',
    gradient: 'from-gray-500/20 to-slate-500/20',
    borderColor: 'border-gray-500/30',
  },
  balanced: {
    id: 'balanced',
    name: 'El Equilibrado',
    emoji: '⚖️',
    description: 'Ni mucho ni poco. Tienes un balance saludable en tus finanzas.',
    gradient: 'from-cyan-500/20 to-teal-500/20',
    borderColor: 'border-cyan-500/30',
  },
  hustler: {
    id: 'hustler',
    name: 'El Emprendedor',
    emoji: '💼',
    description: 'Múltiples fuentes de ingreso. ¡Estás construyendo tu imperio!',
    gradient: 'from-yellow-500/20 to-amber-500/20',
    borderColor: 'border-yellow-500/30',
  },
  newbie: {
    id: 'newbie',
    name: 'El Nuevo',
    emoji: '🌱',
    description: 'Apenas empiezas tu viaje financiero. ¡Agrega más transacciones!',
    gradient: 'from-lime-500/20 to-green-500/20',
    borderColor: 'border-lime-500/30',
  },
};

// Keywords to detect category types
const CATEGORY_KEYWORDS = {
  food: ['comida', 'restaurante', 'delivery', 'uber eats', 'rappi', 'pedidos ya', 'food', 'almuerzo', 'cena', 'desayuno'],
  fashion: ['ropa', 'zapatos', 'moda', 'shopping', 'tienda', 'zara', 'h&m', 'fashion', 'vestir', 'accesorios'],
  tech: ['tecnología', 'tech', 'electrónica', 'gadget', 'apple', 'samsung', 'computadora', 'celular', 'gaming'],
  transport: ['transporte', 'uber', 'taxi', 'gasolina', 'metro', 'bus', 'viaje', 'avión', 'vuelo', 'travel'],
  subscriptions: ['suscripción', 'suscripciones', 'netflix', 'spotify', 'streaming', 'disney', 'hbo', 'prime'],
  home: ['hogar', 'casa', 'alquiler', 'servicios', 'luz', 'agua', 'internet', 'gas', 'mantenimiento'],
  entertainment: ['entretenimiento', 'ocio', 'cine', 'fiesta', 'bar', 'club', 'concierto', 'diversión'],
};

function matchesCategoryType(categoryName: string, keywords: string[]): boolean {
  const lowerName = categoryName.toLowerCase();
  return keywords.some(keyword => lowerName.includes(keyword));
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

    const expenses = transactions.filter(tx => tx.type === 'expense');
    const incomes = transactions.filter(tx => tx.type === 'income');

    const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const totalIncome = incomes.reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);

    // Calculate savings rate
    const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0;

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

    expenses.forEach(tx => {
      const category = categories.find(c => c.id === tx.categoryId);
      const categoryName = category?.name || '';

      Object.entries(CATEGORY_KEYWORDS).forEach(([type, keywords]) => {
        if (matchesCategoryType(categoryName, keywords)) {
          spendingByType[type] = (spendingByType[type] || 0) + Math.abs(tx.amountCents);
        }
      });
    });

    // Find dominant spending category
    const dominantType = Object.entries(spendingByType)
      .filter(([, amount]) => amount > 0)
      .sort(([, a], [, b]) => b - a)[0];

    const dominantPercentage = dominantType && totalExpenses > 0
      ? (dominantType[1] / totalExpenses) * 100
      : 0;

    // Check for multiple income sources (hustler)
    const uniqueIncomeDescriptions = new Set(incomes.map(tx => tx.description.toLowerCase()));
    if (uniqueIncomeDescriptions.size >= 3 && totalIncome > totalExpenses * 1.5) {
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
    if (transactions.length < 10 && totalExpenses < 50000) { // Less than $500
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
    <div className={`bg-gradient-to-br ${personality.gradient} rounded-2xl border ${personality.borderColor} p-4 lg:p-5 relative overflow-hidden`}>
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
                  {strength}% seguro
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
            <span>📊 Basado en {transactions.length} transacciones</span>
          </div>
        )}
      </div>
    </div>
  );
}
