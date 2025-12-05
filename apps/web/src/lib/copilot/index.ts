/**
 * Budget Copilot - Smart Rule-Based Financial Agent
 *
 * An intelligent conversational agent that helps users:
 * - Register income and expenses through natural language
 * - Track and manage debts with smart strategies
 * - Get proactive financial advice and insights
 * - Have real conversations about finances
 *
 * Personality: Friendly, sassy, encouraging - like a smart friend who's good with money
 */

import { nanoid } from 'nanoid';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getDb } from '../db/client';
import { categories, transactions, accounts, debts, userProfiles, scheduledBills, scheduledIncome } from '../db/schema';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ExtractedTransaction {
  amountCents: number;
  description: string;
  merchant: string | null;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
  type: 'income' | 'expense';
  notes: string | null;
}

export interface CopilotResponse {
  message: string;
  transaction?: ExtractedTransaction;
  transactionCreated?: boolean;
  transactionId?: string;
  suggestedCategories?: Array<{
    id: string;
    name: string;
    emoji: string | null;
  }>;
  needsMoreInfo?: boolean;
  missingFields?: string[];
  needsCategoryConfirmation?: boolean;
  categoryOptions?: Array<{ name: string; emoji: string }>;
  pendingTransaction?: Partial<ExtractedTransaction>;
  intent?: ConversationIntent;
  insights?: FinancialInsight[];
  debtCreated?: boolean;
  debtId?: string;
  followUpActions?: FollowUpAction[];
}

export type ConversationIntent =
  | 'greeting'
  | 'transaction'
  | 'debt_register'
  | 'debt_inquiry'
  | 'debt_plan'
  | 'balance_inquiry'
  | 'spending_summary'
  | 'profile_setup'
  | 'bill_schedule'
  | 'income_schedule'
  | 'budget_tips'
  | 'book_recommendation'
  | 'help'
  | 'conversation'
  | 'unknown';

export interface FinancialInsight {
  type: 'tip' | 'warning' | 'achievement' | 'recommendation';
  message: string;
  priority: 'low' | 'medium' | 'high';
}

export interface FollowUpAction {
  label: string;
  type: 'quick_reply' | 'action_button';
  value: string;
}

// ============================================================================
// CATEGORY INTELLIGENCE - Maps keywords to categories with emojis
// ============================================================================

const CATEGORY_MAPPINGS: Array<{
  keywords: string[];
  category: string;
  emoji: string;
}> = [
  // Food & Drinks
  {
    keywords: [
      'starbucks',
      'café',
      'cafe',
      'coffee',
      'cafetería',
      'cafeteria',
      'latte',
      'cappuccino',
      'espresso',
      'frappuccino',
    ],
    category: 'Café',
    emoji: '☕',
  },
  {
    keywords: [
      'restaurante',
      'restaurant',
      'comida',
      'cena',
      'almuerzo',
      'desayuno',
      'brunch',
      'comer',
      'cenar',
      'almorzar',
      'sushi',
      'pizza',
      'tacos',
      'hamburguesa',
      'mariscos',
      'buffet',
      'chilis',
      'applebees',
      'mcdonalds',
      'burger king',
      'wendys',
      'kfc',
      'dominos',
      'little caesars',
      'papa johns',
      'subway',
      'pollo loco',
      'chipotle',
      'taco bell',
      'carl\'s jr',
      'carls jr',
      'vips',
      'sanborns',
      'ihop',
      'dennys',
      'wingstop',
      'buffalo wild wings',
      'italianni',
      'italiannis',
      'olive garden',
    ],
    category: 'Restaurantes',
    emoji: '🍽️',
  },
  {
    keywords: [
      'super',
      'supermercado',
      'mandado',
      'groceries',
      'despensa',
      'walmart',
      'soriana',
      'chedraui',
      'heb',
      'costco',
      'sams',
      'sam\'s',
      'aurrera',
      'bodega',
      'la comer',
      'comercial mexicana',
      'superama',
      'city market',
      'fresko',
      'mega',
      'alsuper',
    ],
    category: 'Supermercado',
    emoji: '🛒',
  },
  {
    keywords: [
      'bar',
      'cantina',
      'antro',
      'club',
      'cerveza',
      'chela',
      'cheve',
      'alcohol',
      'vino',
      'tequila',
      'mezcal',
      'tragos',
      'copas',
      'shots',
      'drinks',
      'bebidas',
      'botella',
      'fiesta',
      'party',
      'nightclub',
    ],
    category: 'Bar y Antros',
    emoji: '🍺',
  },

  // Transportation
  {
    keywords: [
      'uber',
      'didi',
      'cabify',
      'taxi',
      'lyft',
      'beat',
      'indriver',
      'in driver',
    ],
    category: 'Rideshare',
    emoji: '🚕',
  },
  {
    keywords: [
      'gasolina',
      'gas',
      'combustible',
      'pemex',
      'oxxo gas',
      'bp',
      'shell',
      'mobil',
      'cargar gasolina',
      'llenar tanque',
      'tanque lleno',
    ],
    category: 'Gasolina',
    emoji: '⛽',
  },
  {
    keywords: [
      'metro',
      'metrobus',
      'metrobús',
      'camion',
      'camión',
      'autobus',
      'autobús',
      'bus',
      'pesero',
      'combi',
      'transporte público',
      'transporte publico',
      'pasaje',
    ],
    category: 'Transporte Público',
    emoji: '🚇',
  },
  {
    keywords: [
      'estacionamiento',
      'parking',
      'parquímetro',
      'parquimetro',
      'valet',
      'pensión',
      'pension',
    ],
    category: 'Estacionamiento',
    emoji: '🅿️',
  },
  {
    keywords: [
      'vuelo',
      'avion',
      'avión',
      'aerolínea',
      'aerolinea',
      'volaris',
      'viva aerobus',
      'aeromexico',
      'aeroméxico',
      'interjet',
      'american airlines',
      'united',
      'delta',
      'southwest',
      'flight',
      'airplane',
      'boleto de avión',
    ],
    category: 'Vuelos',
    emoji: '✈️',
  },

  // Entertainment & Streaming
  {
    keywords: [
      'netflix',
      'spotify',
      'disney',
      'disney+',
      'hbo',
      'hbo max',
      'max',
      'amazon prime',
      'prime video',
      'apple tv',
      'paramount',
      'paramount+',
      'star+',
      'star plus',
      'crunchyroll',
      'youtube premium',
      'twitch',
      'streaming',
      'suscripcion',
      'suscripción',
    ],
    category: 'Streaming',
    emoji: '📺',
  },
  {
    keywords: [
      'cine',
      'cinemex',
      'cinepolis',
      'cinépolis',
      'movie',
      'película',
      'pelicula',
      'palomitas',
      'popcorn',
      'imax',
      '4dx',
      'vip',
    ],
    category: 'Cine',
    emoji: '🎬',
  },
  {
    keywords: [
      'concierto',
      'concert',
      'show',
      'teatro',
      'theater',
      'ticketmaster',
      'boletia',
      'superboletos',
      'evento',
      'festival',
      'foro',
      'auditorio',
      'arena',
      'estadio',
    ],
    category: 'Eventos',
    emoji: '🎭',
  },
  {
    keywords: [
      'videojuego',
      'videojuegos',
      'videogame',
      'videogames',
      'gaming',
      'xbox',
      'playstation',
      'ps5',
      'ps4',
      'nintendo',
      'switch',
      'steam',
      'epic games',
      'game pass',
      'gamepass',
      'psn',
      'ps plus',
    ],
    category: 'Videojuegos',
    emoji: '🎮',
  },

  // Shopping
  {
    keywords: [
      'ropa',
      'clothes',
      'clothing',
      'zara',
      'h&m',
      'bershka',
      'pull & bear',
      'pull and bear',
      'forever 21',
      'c&a',
      'liverpool',
      'palacio de hierro',
      'shein',
      'coppel',
      'sears',
      'suburbia',
      'fashion',
      'moda',
      'vestido',
      'camisa',
      'pantalón',
      'pantalon',
      'zapatos',
      'tenis',
      'sneakers',
    ],
    category: 'Ropa',
    emoji: '👕',
  },
  {
    keywords: [
      'amazon',
      'mercado libre',
      'mercadolibre',
      'aliexpress',
      'wish',
      'ebay',
      'online shopping',
      'compra en línea',
      'compra en linea',
      'paquete',
      'envío',
      'envio',
    ],
    category: 'Compras Online',
    emoji: '📦',
  },
  {
    keywords: [
      'electrónica',
      'electronica',
      'electronics',
      'best buy',
      'office depot',
      'office max',
      'radioshack',
      'steren',
      'gadget',
      'gadgets',
      'tecnología',
      'tecnologia',
      'tech',
      'computadora',
      'laptop',
      'tablet',
      'celular',
      'teléfono',
      'telefono',
      'iphone',
      'samsung',
      'xiaomi',
      'apple',
      'audifonos',
      'audífonos',
      'airpods',
    ],
    category: 'Electrónica',
    emoji: '📱',
  },

  // Health & Wellness
  {
    keywords: [
      'gym',
      'gimnasio',
      'smartfit',
      'smart fit',
      'sport city',
      'sportcity',
      'crossfit',
      'fitness',
      'ejercicio',
      'workout',
      'membresía',
      'membresia',
      'entrenamiento',
    ],
    category: 'Gimnasio',
    emoji: '💪',
  },
  {
    keywords: [
      'doctor',
      'médico',
      'medico',
      'hospital',
      'clínica',
      'clinica',
      'consulta',
      'salud',
      'health',
      'dentista',
      'dental',
      'oculista',
      'oftalmólogo',
      'oftalmologo',
      'lentes',
      'gafas',
      'glasses',
      'laboratorio',
      'análisis',
      'analisis',
      'estudios',
      'radiografía',
      'radiografia',
      'farmacia',
      'pharmacy',
      'medicina',
      'medicinas',
      'medicamentos',
      'farmacias del ahorro',
      'farmacias similares',
      'san pablo',
      'guadalajara',
      'benavides',
    ],
    category: 'Salud',
    emoji: '🏥',
  },
  {
    keywords: [
      'spa',
      'masaje',
      'massage',
      'manicure',
      'pedicure',
      'peluquería',
      'peluqueria',
      'salón',
      'salon',
      'estética',
      'estetica',
      'barbería',
      'barberia',
      'corte de pelo',
      'haircut',
      'facial',
      'tratamiento',
      'beauty',
      'belleza',
    ],
    category: 'Belleza y Spa',
    emoji: '💅',
  },

  // Bills & Services
  {
    keywords: [
      'luz',
      'electricidad',
      'electric',
      'cfe',
      'recibo de luz',
    ],
    category: 'Luz',
    emoji: '💡',
  },
  {
    keywords: [
      'agua',
      'water',
      'recibo de agua',
      'sacmex',
      'siapa',
    ],
    category: 'Agua',
    emoji: '💧',
  },
  {
    keywords: [
      'gas natural',
      'gas lp',
      'gas',
      'naturgy',
      'cilindro',
      'tanque de gas',
    ],
    category: 'Gas',
    emoji: '🔥',
  },
  {
    keywords: [
      'internet',
      'wifi',
      'telmex',
      'totalplay',
      'izzi',
      'megacable',
      'axtel',
      'infinitum',
    ],
    category: 'Internet',
    emoji: '🌐',
  },
  {
    keywords: [
      'celular',
      'teléfono',
      'telefono',
      'phone plan',
      'plan de celular',
      'telcel',
      'at&t',
      'movistar',
      'unefon',
      'virgin mobile',
      'recarga',
      'tiempo aire',
    ],
    category: 'Celular',
    emoji: '📞',
  },
  {
    keywords: [
      'renta',
      'rent',
      'alquiler',
      'arrendamiento',
      'mensualidad',
      'departamento',
      'casa',
    ],
    category: 'Renta',
    emoji: '🏠',
  },
  {
    keywords: [
      'seguro',
      'insurance',
      'aseguradora',
      'póliza',
      'poliza',
      'gnp',
      'axa',
      'qualitas',
      'mapfre',
      'metlife',
      'seguros',
    ],
    category: 'Seguros',
    emoji: '🛡️',
  },

  // Education
  {
    keywords: [
      'escuela',
      'school',
      'colegiatura',
      'tuition',
      'universidad',
      'university',
      'colegio',
      'curso',
      'course',
      'clase',
      'class',
      'libros',
      'books',
      'útiles',
      'utiles',
      'educación',
      'educacion',
      'tec',
      'unam',
      'ipn',
      'itesm',
      'udemy',
      'coursera',
      'platzi',
      'domestika',
      'masterclass',
    ],
    category: 'Educación',
    emoji: '📚',
  },

  // Travel & Hotels
  {
    keywords: [
      'hotel',
      'airbnb',
      'hostal',
      'hospedaje',
      'booking',
      'trivago',
      'expedia',
      'marriott',
      'hilton',
      'hyatt',
      'holiday inn',
      'fiesta inn',
      'city express',
      'habitación',
      'habitacion',
      'noche',
    ],
    category: 'Hospedaje',
    emoji: '🏨',
  },
  {
    keywords: [
      'vacaciones',
      'vacation',
      'viaje',
      'trip',
      'travel',
      'tour',
      'excursión',
      'excursion',
      'turismo',
      'tourism',
    ],
    category: 'Viajes',
    emoji: '✈️',
  },

  // Pets
  {
    keywords: [
      'mascota',
      'pet',
      'perro',
      'dog',
      'gato',
      'cat',
      'veterinario',
      'vet',
      'petco',
      '+kota',
      'petsmart',
      'croquetas',
      'comida de perro',
      'comida de gato',
      'vacuna',
      'grooming',
      'estética canina',
    ],
    category: 'Mascotas',
    emoji: '🐾',
  },

  // Convenience stores
  {
    keywords: [
      'oxxo',
      '7-eleven',
      '7 eleven',
      'circle k',
      'extra',
      'tienda',
      'tiendita',
      'abarrotes',
      'convenience',
    ],
    category: 'Tienda',
    emoji: '🏪',
  },

  // Gifts & Donations
  {
    keywords: [
      'regalo',
      'gift',
      'presente',
      'cumpleaños',
      'birthday',
      'navidad',
      'christmas',
      'aniversario',
      'anniversary',
    ],
    category: 'Regalos',
    emoji: '🎁',
  },
  {
    keywords: [
      'donación',
      'donacion',
      'donation',
      'caridad',
      'charity',
      'limosna',
      'ayuda',
      'fundación',
      'fundacion',
    ],
    category: 'Donaciones',
    emoji: '❤️',
  },

  // Income categories
  {
    keywords: [
      'salario',
      'salary',
      'sueldo',
      'quincena',
      'nómina',
      'nomina',
      'pago',
      'paycheck',
      'payroll',
      'trabajo',
      'work',
      'empleo',
    ],
    category: 'Salario',
    emoji: '💰',
  },
  {
    keywords: [
      'freelance',
      'proyecto',
      'project',
      'consultoría',
      'consultoria',
      'consulting',
      'cliente',
      'client',
      'trabajo independiente',
      'chambita',
      'jale',
    ],
    category: 'Freelance',
    emoji: '💻',
  },
  {
    keywords: [
      'bono',
      'bonus',
      'aguinaldo',
      'gratificación',
      'gratificacion',
      'incentivo',
      'comisión',
      'comision',
      'commission',
    ],
    category: 'Bonos',
    emoji: '🎯',
  },
  {
    keywords: [
      'venta',
      'sale',
      'vendí',
      'vendi',
      'sold',
      'marketplace',
      'segunda mano',
    ],
    category: 'Ventas',
    emoji: '🏷️',
  },
  {
    keywords: [
      'reembolso',
      'refund',
      'devolución',
      'devolucion',
      'return',
      'cashback',
      'cash back',
    ],
    category: 'Reembolsos',
    emoji: '↩️',
  },
  {
    keywords: [
      'inversión',
      'inversion',
      'investment',
      'dividendo',
      'dividend',
      'intereses',
      'interest',
      'rendimiento',
      'cetes',
      'acciones',
      'stocks',
      'cripto',
      'crypto',
      'bitcoin',
    ],
    category: 'Inversiones',
    emoji: '📈',
  },
  {
    keywords: [
      'transferencia',
      'transfer',
      'depósito',
      'deposito',
      'deposit',
      'me depositaron',
      'me transfirieron',
    ],
    category: 'Transferencias',
    emoji: '🔄',
  },
];

// ============================================================================
// AMOUNT PARSING - Handles various money formats
// ============================================================================

function parseAmount(text: string): number | null {
  // Remove common words that might interfere
  const cleanText = text.toLowerCase();

  // Patterns for different money formats
  const patterns = [
    // $1,234.56 or $1234.56 (with decimals)
    /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2}))/,
    // $1,234 or $1234 (no decimals, large amounts)
    /\$?\s*(\d{1,3}(?:,\d{3})+)(?!\.\d)/,
    // $50 or $50.00 (simple amounts)
    /\$?\s*(\d+(?:\.\d{1,2})?)/,
    // 50 pesos or 50 dolares
    /(\d+(?:\.\d{1,2})?)\s*(?:pesos?|dlls?|dólares?|dolares?|varos?|bolas?)/i,
    // mil pesos (thousands)
    /(\d+(?:\.\d{1,2})?)\s*mil/i,
  ];

  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      let numStr = match[1].replace(/,/g, '');
      let amount = parseFloat(numStr);

      // Check for "mil" (thousand)
      if (/mil/i.test(cleanText) && amount < 100) {
        amount *= 1000;
      }

      // If the amount seems like it has cents (has .XX) keep as is
      // Otherwise assume whole dollars
      if (amount > 0) {
        // Check if original had decimal point with 2 digits
        const hasDecimal = /\.\d{2}/.test(numStr);
        if (hasDecimal) {
          return Math.round(amount * 100);
        } else {
          return Math.round(amount * 100);
        }
      }
    }
  }

  return null;
}

// ============================================================================
// DATE PARSING - Handles natural language dates
// ============================================================================

function parseDate(text: string): string {
  const today = new Date();
  const lower = text.toLowerCase();

  if (
    lower.includes('ayer') ||
    lower.includes('yesterday')
  ) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0]!;
  }

  if (
    lower.includes('anteayer') ||
    lower.includes('antier')
  ) {
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    return dayBefore.toISOString().split('T')[0]!;
  }

  if (
    lower.includes('la semana pasada') ||
    lower.includes('last week')
  ) {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek.toISOString().split('T')[0]!;
  }

  // Try to match specific dates like "el 15" or "día 20"
  const dayMatch = lower.match(/(?:el\s+)?(?:día\s+)?(\d{1,2})(?:\s+de)?/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1]!);
    if (day >= 1 && day <= 31) {
      const date = new Date(today);
      date.setDate(day);
      // If the date is in the future, assume last month
      if (date > today) {
        date.setMonth(date.getMonth() - 1);
      }
      return date.toISOString().split('T')[0]!;
    }
  }

  return today.toISOString().split('T')[0]!;
}

// ============================================================================
// INTENT DETECTION - Determines what the user wants
// ============================================================================

function detectIntent(text: string): ConversationIntent {
  const lower = text.toLowerCase().trim();

  // Greetings
  if (
    /^(hola|hey|buenas?|qué tal|que tal|hi|hello|buenos días|buenas tardes|buenas noches|saludos|qué onda|que onda|sup|what'?s up)/.test(lower) ||
    lower.length <= 10 && /^(hola|hey|hi|hello|buenas)$/.test(lower)
  ) {
    return 'greeting';
  }

  // Help
  if (
    /(\?|ayuda|help|cómo funciona|como funciona|qué puedo|que puedo|qué haces|que haces|para qué sirves|para que sirves|opciones|comandos)/.test(lower)
  ) {
    return 'help';
  }

  // Spending summary / Balance inquiry
  if (
    /(cuánto|cuanto|cuál|cual|total|resumen|summary|balance|gastado|gastando|gastos|llevó|llevo|tengo|ahorrado|ahorré|ahorre|estoy|situación|situacion|cómo voy|como voy|cómo estoy|como estoy|mes|semana|hoy|ayer)/i.test(lower) &&
    /(gast|ahorr|dinero|plata|lana|varo|feria|billete|presupuesto|budget)/i.test(lower)
  ) {
    return 'spending_summary';
  }

  // Debt inquiry
  if (
    /(cuánto debo|cuanto debo|mis deudas|deudas|cuánta deuda|cuanta deuda|lo que debo|deuda total|total de deuda)/i.test(lower)
  ) {
    return 'debt_inquiry';
  }

  // Debt payment plan strategies
  if (
    /(plan de pago|pagar deuda|estrategia|avalancha|bola de nieve|snowball|avalanche|priorizar|atacar deuda|método|metodo|eliminar deuda|cómo pago|como pago mis deudas)/i.test(lower)
  ) {
    return 'debt_plan';
  }

  // Bill scheduling
  if (
    /(agendar|programar|recurrente|recordar|pago fijo|factura|bill|servicios?|luz|agua|gas|internet|renta|hipoteca|cable|streaming|suscripción|suscripcion)\s*(mensual|cada mes|fijo|automático|automatico|recordatorio)/i.test(lower) ||
    /(mi (luz|agua|gas|renta|internet|hipoteca) es de|pago de (luz|agua|gas|renta|internet)|tengo que pagar)/i.test(lower)
  ) {
    return 'bill_schedule';
  }

  // Income scheduling
  if (
    /(me pagan (cada|los|el)|cobro (cada|los|el)|día de pago|dia de pago|quincena es el|salario cae|nómina cae|nomina cae|programar ingreso|ingreso fijo|ingreso recurrente)/i.test(lower)
  ) {
    return 'income_schedule';
  }

  // Budget tips and rules
  if (
    /(regla|50.?30.?20|70.?20.?10|presupuesto|cómo distribuir|como distribuir|tip financiero|consejo financiero|cómo ahorrar|como ahorrar|págate primero|pagate primero|pay yourself|budget)/i.test(lower)
  ) {
    return 'budget_tips';
  }

  // Book recommendations
  if (
    /(libro|book|leer|lectura|recomienda|recomendación|recomendacion|educación financiera|educacion financiera|aprender de finanzas|recursos|padre rico)/i.test(lower)
  ) {
    return 'book_recommendation';
  }

  // Debt registration
  if (
    /(debo|deuda|préstamo|prestamo|tarjeta|crédito|credito|financiar|financiado|mensualidades|msi|pagos chiquitos)/i.test(lower) &&
    /(\$|pesos|\d+%|\d+\s*mil)/i.test(lower)
  ) {
    return 'debt_register';
  }

  // Profile setup - Salary, pay frequency, etc.
  if (
    /(mi salario|mi sueldo|gano|me pagan|cobro|salario es|sueldo es|gano al mes|mensual|quincena de|pago quincenal|pago mensual|pago semanal|cada quincena|cada mes|cada semana)/i.test(lower) &&
    /(\$|\d+\s*(?:pesos|mil|k)?)/i.test(lower)
  ) {
    return 'profile_setup';
  }

  // Transaction - Expense patterns
  if (
    /(gasté|gaste|pagué|pague|compré|compre|me costó|me costo|fueron|salió|salio|cobr|di|dí)/i.test(lower) ||
    /^(\$|en\s|para\s)/i.test(lower) ||
    /(\$\d|\d+\s*pesos|\d+\s*varos|\d+\s*bolas)/i.test(lower)
  ) {
    return 'transaction';
  }

  // Transaction - Income patterns
  if (
    /(me pagaron|me depositaron|recibí|recibi|cobré|cobre|gané|gane|entró|entro|llegó|llego|ingreso|quincena|salario|sueldo)/i.test(lower)
  ) {
    return 'transaction';
  }

  // Generic transaction with just a number
  if (/\$\s*\d/.test(lower) || /\d+\s*(pesos|dlls|varos)/i.test(lower)) {
    return 'transaction';
  }

  // Conversation (questions about finance)
  if (
    /(debería|deberia|conviene|recomiendas|consejo|tip|sugerencia|qué opinas|que opinas|crees que|piensas que|vale la pena|mejor|peor)/i.test(lower)
  ) {
    return 'conversation';
  }

  return 'unknown';
}

// ============================================================================
// TRANSACTION TYPE DETECTION - Income vs Expense
// ============================================================================

function detectTransactionType(text: string): 'income' | 'expense' {
  const lower = text.toLowerCase();

  // Income keywords
  const incomeKeywords = [
    'me pagaron',
    'me depositaron',
    'recibí',
    'recibi',
    'cobré',
    'cobre',
    'gané',
    'gane',
    'entró',
    'entro',
    'llegó',
    'llego',
    'ingreso',
    'quincena',
    'salario',
    'sueldo',
    'nómina',
    'nomina',
    'bono',
    'aguinaldo',
    'freelance',
    'proyecto',
    'cliente',
    'vendí',
    'vendi',
    'reembolso',
    'devolucion',
    'devolución',
    'cashback',
    'dividendo',
    'intereses',
    'rendimiento',
  ];

  for (const keyword of incomeKeywords) {
    if (lower.includes(keyword)) {
      return 'income';
    }
  }

  return 'expense';
}

// ============================================================================
// CATEGORY DETECTION - Smart category matching
// ============================================================================

function detectCategory(
  text: string,
  existingCategories: Array<{ id: string; name: string; emoji: string | null }>
): { name: string; emoji: string; id?: string } | null {
  const lower = text.toLowerCase();

  // First try to match against existing user categories
  for (const cat of existingCategories) {
    const catLower = cat.name.toLowerCase();
    if (lower.includes(catLower)) {
      return { name: cat.name, emoji: cat.emoji || '📦', id: cat.id };
    }
  }

  // Then try our category mappings
  for (const mapping of CATEGORY_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        // Check if this category exists in user's categories
        const existing = existingCategories.find(
          (c) => c.name.toLowerCase() === mapping.category.toLowerCase()
        );
        if (existing) {
          return { name: existing.name, emoji: existing.emoji || mapping.emoji, id: existing.id };
        }
        return { name: mapping.category, emoji: mapping.emoji };
      }
    }
  }

  return null;
}

// ============================================================================
// DESCRIPTION EXTRACTION - Gets a clean description
// ============================================================================

function extractDescription(text: string, category: string | null): string {
  let desc = text
    // Remove money amounts
    .replace(/\$\s*[\d,.]+/g, '')
    .replace(/\d+\s*(pesos|dlls|dólares|dolares|varos|bolas|mil)/gi, '')
    // Remove common prefixes
    .replace(/^(gasté|gaste|pagué|pague|compré|compre|fueron|me costó|me costo)\s*/gi, '')
    .replace(/^(me pagaron|me depositaron|recibí|recibi|cobré|cobre)\s*/gi, '')
    .replace(/^(en|de|por|para)\s+/gi, '')
    // Remove date references
    .replace(/(ayer|anteayer|antier|hoy|la semana pasada)/gi, '')
    .replace(/el\s+\d{1,2}(\s+de\s+\w+)?/gi, '')
    // Clean up
    .trim()
    .replace(/\s+/g, ' ');

  // If description is too short, use the category
  if (desc.length < 3 && category) {
    desc = category;
  }

  // Capitalize first letter
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  return desc || 'Transacción';
}

// ============================================================================
// RESPONSE GENERATORS - Sassy personality responses
// ============================================================================

const GREETING_RESPONSES = [
  '¡Hola! 👋 ¿Qué quieres registrar hoy? Cuéntame tus gastos o ingresos.',
  '¡Hey! 💰 ¿Gastaste algo o te llegó dinero? Cuéntame.',
  '¡Buenas! ¿En qué andas? Dime tus movimientos financieros.',
  '¡Qué onda! 🙌 Aquí andamos para ayudarte con tu lana.',
  '¡Hola! ¿Cómo va ese presupuesto? Cuéntame qué pasó.',
  '¡Hey bro! 😎 ¿Listo para domar a ese monstruo financiero?',
  '¡Hola! Soy tu coach financiero favorito 💪 ¿En qué te ayudo?',
  '¡Qué tal! 🔥 Aquí estoy para que tus finanzas estén más ordenadas que tu playlist.',
  '¡Buenas! Respira, tus deudas se ven grandes pero yo soy más grande 😉',
  '¡Hey! 💸 Cuéntame qué pasó con tu lana hoy.',
];

// Encouraging messages for after transactions
const ENCOURAGEMENT_MESSAGES = [
  '¡Vas muy bien! 💪',
  'Cada peso cuenta 🎯',
  '¡Eso es control financiero! 📊',
  'Tu yo del futuro te lo agradecerá 🙌',
  '¡Sigue así, campeón! 🏆',
];

// Budget tips based on 50/30/20 and 70/20/10 rules
const BUDGET_TIPS = {
  '50_30_20': `📊 **Regla 50/30/20:**
• 50% Necesidades (renta, servicios, comida)
• 30% Deseos (entretenimiento, restaurantes)
• 20% Ahorro y deudas`,
  '70_20_10': `📊 **Regla 70/20/10:**
• 70% Gastos del día a día
• 20% Ahorro
• 10% Deudas o inversiones`,
  'pay_yourself_first': `💡 **Págate a ti primero:**
Apenas te paguen, mueve el 20% a ahorro antes de gastar.`,
};

// Book recommendations
const BOOK_RECOMMENDATIONS = [
  { title: 'Padre Rico, Padre Pobre', author: 'Robert Kiyosaki', emoji: '📕' },
  { title: 'The Psychology of Money', author: 'Morgan Housel', emoji: '🧠' },
  { title: 'Total Money Makeover', author: 'Dave Ramsey', emoji: '💪' },
  { title: 'The Simple Path to Wealth', author: 'JL Collins', emoji: '🛤️' },
  { title: 'Your Money or Your Life', author: 'Vicki Robin', emoji: '⚖️' },
];

const EXPENSE_CONFIRMATIONS = [
  (amount: string, desc: string, cat: string) =>
    `Listo, registré $${amount} en ${desc} (${cat}). 💸 ¿Algo más?`,
  (amount: string, desc: string, cat: string) =>
    `¡Anotado! $${amount} de ${desc} en ${cat}. 📝`,
  (amount: string, desc: string, cat: string) =>
    `Hecho. $${amount} para ${desc} → ${cat}. 💰`,
  (amount: string, desc: string, cat: string) =>
    `¡Registrado! ${desc}: $${amount} (${cat}). ¿Qué más?`,
];

const INCOME_CONFIRMATIONS = [
  (amount: string, desc: string, cat: string) =>
    `¡Qué bien! Registré un ingreso de $${amount} por ${desc}. 🎉`,
  (amount: string, desc: string) =>
    `¡Excelente! $${amount} de ${desc} anotados. 💪 ¡Sigue así!`,
  (amount: string, desc: string, cat: string) =>
    `¡Dinero entrando! $${amount} por ${desc} (${cat}). 🤑`,
  (amount: string, desc: string) =>
    `¡Nice! $${amount} registrados por ${desc}. Eso me gusta. 💰`,
];

const HELP_RESPONSE = `¡Claro que te ayudo! 🤓 Soy tu coach financiero personal. Esto puedo hacer:

📝 **Registrar gastos:**
• "Gasté $50 en Starbucks"
• "$120 de Uber"
• "Pagué $800 del super"

💰 **Registrar ingresos:**
• "Me pagaron $15,000 de quincena"
• "Cobré $5,000 de un proyecto"

💵 **Configurar tu salario:**
• "Gano $15,000 al mes"
• "Mi quincena es de $7,500"

📊 **Ver tu situación:**
• "¿Cuánto llevo gastado?"
• "¿Cuánto debo en total?"

💳 **Deudas y estrategias:**
• "Tengo una tarjeta con $20,000 al 45%"
• "¿Cómo pago mis deudas?" (Avalancha vs Bola de Nieve)

📚 **Tips y educación:**
• "¿Qué es la regla 50/30/20?"
• "Recomiéndame un libro de finanzas"

📅 **Gastos fijos:** (próximamente)
• "Mi luz es de $500 el día 15"

¿Qué quieres hacer? 💪`;

const UNKNOWN_RESPONSES = [
  'Mmm no entendí bien. 🤔 ¿Quieres registrar un gasto? Dime algo como "Gasté $50 en..."',
  '¿Cómo? No le agarré. Intenta decirme cuánto gastaste y en qué.',
  'No capto. 😅 ¿Es un gasto o ingreso? Dime el monto y para qué fue.',
  'Perdón, no entendí. ¿Puedes darme más detalles? Ej: "Gasté $100 en restaurante"',
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ============================================================================
// FINANCIAL CONTEXT BUILDER
// ============================================================================

interface FinancialContext {
  categories: Array<{ id: string; name: string; emoji: string | null }>;
  recentTransactions: Array<{
    description: string;
    amountCents: number;
    type: string;
    categoryName: string | null;
    date: string;
  }>;
  monthlyStats: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    transactionCount: number;
  };
  debts: Array<{
    name: string;
    currentBalanceCents: number;
    aprPercent: number;
    type: string;
  }>;
}

async function buildFinancialContext(
  userId: string
): Promise<FinancialContext> {
  const db = getDb();

  // Get user's categories
  const userCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      emoji: categories.emoji,
    })
    .from(categories)
    .where(eq(categories.userId, userId));

  // Get recent transactions (last 10)
  const recentTx = await db
    .select({
      description: transactions.description,
      amountCents: transactions.amountCents,
      type: transactions.type,
      categoryId: transactions.categoryId,
      date: transactions.date,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(10);

  // Map category names to transactions
  const categoryMap = new Map(userCategories.map((c) => [c.id, c.name]));
  const recentTransactions = recentTx.map((tx) => ({
    description: tx.description,
    amountCents: tx.amountCents,
    type: tx.type,
    categoryName: tx.categoryId ? categoryMap.get(tx.categoryId) || null : null,
    date: tx.date,
  }));

  // Get this month's stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]!;

  const monthTx = await db
    .select({
      amountCents: transactions.amountCents,
      type: transactions.type,
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), gte(transactions.date, startOfMonth))
    );

  const totalIncome = monthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const totalExpenses = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  // Get active debts
  let userDebts: Array<{
    name: string;
    currentBalanceCents: number;
    aprPercent: number;
    type: string;
  }> = [];
  try {
    userDebts = await db
      .select({
        name: debts.name,
        currentBalanceCents: debts.currentBalanceCents,
        aprPercent: debts.aprPercent,
        type: debts.type,
      })
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));
  } catch {
    // Debts table might not exist
  }

  return {
    categories: userCategories,
    recentTransactions,
    monthlyStats: {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      transactionCount: monthTx.length,
    },
    debts: userDebts,
  };
}

// ============================================================================
// ACTION EXECUTORS
// ============================================================================

async function executeCreateTransaction(
  userId: string,
  data: {
    amountCents: number;
    description: string;
    type: 'income' | 'expense';
    categoryName?: string;
    categoryEmoji?: string;
    date?: string;
  }
): Promise<{
  transactionId: string;
  categoryId: string | null;
  transaction: ExtractedTransaction;
}> {
  const db = getDb();

  // Get or create default account
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  let defaultAccount = userAccounts[0];

  if (!defaultAccount) {
    const id = nanoid();
    await db.insert(accounts).values({
      id,
      userId,
      name: 'Efectivo',
      type: 'cash',
      createdAt: Date.now(),
    });
    const [newAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id));
    if (!newAccount) {
      throw new Error('Failed to create default account');
    }
    defaultAccount = newAccount;
  }

  // Find or create category
  let categoryId: string | null = null;
  if (data.categoryName) {
    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    const existingCategory = userCategories.find(
      (c) => c.name.toLowerCase() === data.categoryName!.toLowerCase()
    );

    if (existingCategory) {
      categoryId = existingCategory.id;
    } else {
      // Create new category
      const newCategoryId = nanoid();
      await db.insert(categories).values({
        id: newCategoryId,
        userId,
        name: data.categoryName,
        emoji: data.categoryEmoji || '📦',
        createdAt: Date.now(),
      });
      categoryId = newCategoryId;
    }
  }

  // Create transaction
  const transactionId = nanoid();
  const now = Date.now();
  const date =
    data.date || new Date().toISOString().split('T')[0] || '2024-01-01';

  await db.insert(transactions).values({
    id: transactionId,
    userId,
    date,
    description: data.description,
    amountCents:
      data.type === 'expense'
        ? -Math.abs(data.amountCents)
        : Math.abs(data.amountCents),
    type: data.type,
    categoryId,
    accountId: defaultAccount.id,
    cleared: false,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

  const transaction: ExtractedTransaction = {
    amountCents: data.amountCents,
    description: data.description,
    merchant: null,
    date,
    categoryId,
    categoryName: data.categoryName || null,
    type: data.type,
    notes: null,
  };

  return { transactionId, categoryId, transaction };
}

async function executeCreateDebt(
  userId: string,
  data: {
    amountCents: number;
    debtName: string;
    debtType?: string;
    aprPercent?: number;
    minimumPaymentCents?: number;
  }
): Promise<{ debtId: string }> {
  const db = getDb();

  const id = nanoid();
  const now = Date.now();

  // Calculate danger score
  let dangerScore = 0;
  if (data.aprPercent) {
    if (data.aprPercent >= 25) dangerScore += 40;
    else if (data.aprPercent >= 18) dangerScore += 30;
    else if (data.aprPercent >= 12) dangerScore += 20;
    else if (data.aprPercent >= 6) dangerScore += 10;
  }
  const balanceDollars = data.amountCents / 100;
  if (balanceDollars >= 50000) dangerScore += 40;
  else if (balanceDollars >= 20000) dangerScore += 30;
  else if (balanceDollars >= 10000) dangerScore += 20;
  else if (balanceDollars >= 5000) dangerScore += 10;

  const debtType = (data.debtType || 'other') as
    | 'credit_card'
    | 'personal_loan'
    | 'auto_loan'
    | 'mortgage'
    | 'student_loan'
    | 'medical'
    | 'other';

  await db.insert(debts).values({
    id,
    userId,
    name: data.debtName,
    type: debtType,
    originalBalanceCents: data.amountCents,
    currentBalanceCents: data.amountCents,
    aprPercent: data.aprPercent ?? 0,
    minimumPaymentCents: data.minimumPaymentCents || null,
    status: 'active',
    dangerScore: Math.min(100, dangerScore),
    createdAt: now,
    updatedAt: now,
  });

  return { debtId: id };
}

async function executeUpdateProfile(
  userId: string,
  data: {
    monthlySalaryCents?: number;
    payFrequency?: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  }
): Promise<{ profileUpdated: boolean }> {
  const db = getDb();
  const now = Date.now();

  // Check if profile exists
  const [existingProfile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  if (existingProfile) {
    // Update existing profile
    await db
      .update(userProfiles)
      .set({
        monthlySalaryCents: data.monthlySalaryCents ?? existingProfile.monthlySalaryCents,
        payFrequency: data.payFrequency ?? existingProfile.payFrequency,
        updatedAt: now,
      })
      .where(eq(userProfiles.userId, userId));
  } else {
    // Create new profile
    await db.insert(userProfiles).values({
      id: nanoid(),
      userId,
      monthlySalaryCents: data.monthlySalaryCents,
      payFrequency: data.payFrequency,
      onboardingCompleted: false,
      onboardingStep: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { profileUpdated: true };
}

function detectPayFrequency(text: string): 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | null {
  const lower = text.toLowerCase();

  if (/semanal|cada semana|por semana|weekly/i.test(lower)) return 'weekly';
  if (/catorcenal|cada dos semanas|cada 2 semanas|biweekly/i.test(lower)) return 'biweekly';
  if (/quincenal|quincena|cada quincena/i.test(lower)) return 'semimonthly';
  if (/mensual|cada mes|al mes|por mes|monthly/i.test(lower)) return 'monthly';

  // Default guess based on keywords
  if (/quincena/i.test(lower)) return 'semimonthly';
  if (/salario|sueldo/i.test(lower)) return 'monthly';

  return null;
}

// Bill type detection
type BillType = 'mortgage' | 'rent' | 'auto_loan' | 'credit_card' | 'personal_loan' | 'student_loan' | 'utility' | 'insurance' | 'subscription' | 'other';

function detectBillType(text: string): BillType {
  const lower = text.toLowerCase();

  if (/hipoteca|mortgage/.test(lower)) return 'mortgage';
  if (/renta|rent|alquiler/.test(lower)) return 'rent';
  if (/auto|carro|coche|car loan/.test(lower)) return 'auto_loan';
  if (/tarjeta|credit card/.test(lower)) return 'credit_card';
  if (/préstamo personal|prestamo personal|personal loan/.test(lower)) return 'personal_loan';
  if (/estudiante|universidad|student/.test(lower)) return 'student_loan';
  if (/luz|agua|gas|electric|water/.test(lower)) return 'utility';
  if (/seguro|insurance/.test(lower)) return 'insurance';
  if (/netflix|spotify|disney|hbo|amazon prime|streaming|suscripción|suscripcion/.test(lower)) return 'subscription';
  if (/internet|celular|teléfono|telefono/.test(lower)) return 'utility';

  return 'other';
}

// Parse due day from text
function parseDueDay(text: string): number | null {
  const lower = text.toLowerCase();

  // Match patterns like "día 15", "el 15", "día quince"
  const dayMatch = lower.match(/(?:día|dia|el)\s*(\d{1,2})/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1]!);
    if (day >= 1 && day <= 31) return day;
  }

  // Match patterns like "los 15" for bills
  const losMatch = lower.match(/los\s*(\d{1,2})/);
  if (losMatch) {
    const day = parseInt(losMatch[1]!);
    if (day >= 1 && day <= 31) return day;
  }

  // Match word days
  const wordDays: Record<string, number> = {
    'primero': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
    'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
    'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
    'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19, 'veinte': 20,
    'veintiuno': 21, 'veintidós': 22, 'veintidos': 22, 'veintitrés': 23, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25,
    'veintiséis': 26, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29, 'treinta': 30, 'treinta y uno': 31
  };

  for (const [word, day] of Object.entries(wordDays)) {
    if (lower.includes(word)) return day;
  }

  return null;
}

async function executeCreateScheduledBill(
  userId: string,
  data: {
    name: string;
    type: BillType;
    amountCents: number;
    dueDay: number;
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  }
): Promise<{ billId: string }> {
  const db = getDb();

  const id = nanoid();
  const now = Date.now();

  // Calculate next due date
  const today = new Date();
  let nextDueDate = new Date(today.getFullYear(), today.getMonth(), data.dueDay);
  if (nextDueDate <= today) {
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }

  await db.insert(scheduledBills).values({
    id,
    userId,
    name: data.name,
    type: data.type,
    amountCents: data.amountCents,
    dueDay: data.dueDay,
    frequency: data.frequency || 'monthly',
    status: 'active',
    nextDueDate: nextDueDate.toISOString().split('T')[0],
    createdAt: now,
    updatedAt: now,
  });

  return { billId: id };
}

async function executeCreateScheduledIncome(
  userId: string,
  data: {
    name: string;
    source: 'salary' | 'freelance' | 'business' | 'investment' | 'rental' | 'side_hustle' | 'bonus' | 'other';
    amountCents: number;
    payDay: number;
    frequency?: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  }
): Promise<{ incomeId: string }> {
  const db = getDb();

  const id = nanoid();
  const now = Date.now();

  // Calculate next pay date
  const today = new Date();
  let nextPayDate = new Date(today.getFullYear(), today.getMonth(), data.payDay);
  if (nextPayDate <= today) {
    nextPayDate.setMonth(nextPayDate.getMonth() + 1);
  }

  await db.insert(scheduledIncome).values({
    id,
    userId,
    name: data.name,
    source: data.source,
    amountCents: data.amountCents,
    payDay: data.payDay,
    frequency: data.frequency || 'monthly',
    status: 'active',
    nextPayDate: nextPayDate.toISOString().split('T')[0],
    createdAt: now,
    updatedAt: now,
  });

  return { incomeId: id };
}

async function getUserScheduledBills(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(scheduledBills)
    .where(and(eq(scheduledBills.userId, userId), eq(scheduledBills.status, 'active')));
}

async function getUserScheduledIncome(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(scheduledIncome)
    .where(and(eq(scheduledIncome.userId, userId), eq(scheduledIncome.status, 'active')));
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export async function processMessage(
  userId: string,
  userMessage: string
): Promise<CopilotResponse> {
  try {
    // Build financial context
    const context = await buildFinancialContext(userId);

    // Detect intent
    const intent = detectIntent(userMessage);

    // Handle based on intent
    switch (intent) {
      case 'greeting': {
        return {
          message: randomChoice(GREETING_RESPONSES),
          intent: 'greeting',
          followUpActions: [
            { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
            { label: 'Ver resumen', type: 'quick_reply', value: '¿Cuánto he gastado?' },
          ],
        };
      }

      case 'help': {
        return {
          message: HELP_RESPONSE,
          intent: 'help',
          followUpActions: [
            { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $50 en' },
            { label: 'Registrar ingreso', type: 'quick_reply', value: 'Me pagaron $' },
            { label: 'Ver gastos', type: 'quick_reply', value: '¿Cuánto llevo gastado?' },
          ],
        };
      }

      case 'spending_summary': {
        const { totalIncome, totalExpenses, balance, transactionCount } = context.monthlyStats;
        const incomeStr = (totalIncome / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        const expenseStr = (totalExpenses / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        const balanceStr = (balance / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });

        let message = `📊 **Este mes llevas:**\n`;
        message += `💰 Ingresos: $${incomeStr}\n`;
        message += `💸 Gastos: $${expenseStr}\n`;
        message += `📈 Balance: $${balanceStr}\n`;
        message += `📝 Transacciones: ${transactionCount}`;

        if (balance < 0) {
          message += `\n\n⚠️ Ojo, vas en números rojos. Cuidado con el gasto.`;
        } else if (balance > 0 && totalExpenses > 0) {
          const savingsRate = Math.round((balance / totalIncome) * 100);
          if (savingsRate >= 20) {
            message += `\n\n🎉 ¡Vas muy bien! Estás ahorrando el ${savingsRate}%.`;
          } else if (savingsRate >= 10) {
            message += `\n\n👍 Bien, estás ahorrando el ${savingsRate}%. ¡Sigue así!`;
          }
        }

        return {
          message,
          intent: 'spending_summary',
          followUpActions: [
            { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
            { label: 'Ver deudas', type: 'quick_reply', value: '¿Cuánto debo?' },
          ],
        };
      }

      case 'debt_inquiry': {
        if (context.debts.length === 0) {
          return {
            message: '¡No tienes deudas registradas! 🎉 Eso está muy bien. Si tienes alguna, cuéntamela.',
            intent: 'debt_inquiry',
            followUpActions: [
              { label: 'Registrar deuda', type: 'quick_reply', value: 'Tengo una tarjeta con $' },
            ],
          };
        }

        const totalDebt = context.debts.reduce((sum, d) => sum + d.currentBalanceCents, 0);
        const debtStr = (totalDebt / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });

        let message = `💳 **Tus deudas:**\n\n`;
        for (const debt of context.debts) {
          const balanceStr = (debt.currentBalanceCents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
          message += `• ${debt.name}: $${balanceStr} (${debt.aprPercent}% APR)\n`;
        }
        message += `\n**Total:** $${debtStr}`;

        if (context.debts.some((d) => d.aprPercent >= 30)) {
          message += `\n\n⚠️ Tienes deudas con interés alto. Prioriza pagarlas.`;
        }

        return {
          message,
          intent: 'debt_inquiry',
          followUpActions: [
            { label: 'Ver resumen', type: 'quick_reply', value: '¿Cuánto he gastado?' },
          ],
        };
      }

      case 'profile_setup': {
        // Parse salary amount
        const salaryAmount = parseAmount(userMessage);
        if (!salaryAmount) {
          return {
            message: 'No entendí el monto. 🤔 ¿Cuánto ganas? Dime algo como "Gano $15,000 al mes".',
            intent: 'profile_setup',
            needsMoreInfo: true,
            missingFields: ['amount'],
          };
        }

        // Detect pay frequency
        const payFrequency = detectPayFrequency(userMessage);

        // Calculate monthly salary if it's a quincena
        let monthlySalary = salaryAmount;
        if (payFrequency === 'semimonthly' || /quincena/i.test(userMessage)) {
          // If they said quincena, double it for monthly
          monthlySalary = salaryAmount * 2;
        } else if (payFrequency === 'weekly') {
          monthlySalary = salaryAmount * 4;
        } else if (payFrequency === 'biweekly') {
          monthlySalary = salaryAmount * 2;
        }

        // Save to profile
        try {
          await executeUpdateProfile(userId, {
            monthlySalaryCents: monthlySalary,
            payFrequency: payFrequency || 'monthly',
          });
        } catch (error) {
          console.error('Error saving profile:', error);
        }

        const salaryStr = (salaryAmount / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        const monthlyStr = (monthlySalary / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });

        let message = `¡Anotado! 💰 `;
        if (payFrequency === 'semimonthly' || /quincena/i.test(userMessage)) {
          message += `Tu quincena es de $${salaryStr} (mensual: $${monthlyStr}).`;
        } else if (payFrequency === 'weekly') {
          message += `Tu salario semanal es de $${salaryStr} (mensual: $${monthlyStr}).`;
        } else {
          message += `Tu salario mensual es de $${salaryStr}.`;
        }

        // Calculate recommended savings
        const savingsGoal = Math.round(monthlySalary * 0.2 / 100);
        message += `\n\n💡 Te recomiendo ahorrar al menos $${savingsGoal.toLocaleString('es-MX')} al mes (20% de tu ingreso).`;

        return {
          message,
          intent: 'profile_setup',
          followUpActions: [
            { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
            { label: 'Ver resumen', type: 'quick_reply', value: '¿Cuánto he gastado?' },
          ],
        };
      }

      case 'transaction': {
        // Parse the transaction
        const amount = parseAmount(userMessage);
        if (!amount) {
          return {
            message: 'No entendí el monto. 🤔 ¿Cuánto fue? Dime algo como "$50" o "50 pesos".',
            intent: 'transaction',
            needsMoreInfo: true,
            missingFields: ['amount'],
          };
        }

        const type = detectTransactionType(userMessage);
        const category = detectCategory(userMessage, context.categories);
        const date = parseDate(userMessage);
        const description = extractDescription(userMessage, category?.name || null);

        // Create the transaction
        const result = await executeCreateTransaction(userId, {
          amountCents: amount,
          description,
          type,
          categoryName: category?.name,
          categoryEmoji: category?.emoji,
          date,
        });

        const amountStr = (amount / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        const catDisplay = category ? `${category.emoji} ${category.name}` : '📦 Sin categoría';

        let message: string;
        if (type === 'income') {
          message = randomChoice(INCOME_CONFIRMATIONS)(amountStr, description, catDisplay);
        } else {
          message = randomChoice(EXPENSE_CONFIRMATIONS)(amountStr, description, catDisplay);
        }

        // Add a financial tip occasionally
        if (Math.random() < 0.3) {
          const tips = [
            '\n\n💡 Tip: Revisa tus gastos al final de cada semana.',
            '\n\n💡 Tip: Intenta guardar al menos el 20% de tus ingresos.',
            '\n\n💡 Tip: Los gastos pequeños suman mucho al mes.',
          ];
          message += randomChoice(tips);
        }

        // Get suggested categories for quick recategorization
        const userCategories = await getDb()
          .select()
          .from(categories)
          .where(eq(categories.userId, userId));

        return {
          message,
          intent: 'transaction',
          transaction: result.transaction,
          transactionCreated: true,
          transactionId: result.transactionId,
          suggestedCategories: userCategories
            .filter((c) => c.id !== result.categoryId)
            .slice(0, 5)
            .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
          followUpActions: [
            { label: 'Otro gasto', type: 'quick_reply', value: 'Gasté $' },
            { label: 'Ver resumen', type: 'quick_reply', value: '¿Cuánto llevo gastado?' },
          ],
        };
      }

      case 'debt_register': {
        const amount = parseAmount(userMessage);
        if (!amount) {
          return {
            message: 'No entendí el monto de la deuda. ¿Cuánto debes?',
            intent: 'debt_register',
            needsMoreInfo: true,
            missingFields: ['amount'],
          };
        }

        // Try to detect APR
        const aprMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*%/);
        const apr = aprMatch ? parseFloat(aprMatch[1]!) : undefined;

        // Detect debt type
        let debtType = 'other';
        const lower = userMessage.toLowerCase();
        if (/tarjeta|crédito|credito/.test(lower)) debtType = 'credit_card';
        else if (/préstamo personal|prestamo personal/.test(lower)) debtType = 'personal_loan';
        else if (/auto|carro|coche/.test(lower)) debtType = 'auto_loan';
        else if (/hipoteca|casa/.test(lower)) debtType = 'mortgage';
        else if (/estudiante|universidad|escuela/.test(lower)) debtType = 'student_loan';
        else if (/médico|medico|hospital/.test(lower)) debtType = 'medical';

        // Extract name
        let debtName = 'Deuda';
        if (/tarjeta/.test(lower)) {
          const bankMatch = lower.match(/tarjeta\s+(?:de\s+)?([\wá-ú]+)/i);
          debtName = bankMatch ? `Tarjeta ${bankMatch[1]!.charAt(0).toUpperCase()}${bankMatch[1]!.slice(1)}` : 'Tarjeta de crédito';
        } else if (/préstamo|prestamo/.test(lower)) {
          debtName = 'Préstamo personal';
        }

        const result = await executeCreateDebt(userId, {
          amountCents: amount,
          debtName,
          debtType,
          aprPercent: apr,
        });

        const amountStr = (amount / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        let message = `Registré tu deuda: ${debtName} por $${amountStr}`;
        if (apr) {
          message += ` al ${apr}% de interés`;
          if (apr >= 30) {
            message += `. ⚠️ ¡Ese interés está muy alto! Prioriza pagarla.`;
          }
        }
        message += '. 📝';

        return {
          message,
          intent: 'debt_register',
          debtCreated: true,
          debtId: result.debtId,
          followUpActions: [
            { label: 'Ver deudas', type: 'quick_reply', value: '¿Cuánto debo?' },
            { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
          ],
        };
      }

      case 'debt_plan': {
        // Debt payment strategies (Avalanche vs Snowball)
        if (context.debts.length === 0) {
          return {
            message: '¡No tienes deudas registradas! 🎉 Eso es genial. Si tienes alguna, cuéntamela y te ayudo con un plan.',
            intent: 'debt_plan',
            followUpActions: [
              { label: 'Registrar deuda', type: 'quick_reply', value: 'Tengo una tarjeta con $' },
            ],
          };
        }

        // Sort debts by APR (highest first) for Avalanche method
        const avalancheOrder = [...context.debts].sort((a, b) => b.aprPercent - a.aprPercent);
        // Sort debts by balance (lowest first) for Snowball method
        const snowballOrder = [...context.debts].sort((a, b) => a.currentBalanceCents - b.currentBalanceCents);

        const totalDebt = context.debts.reduce((sum, d) => sum + d.currentBalanceCents, 0);
        const totalDebtStr = (totalDebt / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });

        let message = `💡 **Estrategias para pagar tus deudas ($${totalDebtStr} total):**\n\n`;

        message += `**🔥 Método Avalancha** (ahorra más en intereses):\n`;
        message += `Paga primero la de mayor interés:\n`;
        avalancheOrder.slice(0, 3).forEach((d, i) => {
          const bal = (d.currentBalanceCents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
          message += `${i + 1}. ${d.name}: $${bal} (${d.aprPercent}% APR)\n`;
        });

        message += `\n**⚡ Método Bola de Nieve** (victorias rápidas):\n`;
        message += `Paga primero la más pequeña:\n`;
        snowballOrder.slice(0, 3).forEach((d, i) => {
          const bal = (d.currentBalanceCents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
          message += `${i + 1}. ${d.name}: $${bal}\n`;
        });

        // Recommendation based on their situation
        const highInterestDebt = context.debts.some(d => d.aprPercent >= 25);
        if (highInterestDebt) {
          message += `\n💪 **Mi recomendación:** Usa el método Avalancha. Tienes deudas con interés alto que te están comiendo vivo.`;
        } else {
          message += `\n💪 **Mi recomendación:** Si te motivan las victorias rápidas, usa Bola de Nieve. Si quieres ahorrar más, usa Avalancha.`;
        }

        return {
          message,
          intent: 'debt_plan',
          followUpActions: [
            { label: 'Ver mis deudas', type: 'quick_reply', value: '¿Cuánto debo?' },
            { label: 'Tips de ahorro', type: 'quick_reply', value: 'Dame tips para ahorrar' },
          ],
        };
      }

      case 'bill_schedule': {
        // Try to parse bill details from message
        const amount = parseAmount(userMessage);
        const dueDay = parseDueDay(userMessage);

        // If we have enough info, create the bill
        if (amount && dueDay) {
          const billType = detectBillType(userMessage);

          // Extract name from type
          const typeNames: Record<BillType, string> = {
            mortgage: 'Hipoteca',
            rent: 'Renta',
            auto_loan: 'Crédito Auto',
            credit_card: 'Tarjeta de Crédito',
            personal_loan: 'Préstamo Personal',
            student_loan: 'Préstamo Estudiantil',
            utility: 'Servicio',
            insurance: 'Seguro',
            subscription: 'Suscripción',
            other: 'Gasto Fijo',
          };

          // Detect specific utility type for name
          let billName = typeNames[billType];
          const lower = userMessage.toLowerCase();
          if (/luz/.test(lower)) billName = 'Luz';
          else if (/agua/.test(lower)) billName = 'Agua';
          else if (/gas/.test(lower)) billName = 'Gas';
          else if (/internet/.test(lower)) billName = 'Internet';
          else if (/celular|teléfono|telefono/.test(lower)) billName = 'Celular';
          else if (/netflix/.test(lower)) billName = 'Netflix';
          else if (/spotify/.test(lower)) billName = 'Spotify';
          else if (/disney/.test(lower)) billName = 'Disney+';

          try {
            await executeCreateScheduledBill(userId, {
              name: billName,
              type: billType,
              amountCents: amount,
              dueDay,
            });

            const amountStr = (amount / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
            const message = `✅ ¡Registrado! Tu ${billName} de $${amountStr} vence el día ${dueDay} de cada mes.\n\n💡 Te recordaré unos días antes para que no se te pase.`;

            return {
              message,
              intent: 'bill_schedule',
              followUpActions: [
                { label: 'Agregar otro', type: 'quick_reply', value: 'Mi internet es de $' },
                { label: 'Ver gastos fijos', type: 'quick_reply', value: '¿Cuáles son mis gastos fijos?' },
              ],
            };
          } catch (error) {
            console.error('Error creating scheduled bill:', error);
          }
        }

        // Show existing bills or help message
        const existingBills = await getUserScheduledBills(userId);

        let message = '';
        if (existingBills.length > 0) {
          message = `📅 **Tus Gastos Fijos:**\n\n`;
          let totalMonthly = 0;
          for (const bill of existingBills) {
            const amountStr = (bill.amountCents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
            message += `• ${bill.name}: $${amountStr} (día ${bill.dueDay})\n`;
            totalMonthly += bill.amountCents;
          }
          const totalStr = (totalMonthly / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
          message += `\n**Total mensual:** $${totalStr}`;
          message += `\n\n💡 Para agregar más, dime: "Mi luz es de $500 el día 15"`;
        } else {
          message = `📅 **Gastos Fijos/Recurrentes**\n\n`;
          message += `No tienes gastos fijos registrados aún.\n\n`;
          message += `Puedo ayudarte a recordar:\n`;
          message += `• 🏠 Renta/Hipoteca\n`;
          message += `• 💡 Luz\n`;
          message += `• 💧 Agua\n`;
          message += `• 🔥 Gas\n`;
          message += `• 🌐 Internet\n`;
          message += `• 📱 Celular\n`;
          message += `• 📺 Streaming\n\n`;
          message += `Dime: "Mi luz es de $500 el día 15" para registrarlo.`;
        }

        return {
          message,
          intent: 'bill_schedule',
          followUpActions: [
            { label: 'Agregar luz', type: 'quick_reply', value: 'Mi luz es de $500 el día 15' },
            { label: 'Agregar renta', type: 'quick_reply', value: 'Mi renta es de $8000 el día 1' },
          ],
        };
      }

      case 'income_schedule': {
        // Try to parse income details from message
        const amount = parseAmount(userMessage);
        const payDay = parseDueDay(userMessage);

        // If we have enough info, create the scheduled income
        if (amount && payDay) {
          const lower = userMessage.toLowerCase();
          let source: 'salary' | 'freelance' | 'business' | 'investment' | 'rental' | 'side_hustle' | 'bonus' | 'other' = 'salary';
          let incomeName = 'Salario';

          if (/freelance|proyecto|cliente/.test(lower)) {
            source = 'freelance';
            incomeName = 'Freelance';
          } else if (/renta|alquiler|inquilino/.test(lower)) {
            source = 'rental';
            incomeName = 'Renta';
          } else if (/inversión|inversion|dividendo/.test(lower)) {
            source = 'investment';
            incomeName = 'Inversiones';
          } else if (/negocio|empresa/.test(lower)) {
            source = 'business';
            incomeName = 'Negocio';
          } else if (/bono|aguinaldo/.test(lower)) {
            source = 'bonus';
            incomeName = 'Bono';
          } else if (/extra|chambita|jale/.test(lower)) {
            source = 'side_hustle';
            incomeName = 'Ingreso Extra';
          }

          // Detect frequency
          let frequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' = 'monthly';
          if (/quincenal|quincena|15 y 30|cada quincena/.test(lower)) {
            frequency = 'semimonthly';
          } else if (/semanal|cada semana/.test(lower)) {
            frequency = 'weekly';
          }

          try {
            await executeCreateScheduledIncome(userId, {
              name: incomeName,
              source,
              amountCents: amount,
              payDay,
              frequency,
            });

            const amountStr = (amount / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
            const freqText = frequency === 'semimonthly' ? 'quincenal' : frequency === 'weekly' ? 'semanal' : 'mensual';
            const message = `✅ ¡Registrado! Tu ${incomeName.toLowerCase()} de $${amountStr} (${freqText}) cae el día ${payDay}.\n\n💡 Esto me ayuda a darte mejores recomendaciones de presupuesto.`;

            return {
              message,
              intent: 'income_schedule',
              followUpActions: [
                { label: 'Ver gastos fijos', type: 'quick_reply', value: '¿Cuáles son mis gastos fijos?' },
                { label: 'Ver resumen', type: 'quick_reply', value: '¿Cuánto he gastado?' },
              ],
            };
          } catch (error) {
            console.error('Error creating scheduled income:', error);
          }
        }

        // Show existing scheduled income or help
        const existingIncome = await getUserScheduledIncome(userId);

        let message = '';
        if (existingIncome.length > 0) {
          message = `💰 **Tus Ingresos Programados:**\n\n`;
          let totalMonthly = 0;
          for (const income of existingIncome) {
            const amountStr = (income.amountCents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
            const freqMult = income.frequency === 'semimonthly' ? 2 : income.frequency === 'weekly' ? 4 : 1;
            message += `• ${income.name}: $${amountStr} (día ${income.payDay})\n`;
            totalMonthly += income.amountCents * freqMult;
          }
          const totalStr = (totalMonthly / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
          message += `\n**Ingreso mensual estimado:** $${totalStr}`;
          message += `\n\n💡 Para agregar más, dime: "Me pagan $15,000 el día 15"`;
        } else {
          message = `💰 **Ingresos Programados**\n\n`;
          message += `No tienes ingresos programados aún.\n\n`;
          message += `Puedo registrar:\n`;
          message += `• 💵 Salario/Quincena\n`;
          message += `• 💻 Freelance\n`;
          message += `• 🏢 Rentas\n`;
          message += `• 📈 Inversiones\n\n`;
          message += `Dime: "Me pagan $15,000 el día 15" para configurarlo.`;
        }

        return {
          message,
          intent: 'income_schedule',
          followUpActions: [
            { label: 'Agregar salario', type: 'quick_reply', value: 'Me pagan $15000 el día 15' },
            { label: 'Configurar quincena', type: 'quick_reply', value: 'Mi quincena es de $7500' },
          ],
        };
      }

      case 'budget_tips': {
        // Budget tips and rules
        const lower = userMessage.toLowerCase();

        let message = '';

        if (/50.?30.?20/.test(lower)) {
          message = BUDGET_TIPS['50_30_20'];
        } else if (/70.?20.?10/.test(lower)) {
          message = BUDGET_TIPS['70_20_10'];
        } else if (/págate|pagate|pay yourself/.test(lower)) {
          message = BUDGET_TIPS['pay_yourself_first'];
        } else {
          // Show all tips
          message = `📚 **Reglas de Presupuesto Populares:**\n\n`;
          message += BUDGET_TIPS['50_30_20'];
          message += `\n\n---\n\n`;
          message += BUDGET_TIPS['70_20_10'];
          message += `\n\n---\n\n`;
          message += BUDGET_TIPS['pay_yourself_first'];
        }

        // Add encouragement
        message += `\n\n${randomChoice(ENCOURAGEMENT_MESSAGES)}`;

        return {
          message,
          intent: 'budget_tips',
          followUpActions: [
            { label: 'Ver mi situación', type: 'quick_reply', value: '¿Cuánto he gastado?' },
            { label: 'Libros recomendados', type: 'quick_reply', value: 'Recomiéndame un libro' },
          ],
        };
      }

      case 'book_recommendation': {
        // Educational book recommendations
        let message = `📚 **Libros que te van a cambiar la vida financiera:**\n\n`;

        BOOK_RECOMMENDATIONS.forEach((book, i) => {
          message += `${book.emoji} **${i + 1}. ${book.title}**\n`;
          message += `   _por ${book.author}_\n\n`;
        });

        message += `💡 **Mi favorito:** "The Psychology of Money" - te ayuda a entender por qué tomamos decisiones financieras a veces irracionales.\n\n`;
        message += `¿Ya leíste alguno? ¡Cuéntame qué te pareció!`;

        return {
          message,
          intent: 'book_recommendation',
          followUpActions: [
            { label: 'Tips de presupuesto', type: 'quick_reply', value: '¿Qué es la regla 50/30/20?' },
            { label: 'Ver mis finanzas', type: 'quick_reply', value: '¿Cuánto he gastado?' },
          ],
        };
      }

      case 'conversation': {
        // Generic financial conversation
        return {
          message: '¡Buena pregunta! 🤔 Por ahora solo puedo ayudarte a registrar gastos e ingresos. Dime algo como "Gasté $100 en super".',
          intent: 'conversation',
          followUpActions: [
            { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
            { label: 'Ver ayuda', type: 'quick_reply', value: '¿Qué puedes hacer?' },
          ],
        };
      }

      default: {
        return {
          message: randomChoice(UNKNOWN_RESPONSES),
          intent: 'unknown',
          followUpActions: [
            { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $50 en' },
            { label: 'Ver ayuda', type: 'quick_reply', value: '¿Qué puedes hacer?' },
          ],
        };
      }
    }
  } catch (error) {
    console.error('Copilot error:', error);

    return {
      message: `¡Ups! Algo salió mal. 😅 Intenta de nuevo.`,
      intent: 'unknown',
      followUpActions: [
        { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
        { label: 'Ver ayuda', type: 'quick_reply', value: '¿Qué puedes hacer?' },
      ],
    };
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();

  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    );

  if (!tx) {
    return false;
  }

  await db
    .update(transactions)
    .set({ categoryId, updatedAt: Date.now() })
    .where(eq(transactions.id, transactionId));

  return true;
}

export function getQuickActions(): Array<{ text: string; example: string }> {
  return [
    { text: 'Registrar gasto', example: 'Gasté $30 en almuerzo' },
    { text: 'Compras', example: 'Compré ropa por $150 en Zara' },
    { text: 'Transporte', example: '$15 de Uber' },
    { text: 'Supermercado', example: 'Super $80' },
    { text: 'Ingreso', example: 'Me pagaron mi quincena de $2400' },
    { text: 'Configurar salario', example: 'Gano $15,000 al mes' },
    { text: 'Registrar deuda', example: 'Tengo una tarjeta con $5000 al 45%' },
    { text: 'Plan de pago', example: '¿Cómo pago mis deudas?' },
    { text: 'Ver resumen', example: '¿Cuánto he gastado este mes?' },
    { text: 'Ver deudas', example: '¿Cuánto debo en total?' },
    { text: 'Tips de ahorro', example: '¿Qué es la regla 50/30/20?' },
    { text: 'Libros', example: 'Recomiéndame un libro de finanzas' },
  ];
}

// Clear conversation history for a user (no-op now, but kept for API compatibility)
export function clearConversationHistory(_userId: string): void {
  // No conversation history in rule-based system
}
