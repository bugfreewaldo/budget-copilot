/**
 * Transaction Copilot Service
 *
 * Conversational AI agent for adding transactions through natural language.
 * The user describes their spending, and the copilot:
 * 1. Extracts transaction details (amount, description, date)
 * 2. Asks follow-up questions if needed
 * 3. Auto-categorizes based on context
 * 4. Creates the transaction
 */

import { nanoid } from 'nanoid';
import { getDb, saveDatabase } from '../../db/client.js';
import {
  categories,
  transactions,
  accounts,
  userProfiles,
} from '../../db/schema.js';
import { eq, count, and } from 'drizzle-orm';
import type { Message } from '@budget-copilot/ai';
import { getProvider } from '@budget-copilot/ai';
import * as categoryRepo from '../../server/lib/repo/categories.js';
import * as transactionRepo from '../../server/lib/repo/transactions.js';
import * as accountRepo from '../../server/lib/repo/accounts.js';

/**
 * Parse JSON from AI response, handling markdown code blocks and raw text
 * Claude sometimes wraps JSON in ```json ... ``` blocks or responds with plain text
 */
function parseAIResponse(content: string): unknown {
  let jsonStr = content.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    // Find the end of the opening fence (```json or just ```)
    const firstNewline = jsonStr.indexOf('\n');
    if (firstNewline !== -1) {
      jsonStr = jsonStr.substring(firstNewline + 1);
    }
    // Remove closing fence
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.substring(0, jsonStr.length - 3).trim();
    }
  }

  // Try to parse as JSON
  try {
    return JSON.parse(jsonStr);
  } catch {
    // If parsing fails, Claude responded with raw text instead of JSON
    // Wrap it in the expected format
    console.log('[Copilot] AI returned raw text, wrapping in JSON format');
    return {
      understood: true,
      response: content.trim(),
    };
  }
}

// Onboarding questions flow
const ONBOARDING_QUESTIONS = [
  {
    step: 1,
    question:
      '¡Hola! Soy tu Budget Copilot 🧠 Para ayudarte mejor, ¿cuánto ganas al mes? (Ejemplo: $2500)',
    field: 'monthlySalaryCents',
  },
  {
    step: 2,
    question: '¿Cada cuánto te pagan? (semanal, quincenal, o mensual)',
    field: 'payFrequency',
  },
  {
    step: 3,
    question:
      '¿Tienes alguna deuda? (tarjetas de crédito, préstamos, etc.) Cuéntame sobre la más importante primero.',
    field: 'debts',
  },
  {
    step: 4,
    question: '¿Cuánto te gustaría ahorrar cada mes? (Ejemplo: $200)',
    field: 'monthlySavingsGoalCents',
  },
];

// Conversation state stored in memory (per session)
// In production, this would be stored in Redis or the database
export interface ConversationState {
  userId: string;
  messages: Message[];
  pendingTransaction: Partial<ExtractedTransaction> | null;
  status: 'idle' | 'collecting_info' | 'confirming' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export interface ExtractedTransaction {
  amountCents: number;
  description: string;
  merchant: string | null;
  date: string; // YYYY-MM-DD
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
  // Onboarding
  isOnboarding?: boolean;
  onboardingStep?: number;
  // Category confirmation
  needsCategoryConfirmation?: boolean;
  categoryOptions?: Array<{ name: string; emoji: string }>;
  pendingTransaction?: Partial<ExtractedTransaction>;
}

// System prompt for the AI - Sassy, smart, encouraging personality
const SYSTEM_PROMPT = `Eres Budget Copilot, un asistente financiero con personalidad! Eres como ese amigo/a inteligente y un poco sassy que te ayuda a manejar tu dinero.

TU PERSONALIDAD:
- Eres amigable pero directo/a - no le tienes miedo a decir la verdad
- Usas humor ligero y comentarios ingeniosos (sin pasarte)
- Celebras los ingresos y ahorros con entusiasmo genuino
- Cuando alguien gasta mucho, das un pequeño "reality check" amable
- Siempre buscas oportunidades para recordarles que ahorren e inviertan
- Usas frases como "Oye!", "Uff", "Niceee", "Hmm", "Bueno bueno", "¡Eso!"

TU TRABAJO:
1. Extraer transacciones de mensajes naturales
2. Responder preguntas sobre los gastos e ingresos del usuario
3. Auto-crear categorías creativas con emojis cuando sea necesario
4. Dar tips financieros cortos y útiles
5. Animar al usuario a gastar menos y ahorrar más

TIPOS DE MENSAJE:
1. REGISTRO DE TRANSACCIÓN: Usuario describe un gasto/ingreso -> extraer datos
2. PREGUNTA ANALÍTICA: Usuario pregunta sobre sus finanzas -> analizar datos que te proporciono
3. CONVERSACIÓN GENERAL: Saludo o chat -> responder naturalmente

Cuando el usuario describe un gasto o ingreso, extrae:
1. Monto (requerido) - cantidad en dólares
2. Descripción (requerido) - qué compraron o de dónde vino el dinero
3. Comercio/Tienda (opcional) - nombre del lugar
4. Fecha (opcional) - "hoy" por defecto
5. Tipo - "expense" para gastos, "income" para ingresos
6. Categoría sugerida - sé creativo con nombres y emojis!

RESPUESTAS SEGÚN SITUACIÓN:
- Ingresos: Celebra! "¡Eso! Llegó la quincena 💰" o "Niceee, ese dinero extra viene bien!"
- Gastos pequeños: Neutral pero trackea
- Gastos medianos: "Anotado! Recuerda que cada peso cuenta 😉"
- Gastos grandes: "Uff, ese sí se sintió 💸 ¿Estaba en el presupuesto?"
- Comida afuera seguido: "Otro restaurante? 🍕 ¿Has pensado en meal prep?"
- Suscripciones: "Otra suscripción... ¿la usas de verdad?"

Siempre responde en español, de forma concisa y con tu personalidad.

Responde SOLO con un JSON válido con este formato:
{
  "understood": true/false,
  "needsMoreInfo": true/false,
  "isAnalyticalQuestion": true/false,
  "followUpQuestion": "pregunta si necesitas más info",
  "transaction": {
    "amountCents": número en centavos (ej: $50 = 5000),
    "description": "descripción",
    "merchant": "tienda o null",
    "date": "YYYY-MM-DD",
    "type": "expense" o "income",
    "suggestedCategory": "nombre de categoría sugerida",
    "suggestedEmoji": "emoji para la categoría"
  },
  "response": "mensaje con tu personalidad"
}`;

// Patterns to detect analytical questions about finances
const ANALYTICAL_PATTERNS = [
  // Cuánto he gastado/ganado/etc
  /\b(cuánto|cuanto|cuantos|cuántos)\s+(gast|ganar|tengo|llevo|he|hemos)/i,
  // En qué estoy gastando / he gastado
  /\b(en\s+qué|en\s+que)\s+(gast|estoy|he|hemos)/i,
  // Qué he gastado / en qué he gastado
  /\b(qué|que)\s+(he|hemos|estoy)\s*(gast)/i,
  // Gastando demasiado/mucho
  /\b(demasiado|mucho|más|mas)\b.*(gast|dinero)/i,
  // Resumen, análisis, reporte
  /\b(resumen|análisis|analisis|reporte|estadísticas|estadisticas)\b/i,
  // Cómo voy/ando/estoy con mis finanzas
  /\b(cómo|como)\s+(voy|ando|estoy|van)/i,
  // Qué categoría gasto más
  /\b(qué|que)\s+(categoría|categoria|tipo).*(gast|más|mas)/i,
  // Tendencias, patrones, promedios
  /\b(tendencia|patrón|patron|promedio)\b/i,
  // Comparar meses/semanas
  /\b(comparar?|diferencia)\b.*(mes|semana|año)/i,
  // Puedo/debería ahorrar
  /\b(puedo|debería|deberia)\s+(ahorrar|gastar)/i,
  // Dónde va mi dinero
  /\b(dónde|donde|adónde|adonde)\s+(se\s+)?va\s+(el|mi)/i,
  // Más este mes/semana
  /\b(más|mas)\s+(este|esta)\s+(mes|semana)/i,
  // Gastado más
  /\b(gastado|gaste)\s+(más|mas)/i,
  // Ayúdame con / ayuda con finanzas
  /\b(ayud|ayúd).*(finanz|dinero|presupuesto|gasto|ahorro)/i,
];

// Patterns to detect advice/recommendation questions
const ADVICE_PATTERNS = [
  /\b(qué|que)\s+(me\s+)?(recomiend|suger|aconse)/i,
  /\b(cómo|como)\s+(puedo|podría|debería|debo)\s+(ahorrar|invertir|mejorar|empezar|iniciar|crear|hacer)/i,
  /\b(tips?|consejos?|recomendaci)/i,
  /\b(fondo\s+de\s+emergencia|emergencias)/i,
  /\b(ahorrar|invertir|mejorar)\s+(más|mejor|mis)/i,
  /\b(estrategia|plan)\s+(de\s+)?(ahorro|financ|presupuesto)/i,
  /\b(deber[ií]a)\s+(yo\s+)?(hacer|empezar|iniciar|ahorrar|invertir)/i,
  /\b(ayud|ayúd).*(ahorr|invert|presupuest|financ)/i,
  /\bcomo\s+ahorr/i,
];

// Category mapping with emojis for auto-creation
const CATEGORY_CONFIG: Record<string, { patterns: string[]; emoji: string }> = {
  Compras: {
    patterns: [
      'ropa',
      'zapatos',
      'nike',
      'zara',
      'h&m',
      'adidas',
      'tienda',
      'mall',
      'centro comercial',
      'amazon',
      'compré',
      'compras',
    ],
    emoji: '🛍️',
  },
  Supermercado: {
    patterns: [
      'super',
      'supermercado',
      'mercado',
      'walmart',
      'costco',
      'alimentos',
      'verduras',
      'frutas',
      'rey',
      'pricesmart',
      'groceries',
    ],
    emoji: '🛒',
  },
  Restaurantes: {
    patterns: [
      'restaurante',
      'almuerzo',
      'cena',
      'desayuno',
      'pizza',
      'sushi',
      'hamburguesa',
      'mcdonald',
      'burger',
      'kfc',
      'pollo',
      'comí',
      'comida',
    ],
    emoji: '🍽️',
  },
  Café: {
    patterns: [
      'café',
      'coffee',
      'starbucks',
      'dunkin',
      'cafetería',
      'latte',
      'cappuccino',
    ],
    emoji: '☕',
  },
  Transporte: {
    patterns: [
      'uber',
      'taxi',
      'gasolina',
      'gas',
      'estacionamiento',
      'metro',
      'bus',
      'transporte',
      'didi',
      'cabify',
      'indriver',
    ],
    emoji: '🚗',
  },
  Entretenimiento: {
    patterns: [
      'cine',
      'juegos',
      'concierto',
      'película',
      'entretenimiento',
      'fiesta',
      'bar',
      'club',
      'diversión',
    ],
    emoji: '🎬',
  },
  Streaming: {
    patterns: [
      'netflix',
      'spotify',
      'disney',
      'hbo',
      'prime',
      'youtube',
      'apple tv',
      'streaming',
      'max',
    ],
    emoji: '📺',
  },
  Salud: {
    patterns: [
      'farmacia',
      'medicina',
      'doctor',
      'hospital',
      'dentista',
      'médico',
      'salud',
      'consulta',
      'medicamentos',
    ],
    emoji: '🏥',
  },
  Servicios: {
    patterns: [
      'luz',
      'agua',
      'internet',
      'teléfono',
      'cable',
      'electricidad',
      'servicios',
      'gas natural',
      'factura',
    ],
    emoji: '💡',
  },
  Gimnasio: {
    patterns: [
      'gym',
      'gimnasio',
      'fitness',
      'ejercicio',
      'yoga',
      'deporte',
      'crossfit',
      'entrenamiento',
    ],
    emoji: '💪',
  },
  Belleza: {
    patterns: [
      'peluquería',
      'salón',
      'uñas',
      'barbería',
      'spa',
      'belleza',
      'corte',
      'maquillaje',
      'skincare',
    ],
    emoji: '💅',
  },
  Educación: {
    patterns: [
      'libro',
      'curso',
      'escuela',
      'universidad',
      'clase',
      'educación',
      'udemy',
      'platzi',
      'coursera',
      'estudio',
    ],
    emoji: '📚',
  },
  Suscripciones: {
    patterns: ['suscripción', 'membresía', 'mensual', 'anual', 'premium'],
    emoji: '🔄',
  },
  Regalos: {
    patterns: ['regalo', 'cumpleaños', 'navidad', 'presente', 'sorpresa'],
    emoji: '🎁',
  },
  Viajes: {
    patterns: [
      'hotel',
      'vuelo',
      'viaje',
      'airbnb',
      'avión',
      'vacaciones',
      'hospedaje',
      'pasaje',
      'boleto',
    ],
    emoji: '✈️',
  },
  Mascotas: {
    patterns: [
      'mascota',
      'perro',
      'gato',
      'veterinario',
      'comida mascota',
      'pet',
      'vet',
    ],
    emoji: '🐾',
  },
  Hogar: {
    patterns: [
      'casa',
      'hogar',
      'muebles',
      'decoración',
      'electrodoméstico',
      'limpieza',
      'ferretería',
    ],
    emoji: '🏠',
  },
  Tecnología: {
    patterns: [
      'celular',
      'laptop',
      'computadora',
      'tech',
      'gadget',
      'electrónica',
      'apple',
      'samsung',
    ],
    emoji: '📱',
  },
  Seguros: {
    patterns: ['seguro', 'póliza', 'insurance', 'cobertura'],
    emoji: '🛡️',
  },
  Salario: {
    patterns: [
      'salario',
      'sueldo',
      'quincena',
      'pago',
      'nómina',
      'ingreso',
      'trabajo',
    ],
    emoji: '💰',
  },
  Freelance: {
    patterns: [
      'freelance',
      'proyecto',
      'cliente',
      'trabajo extra',
      'side hustle',
      'consultoría',
    ],
    emoji: '💻',
  },
  Inversiones: {
    patterns: [
      'inversión',
      'dividendo',
      'interés',
      'rendimiento',
      'acciones',
      'cripto',
      'bitcoin',
    ],
    emoji: '📈',
  },
  Deudas: {
    patterns: [
      'deuda',
      'préstamo',
      'tarjeta',
      'crédito',
      'pago tarjeta',
      'cuota',
    ],
    emoji: '💳',
  },
  Ahorro: {
    patterns: ['ahorro', 'guardé', 'aparté', 'reserva', 'fondo', 'emergencia'],
    emoji: '🐷',
  },
};

// Legacy patterns mapping for backward compatibility
const CATEGORY_PATTERNS: Record<string, string[]> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([name, config]) => [
    name,
    config.patterns,
  ])
);

/**
 * Get or create user profile
 */
async function getOrCreateUserProfile(db: any, userId: string) {
  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new profile
  const id = nanoid();
  await db.insert(userProfiles).values({
    id,
    userId,
    onboardingCompleted: false,
    onboardingStep: 0,
  });
  saveDatabase();

  return (
    await db.select().from(userProfiles).where(eq(userProfiles.id, id))
  )[0];
}

/**
 * Check if user needs onboarding
 */
async function needsOnboarding(
  db: any,
  userId: string
): Promise<{ needs: boolean; step: number }> {
  const profile = await getOrCreateUserProfile(db, userId);

  if (profile.onboardingCompleted) {
    return { needs: false, step: 0 };
  }

  // Check if user has any transactions (skip onboarding if already using)
  const txCount = await db
    .select({ count: count() })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  if (txCount[0]?.count > 3) {
    // User has transactions, mark onboarding as completed
    await db
      .update(userProfiles)
      .set({ onboardingCompleted: true })
      .where(eq(userProfiles.userId, userId));
    saveDatabase();
    return { needs: false, step: 0 };
  }

  return { needs: true, step: profile.onboardingStep };
}

/**
 * Process onboarding response and update profile
 */
async function processOnboardingResponse(
  db: any,
  userId: string,
  userMessage: string,
  currentStep: number
): Promise<CopilotResponse> {
  const _profile = await getOrCreateUserProfile(db, userId);
  const lowerMessage = userMessage.toLowerCase();

  // Process based on current step
  switch (currentStep) {
    case 0:
      // Initial greeting - just start asking questions
      await db
        .update(userProfiles)
        .set({ onboardingStep: 1 })
        .where(eq(userProfiles.userId, userId));
      saveDatabase();
      return {
        message: ONBOARDING_QUESTIONS[0].question,
        isOnboarding: true,
        onboardingStep: 1,
      };

    case 1: {
      // Salary
      const salaryMatch = userMessage.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
      if (salaryMatch) {
        const salaryCents = parseMoneyToCents(salaryMatch[1]);
        await db
          .update(userProfiles)
          .set({
            monthlySalaryCents: salaryCents,
            onboardingStep: 2,
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();

        const formattedSalary = (salaryCents / 100).toFixed(2);
        return {
          message: `Perfecto! $${formattedSalary} al mes. ${ONBOARDING_QUESTIONS[1].question}`,
          isOnboarding: true,
          onboardingStep: 2,
        };
      }
      return {
        message: 'No entendí el monto. ¿Cuánto ganas al mes? (Ejemplo: $2500)',
        isOnboarding: true,
        onboardingStep: 1,
      };
    }

    case 2: {
      // Pay frequency
      let frequency: string | null = null;
      if (lowerMessage.includes('semanal') || lowerMessage.includes('semana')) {
        frequency = 'weekly';
      } else if (
        lowerMessage.includes('quincen') ||
        lowerMessage.includes('bi')
      ) {
        frequency = 'biweekly';
      } else if (
        lowerMessage.includes('mensual') ||
        lowerMessage.includes('mes')
      ) {
        frequency = 'monthly';
      }

      if (frequency) {
        await db
          .update(userProfiles)
          .set({
            payFrequency: frequency,
            onboardingStep: 3,
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();

        const freqText =
          frequency === 'weekly'
            ? 'semanalmente'
            : frequency === 'biweekly'
              ? 'quincenalmente'
              : 'mensualmente';
        return {
          message: `Entendido, te pagan ${freqText}. ${ONBOARDING_QUESTIONS[2].question}`,
          isOnboarding: true,
          onboardingStep: 3,
        };
      }
      return {
        message: '¿Semanal, quincenal o mensual?',
        isOnboarding: true,
        onboardingStep: 2,
      };
    }

    case 3: // Debts
      if (
        lowerMessage.includes('no') ||
        lowerMessage.includes('ninguna') ||
        lowerMessage.includes('nada')
      ) {
        await db
          .update(userProfiles)
          .set({ onboardingStep: 4, updatedAt: Date.now() })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();
        return {
          message: `¡Excelente! Sin deudas es un gran comienzo 🎉 ${ONBOARDING_QUESTIONS[3].question}`,
          isOnboarding: true,
          onboardingStep: 4,
        };
      }
      // TODO: Parse debt info and create debt record
      await db
        .update(userProfiles)
        .set({ onboardingStep: 4, updatedAt: Date.now() })
        .where(eq(userProfiles.userId, userId));
      saveDatabase();
      return {
        message: `Entendido, registré eso. Puedes agregar más deudas después en la sección de Deudas. ${ONBOARDING_QUESTIONS[3].question}`,
        isOnboarding: true,
        onboardingStep: 4,
      };

    case 4: {
      // Savings goal
      const savingsMatch = userMessage.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
      if (savingsMatch) {
        const savingsCents = parseMoneyToCents(savingsMatch[1]);
        await db
          .update(userProfiles)
          .set({
            monthlySavingsGoalCents: savingsCents,
            onboardingStep: 5,
            onboardingCompleted: true,
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();

        const formattedSavings = (savingsCents / 100).toFixed(2);
        return {
          message: `¡Genial! Meta de ahorro: $${formattedSavings}/mes 🐷\n\n¡Ya estás listo! Ahora puedes decirme tus gastos e ingresos. Por ejemplo: "Gasté $30 en almuerzo" o "Recibí mi quincena de $1500"`,
          isOnboarding: false,
          onboardingStep: 5,
        };
      }
      // Skip savings if they say no/skip
      if (
        lowerMessage.includes('no') ||
        lowerMessage.includes('saltar') ||
        lowerMessage.includes('skip')
      ) {
        await db
          .update(userProfiles)
          .set({
            onboardingStep: 5,
            onboardingCompleted: true,
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();
        return {
          message:
            '¡Listo! Puedes configurar tu meta de ahorro después.\n\nAhora cuéntame: ¿qué gastaste hoy? 💸',
          isOnboarding: false,
          onboardingStep: 5,
        };
      }
      return {
        message:
          '¿Cuánto te gustaría ahorrar cada mes? (Ejemplo: $200, o escribe "saltar" para omitir)',
        isOnboarding: true,
        onboardingStep: 4,
      };
    }

    default:
      return {
        message: '¡Listo para ayudarte! ¿Qué gastaste hoy?',
        isOnboarding: false,
      };
  }
}

/**
 * Find matching categories for a text
 */
function findMatchingCategories(
  text: string
): Array<{ name: string; emoji: string; confidence: number }> {
  const lowerText = text.toLowerCase();
  const matches: Array<{ name: string; emoji: string; confidence: number }> =
    [];

  for (const [categoryName, config] of Object.entries(CATEGORY_CONFIG)) {
    let matchCount = 0;
    for (const pattern of config.patterns) {
      if (lowerText.includes(pattern)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      matches.push({
        name: categoryName,
        emoji: config.emoji,
        confidence: matchCount / config.patterns.length,
      });
    }
  }

  // Sort by confidence descending
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if message is an analytical question
 */
function isAnalyticalQuestion(text: string): boolean {
  return ANALYTICAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check if message is an advice/recommendation question
 */
function isAdviceQuestion(text: string): boolean {
  return ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Get spending summary for a user (last 30 days by default)
 */
async function getSpendingSummary(
  db: any,
  userId: string,
  daysBack: number = 30
): Promise<{
  totalExpenses: number;
  totalIncome: number;
  byCategory: Array<{ name: string; emoji: string | null; total: number; count: number }>;
  recentTransactions: Array<{ description: string; amount: number; date: string; category: string | null }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get all transactions for the period
  const userTxs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId));

  // Filter by date
  const recentTxs = userTxs.filter((tx: any) => tx.date >= startDateStr);

  // Calculate totals
  let totalExpenses = 0;
  let totalIncome = 0;
  const categoryTotals: Record<string, { name: string; emoji: string | null; total: number; count: number }> = {};

  // Get user categories for lookup
  const userCats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
  const catMap = new Map(userCats.map((c: any) => [c.id, c]));

  for (const tx of recentTxs) {
    const amount = tx.amountCents / 100;
    if (tx.type === 'income' || tx.amountCents > 0) {
      totalIncome += Math.abs(amount);
    } else {
      totalExpenses += Math.abs(amount);
      // Track by category
      const cat = tx.categoryId ? catMap.get(tx.categoryId) : null;
      const catKey = cat?.name || 'Sin categoría';
      if (!categoryTotals[catKey]) {
        categoryTotals[catKey] = { name: catKey, emoji: cat?.emoji || null, total: 0, count: 0 };
      }
      categoryTotals[catKey].total += Math.abs(amount);
      categoryTotals[catKey].count += 1;
    }
  }

  // Sort categories by total (descending)
  const byCategory = Object.values(categoryTotals).sort((a, b) => b.total - a.total);

  // Get last 10 transactions
  const recentTransactions = recentTxs
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map((tx: any) => {
      const cat = tx.categoryId ? catMap.get(tx.categoryId) : null;
      return {
        description: tx.description,
        amount: tx.amountCents / 100,
        date: tx.date,
        category: cat?.name || null,
      };
    });

  return { totalExpenses, totalIncome, byCategory, recentTransactions };
}

/**
 * Detect subscription-like recurring expenses from actual transaction history.
 * Looks for repeated expenses to same merchants with similar amounts.
 */
async function detectRecurringExpenses(
  db: any,
  userId: string
): Promise<Array<{ name: string; amount: number; count: number; monthlyEstimate: number }>> {
  // Get last 90 days of transactions to detect patterns
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  const startDateStr = startDate.toISOString().split('T')[0];

  const userTxs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId));

  // Filter to expenses in the date range
  const expenses = userTxs.filter(
    (tx: any) => tx.date >= startDateStr && tx.type === 'expense'
  );

  // Group by description (normalized) to find recurring patterns
  const byDescription: Record<string, { amounts: number[]; dates: string[]; description: string }> = {};

  for (const tx of expenses) {
    // Normalize description for grouping
    const normalizedDesc = tx.description
      .toLowerCase()
      .replace(/[0-9]/g, '')
      .trim();

    if (!byDescription[normalizedDesc]) {
      byDescription[normalizedDesc] = {
        amounts: [],
        dates: [],
        description: tx.description,
      };
    }
    byDescription[normalizedDesc].amounts.push(Math.abs(tx.amountCents));
    byDescription[normalizedDesc].dates.push(tx.date);
  }

  // Find recurring patterns (same merchant, 2+ times, similar amounts)
  const recurring: Array<{ name: string; amount: number; count: number; monthlyEstimate: number }> = [];

  for (const [, data] of Object.entries(byDescription)) {
    if (data.amounts.length >= 2) {
      // Check if amounts are similar (within 10% variance)
      const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;
      const allSimilar = data.amounts.every(
        (amt) => Math.abs(amt - avgAmount) / avgAmount < 0.1
      );

      if (allSimilar) {
        // Estimate monthly cost based on frequency
        const daySpan =
          (new Date(data.dates[data.dates.length - 1]!).getTime() -
            new Date(data.dates[0]!).getTime()) /
          (1000 * 60 * 60 * 24);
        const frequency = daySpan > 0 ? data.amounts.length / (daySpan / 30) : 1;
        const monthlyEstimate = (avgAmount / 100) * Math.max(1, frequency);

        recurring.push({
          name: data.description,
          amount: avgAmount / 100,
          count: data.amounts.length,
          monthlyEstimate,
        });
      }
    }
  }

  // Sort by monthly estimate descending
  return recurring.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
}

/**
 * Get top individual expenses by category with transaction details
 */
async function getTopExpensesByCategory(
  db: any,
  userId: string,
  daysBack: number = 30
): Promise<Record<string, Array<{ description: string; amount: number; date: string }>>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];

  const userTxs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId));

  const userCats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
  const catMap = new Map(userCats.map((c: any) => [c.id, c]));

  // Filter and group expenses by category
  const byCategory: Record<string, Array<{ description: string; amount: number; date: string }>> = {};

  for (const tx of userTxs) {
    if (tx.date >= startDateStr && tx.type === 'expense') {
      const cat = tx.categoryId ? catMap.get(tx.categoryId) : null;
      const catName = cat?.name || 'Sin categoría';

      if (!byCategory[catName]) {
        byCategory[catName] = [];
      }
      byCategory[catName].push({
        description: tx.description,
        amount: Math.abs(tx.amountCents) / 100,
        date: tx.date,
      });
    }
  }

  // Sort each category by amount descending and keep top 5
  for (const catName of Object.keys(byCategory)) {
    byCategory[catName] = byCategory[catName]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  return byCategory;
}

/**
 * Generate analytical response based on user data
 */
async function processAnalyticalQuestion(
  db: any,
  userId: string,
  userMessage: string,
  conversationHistory: Message[]
): Promise<CopilotResponse> {
  // Get spending summary, recurring expenses, and top expenses by category
  const summary = await getSpendingSummary(db, userId);
  const recurringExpenses = await detectRecurringExpenses(db, userId);
  const topExpensesByCategory = await getTopExpensesByCategory(db, userId);
  const totalRecurringCost = recurringExpenses.slice(0, 10).reduce((sum, r) => sum + r.monthlyEstimate, 0);

  // Build recurring expenses section (subscription-like patterns from actual transactions)
  const recurringSection = recurringExpenses.length > 0
    ? `\nGASTOS RECURRENTES DETECTADOS (${recurringExpenses.length} patrones, ~$${totalRecurringCost.toFixed(2)}/mes estimado):
${recurringExpenses.slice(0, 10).map((r, i) => `${i + 1}. ${r.name}: $${r.amount.toFixed(2)} x ${r.count} veces (~$${r.monthlyEstimate.toFixed(2)}/mes)`).join('\n')}`
    : '\nGASTOS RECURRENTES: No se detectaron patrones de suscripciones';

  // Build top expenses per category section
  const topExpensesSection = Object.entries(topExpensesByCategory)
    .slice(0, 5)
    .map(([catName, expenses]) => {
      const topExpense = expenses[0];
      return topExpense
        ? `${catName}: Mayor gasto "$${topExpense.description}" $${topExpense.amount.toFixed(2)}`
        : null;
    })
    .filter(Boolean)
    .join('\n');

  const dataContext = `
DATOS DEL USUARIO (últimos 30 días):
- Total gastado: $${summary.totalExpenses.toFixed(2)}
- Total ingresos: $${summary.totalIncome.toFixed(2)}
- Balance: $${(summary.totalIncome - summary.totalExpenses).toFixed(2)}

GASTOS POR CATEGORÍA (ordenados de mayor a menor):
${summary.byCategory.slice(0, 10).map((c, i) => `${i + 1}. ${c.emoji || ''} ${c.name}: $${c.total.toFixed(2)} (${c.count} transacciones)`).join('\n')}

MAYORES GASTOS POR CATEGORÍA:
${topExpensesSection}
${recurringSection}

ÚLTIMAS TRANSACCIONES:
${summary.recentTransactions.slice(0, 5).map((t) => `- ${t.date}: ${t.description} $${t.amount.toFixed(2)}${t.category ? ` (${t.category})` : ''}`).join('\n')}
`;

  const analyticalPrompt = `${SYSTEM_PROMPT}

${dataContext}

El usuario está haciendo una pregunta sobre sus finanzas. Usa los datos anteriores para responder de forma útil, específica y con tu personalidad.

Responde con JSON:
{
  "understood": true,
  "isAnalyticalQuestion": true,
  "response": "tu respuesta analítica con datos específicos"
}`;

  // Try AI first
  try {
    const provider = getProvider();
    console.log(`[Copilot] AI provider: ${provider.name}, configured: ${provider.isConfigured()}`);
    if (provider.isConfigured()) {
      const messages: Message[] = [
        { role: 'system', content: analyticalPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];
      console.log('[Copilot] Calling AI for analytical question...');
      const result = await provider.chat(messages, {
        temperature: 0.5,
        maxTokens: 800,
      });
      console.log('[Copilot] AI response received');
      const aiResponse = parseAIResponse(result.message.content) as any;
      return {
        message: aiResponse.response,
        needsMoreInfo: false,
      };
    } else {
      console.log('[Copilot] AI provider not configured, using fallback');
    }
  } catch (error) {
    console.error('[Copilot] AI error for analytics:', error);
  }

  // Fallback: Generate rule-based analytical response
  if (summary.byCategory.length === 0) {
    return {
      message: 'Hmm, no tienes transacciones registradas todavía. ¡Cuéntame qué gastaste hoy y empecemos a trackear! 📊',
      needsMoreInfo: false,
    };
  }

  const topCategory = summary.byCategory[0];
  const topThree = summary.byCategory.slice(0, 3);
  const percentOfTotal = ((topCategory.total / summary.totalExpenses) * 100).toFixed(0);

  let response = `📊 Bueno, veamos tus números...\n\n`;
  response += `En los últimos 30 días gastaste $${summary.totalExpenses.toFixed(2)}\n\n`;
  response += `Tu gasto más fuerte es ${topCategory.emoji || ''} ${topCategory.name} con $${topCategory.total.toFixed(2)} (${percentOfTotal}% del total) 👀\n\n`;

  if (topThree.length > 1) {
    response += `Top 3 categorías:\n`;
    topThree.forEach((c, i) => {
      response += `${i + 1}. ${c.emoji || ''} ${c.name}: $${c.total.toFixed(2)}\n`;
    });
  }

  if (summary.totalIncome > 0) {
    const savings = summary.totalIncome - summary.totalExpenses;
    if (savings > 0) {
      response += `\n💪 ¡Bien! Ahorraste $${savings.toFixed(2)} este mes.`;
    } else {
      response += `\n⚠️ Ojo: gastaste $${Math.abs(savings).toFixed(2)} más de lo que ganaste.`;
    }
  }

  return {
    message: response,
    needsMoreInfo: false,
  };
}

/**
 * Generate advice response based on user data and question
 */
async function processAdviceQuestion(
  db: any,
  userId: string,
  userMessage: string,
  conversationHistory: Message[]
): Promise<CopilotResponse> {
  // Get spending summary for context
  const summary = await getSpendingSummary(db, userId);

  // Get user profile for financial info
  const profile = await getOrCreateUserProfile(db, userId);

  // Build context for AI
  const dataContext = `
DATOS DEL USUARIO:
- Salario mensual: ${profile.monthlySalaryCents ? `$${(profile.monthlySalaryCents / 100).toFixed(2)}` : 'No especificado'}
- Frecuencia de pago: ${profile.payFrequency || 'No especificada'}
- Meta de ahorro mensual: ${profile.monthlySavingsGoalCents ? `$${(profile.monthlySavingsGoalCents / 100).toFixed(2)}` : 'No especificada'}

RESUMEN ÚLTIMOS 30 DÍAS:
- Total gastado: $${summary.totalExpenses.toFixed(2)}
- Total ingresos: $${summary.totalIncome.toFixed(2)}
- Balance: $${(summary.totalIncome - summary.totalExpenses).toFixed(2)}

PRINCIPALES GASTOS:
${summary.byCategory.slice(0, 5).map((c, i) => `${i + 1}. ${c.emoji || ''} ${c.name}: $${c.total.toFixed(2)}`).join('\n')}
`;

  const advicePrompt = `${SYSTEM_PROMPT}

${dataContext}

El usuario está pidiendo consejos o recomendaciones financieras. Usa los datos anteriores para dar consejos personalizados, específicos y prácticos. Sé motivador pero realista.

TEMAS COMUNES Y CÓMO RESPONDER:
- Fondo de emergencias: Recomienda 3-6 meses de gastos. Calcula basándote en sus gastos.
- Ahorro: Sugiere la regla 50/30/20 o un porcentaje basado en su situación.
- Reducir gastos: Identifica categorías donde gasta mucho y sugiere alternativas.
- Inversiones: Solo menciona si ya tiene fondo de emergencias. Sugiere empezar simple.
- Deudas: Priorizar pagar deudas de alto interés primero.

Responde con JSON:
{
  "understood": true,
  "isAdviceQuestion": true,
  "response": "tu consejo personalizado con datos específicos del usuario"
}`;

  // Try AI first
  try {
    const provider = getProvider();
    console.log(`[Copilot] AI provider: ${provider.name}, configured: ${provider.isConfigured()}`);
    if (provider.isConfigured()) {
      const messages: Message[] = [
        { role: 'system', content: advicePrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];
      console.log('[Copilot] Calling AI for advice question...');
      const result = await provider.chat(messages, {
        temperature: 0.6,
        maxTokens: 1000,
      });
      console.log('[Copilot] AI response received');
      const aiResponse = parseAIResponse(result.message.content) as any;
      return {
        message: aiResponse.response,
        needsMoreInfo: false,
      };
    } else {
      console.log('[Copilot] AI provider not configured, using fallback');
    }
  } catch (error) {
    console.error('[Copilot] AI error for advice:', error);
  }

  // Fallback: Generate rule-based advice
  const lowerMessage = userMessage.toLowerCase();
  let response = '';

  // Detect what type of advice they want
  if (lowerMessage.includes('emergencia') || lowerMessage.includes('fondo')) {
    // Emergency fund advice
    const monthlyExpenses = summary.totalExpenses;
    const recommendedFund3 = monthlyExpenses * 3;
    const recommendedFund6 = monthlyExpenses * 6;

    response = `💡 Fondo de Emergencias\n\n`;
    response += `Basándome en tus gastos de $${monthlyExpenses.toFixed(2)}/mes, te recomiendo:\n\n`;
    response += `• Mínimo: $${recommendedFund3.toFixed(2)} (3 meses de gastos)\n`;
    response += `• Ideal: $${recommendedFund6.toFixed(2)} (6 meses de gastos)\n\n`;

    if (profile.monthlySalaryCents) {
      const salary = profile.monthlySalaryCents / 100;
      const suggested20 = salary * 0.2;
      const monthsTo3 = Math.ceil(recommendedFund3 / suggested20);
      response += `Si ahorras 20% de tu salario ($${suggested20.toFixed(2)}/mes), llegarías a tu meta en ~${monthsTo3} meses 💪\n\n`;
    }

    response += `Tip: Abre una cuenta separada SOLO para emergencias. ¡No la toques a menos que sea real emergencia!`;
  } else if (lowerMessage.includes('ahorr')) {
    // Savings advice
    response = `🐷 Tips para Ahorrar\n\n`;

    if (summary.byCategory.length > 0) {
      const topSpending = summary.byCategory[0];
      response += `Tu mayor gasto es ${topSpending.emoji || ''} ${topSpending.name} ($${topSpending.total.toFixed(2)}). `;

      if (topSpending.name.toLowerCase().includes('restaurant') ||
          topSpending.name.toLowerCase().includes('café') ||
          topSpending.name.toLowerCase().includes('comida')) {
        response += `¿Has pensado en cocinar más en casa? Podrías ahorrar hasta 50% 🍳\n\n`;
      } else if (topSpending.name.toLowerCase().includes('streaming') ||
                 topSpending.name.toLowerCase().includes('suscripc')) {
        response += `Revisa si usas todas esas suscripciones. ¡Cancela las que no uses! 📺\n\n`;
      } else {
        response += `Busca alternativas más económicas o reduce la frecuencia.\n\n`;
      }
    }

    response += `La regla 50/30/20:\n`;
    response += `• 50% necesidades (renta, servicios, comida)\n`;
    response += `• 30% gustos (entretenimiento, restaurantes)\n`;
    response += `• 20% ahorro e inversión\n\n`;

    if (profile.monthlySalaryCents) {
      const salary = profile.monthlySalaryCents / 100;
      response += `Con tu salario, eso sería ~$${(salary * 0.2).toFixed(2)}/mes para ahorrar.`;
    }
  } else if (lowerMessage.includes('invert') || lowerMessage.includes('inversión')) {
    // Investment advice
    response = `📈 Sobre Inversiones\n\n`;
    response += `Antes de invertir, asegúrate de tener:\n`;
    response += `1. ✅ Fondo de emergencias (3-6 meses de gastos)\n`;
    response += `2. ✅ Deudas de alto interés pagadas\n\n`;
    response += `Si ya tienes eso, empieza simple:\n`;
    response += `• Principiante: Fondos indexados (ETFs) de bajo costo\n`;
    response += `• Diversifica: No pongas todo en una sola cosa\n`;
    response += `• Largo plazo: Invierte dinero que no necesitarás en 5+ años\n\n`;
    response += `⚠️ Nunca inviertas dinero que no puedas perder. ¡Infórmate bien primero!`;
  } else {
    // General financial advice
    response = `💰 Consejos Generales\n\n`;

    if (summary.totalIncome > 0 && summary.totalExpenses > summary.totalIncome) {
      response += `⚠️ Estás gastando más de lo que ganas. Prioridad #1: reducir gastos.\n\n`;
    }

    response += `Orden de prioridades financieras:\n`;
    response += `1. 🏦 Fondo de emergencias (3-6 meses)\n`;
    response += `2. 💳 Pagar deudas (empezando por las de mayor interés)\n`;
    response += `3. 🐷 Ahorrar 20% de tus ingresos\n`;
    response += `4. 📈 Invertir para el futuro\n\n`;
    response += `¿Sobre qué tema específico quieres que profundicemos? 🤔`;
  }

  return {
    message: response,
    needsMoreInfo: false,
  };
}

/**
 * Process a user message and extract transaction info
 */
export async function processMessage(
  userId: string,
  userMessage: string,
  conversationHistory: Message[] = []
): Promise<CopilotResponse> {
  const db = await getDb();

  // Check if user needs onboarding
  const onboardingStatus = await needsOnboarding(db, userId);
  if (onboardingStatus.needs) {
    return processOnboardingResponse(
      db,
      userId,
      userMessage,
      onboardingStatus.step
    );
  }

  // Check if this is an advice/recommendation question (check FIRST - more specific)
  if (isAdviceQuestion(userMessage)) {
    return processAdviceQuestion(db, userId, userMessage, conversationHistory);
  }

  // Check if this is an analytical question
  if (isAnalyticalQuestion(userMessage)) {
    return processAnalyticalQuestion(db, userId, userMessage, conversationHistory);
  }

  // Get user's categories for context
  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  // Get user's default account (or create one if none exists)
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  let defaultAccount = userAccounts[0];

  // Auto-create "Efectivo" account if no accounts exist
  if (!defaultAccount) {
    const newAccount = await accountRepo.createAccount(db, {
      userId,
      name: 'Efectivo',
      type: 'cash',
    });
    if (!newAccount) {
      return {
        message: 'Error al crear la cuenta. Por favor intenta de nuevo.',
        needsMoreInfo: false,
      };
    }
    // Save database after creating account
    saveDatabase();
    defaultAccount = newAccount;
  }

  // Build messages for AI
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // Try to use AI for extraction
  let aiResponse: any = null;
  try {
    const provider = getProvider();
    console.log(`[Copilot] AI provider: ${provider.name}, configured: ${provider.isConfigured()}`);
    if (provider.isConfigured()) {
      console.log('[Copilot] Calling AI for transaction extraction...');
      const result = await provider.chat(messages, {
        temperature: 0.3,
        maxTokens: 500,
      });
      console.log('[Copilot] AI response received');
      aiResponse = parseAIResponse(result.message.content) as any;
    } else {
      console.log('[Copilot] AI provider not configured, using rule-based extraction');
    }
  } catch (error) {
    console.error('[Copilot] AI error for extraction:', error);
  }

  // Check if AI detected an analytical question
  if (aiResponse?.isAnalyticalQuestion) {
    return processAnalyticalQuestion(db, userId, userMessage, conversationHistory);
  }

  // If AI is not available, use rule-based extraction
  if (!aiResponse) {
    aiResponse = extractTransactionFromText(userMessage);
  }

  // If we need more info, return follow-up question
  if (aiResponse.needsMoreInfo) {
    return {
      message: aiResponse.followUpQuestion || aiResponse.response,
      needsMoreInfo: true,
      missingFields: aiResponse.missingFields || [],
    };
  }

  // If we understood the transaction
  if (aiResponse.understood && aiResponse.transaction) {
    const txData = aiResponse.transaction;

    // Find or suggest category
    let categoryId: string | null = null;
    let categoryName: string | null = txData.suggestedCategory || null;
    let categoryEmoji: string | null = txData.suggestedEmoji || null;
    let categoryAutoCreated = false;

    // Try to match with existing category
    if (categoryName) {
      const matchedCategory = userCategories.find(
        (c) => c.name.toLowerCase() === categoryName!.toLowerCase()
      );
      if (matchedCategory) {
        categoryId = matchedCategory.id;
        categoryName = matchedCategory.name;
      }
    }

    // If no category matched, try pattern matching with confidence check
    if (!categoryId) {
      // Find all matching categories
      const matchingCategories = findMatchingCategories(
        txData.description || userMessage
      );

      // If we have multiple good matches, ask user to confirm
      if (matchingCategories.length >= 2) {
        const topTwo = matchingCategories.slice(0, 2);
        // If confidence difference is small (both are plausible), ask user
        if (topTwo[0].confidence - topTwo[1].confidence < 0.3) {
          const formattedAmount = (Math.abs(txData.amountCents) / 100).toFixed(
            2
          );
          return {
            message: `$${formattedAmount} en "${txData.description}". ¿En qué categoría lo pongo: ${topTwo[0].emoji} ${topTwo[0].name} o ${topTwo[1].emoji} ${topTwo[1].name}?`,
            needsCategoryConfirmation: true,
            categoryOptions: topTwo.map((c) => ({
              name: c.name,
              emoji: c.emoji,
            })),
            pendingTransaction: {
              amountCents: txData.amountCents,
              description: txData.description,
              merchant: txData.merchant,
              date: txData.date || new Date().toISOString().split('T')[0],
              type: txData.type || 'expense',
            },
          };
        }
      }

      // Use the top match if we have one
      if (matchingCategories.length > 0) {
        const bestMatch = matchingCategories[0];
        const matchedCategory = userCategories.find(
          (c) => c.name.toLowerCase() === bestMatch.name.toLowerCase()
        );
        if (matchedCategory) {
          categoryId = matchedCategory.id;
          categoryName = matchedCategory.name;
        } else {
          categoryName = bestMatch.name;
          categoryEmoji = bestMatch.emoji;
        }
      } else {
        // Fallback to single-match function
        const suggestedCategoryName = suggestCategoryFromText(
          txData.description || userMessage
        );
        if (suggestedCategoryName) {
          const matchedCategory = userCategories.find(
            (c) => c.name.toLowerCase() === suggestedCategoryName.toLowerCase()
          );
          if (matchedCategory) {
            categoryId = matchedCategory.id;
            categoryName = matchedCategory.name;
          } else {
            categoryName = suggestedCategoryName;
            categoryEmoji =
              CATEGORY_CONFIG[suggestedCategoryName]?.emoji || null;
          }
        }
      }
    }

    // Auto-create category if it doesn't exist and we have a name
    if (!categoryId && categoryName) {
      // Get emoji from AI response or our config
      if (!categoryEmoji && CATEGORY_CONFIG[categoryName]) {
        categoryEmoji = CATEGORY_CONFIG[categoryName].emoji;
      }
      // Default emoji based on transaction type
      if (!categoryEmoji) {
        categoryEmoji = txData.type === 'income' ? '💰' : '📦';
      }

      try {
        const newCategory = await categoryRepo.createCategory(db, {
          userId,
          name: categoryName,
          emoji: categoryEmoji,
        });
        if (newCategory) {
          categoryId = newCategory.id;
          categoryAutoCreated = true;
          // Save database after creating category
          saveDatabase();
        }
      } catch (error) {
        console.log('Failed to auto-create category:', error);
      }
    }

    const transaction: ExtractedTransaction = {
      amountCents: txData.amountCents,
      description: txData.description,
      merchant: txData.merchant,
      date: txData.date || new Date().toISOString().split('T')[0],
      categoryId,
      categoryName,
      type: txData.type || 'expense',
      notes: null,
    };

    // Create the transaction
    const newTransaction = await transactionRepo.createTransaction(db, {
      userId,
      date: transaction.date,
      description: transaction.description,
      amountCents:
        transaction.type === 'expense'
          ? -Math.abs(transaction.amountCents)
          : Math.abs(transaction.amountCents),
      type: transaction.type,
      categoryId: transaction.categoryId,
      accountId: defaultAccount.id,
      cleared: false,
      notes: transaction.merchant ? `Comercio: ${transaction.merchant}` : null,
    });

    // Save database after mutation
    saveDatabase();

    const formattedAmount = (Math.abs(transaction.amountCents) / 100).toFixed(
      2
    );
    const categoryText = categoryName
      ? ` en ${categoryEmoji || ''} ${categoryName}`
      : '';
    const categoryCreatedText = categoryAutoCreated
      ? ` (creé esta categoría para ti!)`
      : '';

    // Generate a sassy response based on transaction type and amount
    let sassyResponse = aiResponse.response;
    if (!sassyResponse) {
      if (transaction.type === 'income') {
        const incomeResponses = [
          `¡Eso! Llegaron $${formattedAmount} 💰 ${categoryText}. ¡A invertir una parte!`,
          `Niceee! $${formattedAmount}${categoryText}. ¿Ya pensaste cuánto vas a ahorrar? 🐷`,
          `¡Ka-ching! $${formattedAmount}${categoryText}. Recuerda: paga tus deudas primero 😉`,
        ];
        sassyResponse =
          incomeResponses[Math.floor(Math.random() * incomeResponses.length)];
      } else {
        const amountDollars = Math.abs(transaction.amountCents) / 100;
        if (amountDollars < 20) {
          const smallResponses = [
            `Listo! $${formattedAmount}${categoryText}. Pequeños gastos suman, ojo 👀`,
            `Anotado! $${formattedAmount}${categoryText}.`,
          ];
          sassyResponse =
            smallResponses[Math.floor(Math.random() * smallResponses.length)];
        } else if (amountDollars < 100) {
          const mediumResponses = [
            `$${formattedAmount}${categoryText}. Cada peso cuenta 💪`,
            `Registrado! $${formattedAmount}${categoryText}. ¿Estaba planeado? 🤔`,
          ];
          sassyResponse =
            mediumResponses[Math.floor(Math.random() * mediumResponses.length)];
        } else {
          const largeResponses = [
            `Uff, $${formattedAmount}${categoryText} 💸 ¿Estaba en el presupuesto?`,
            `$${formattedAmount}${categoryText}. Ese sí se sintió... 🫣`,
            `Bueno bueno, $${formattedAmount}${categoryText}. Espero que valiera la pena 😅`,
          ];
          sassyResponse =
            largeResponses[Math.floor(Math.random() * largeResponses.length)];
        }
      }
    }

    if (categoryAutoCreated) {
      sassyResponse += categoryCreatedText;
    }

    return {
      message: sassyResponse,
      transaction,
      transactionCreated: true,
      transactionId: newTransaction?.id,
      suggestedCategories: userCategories
        .filter((c) => c.id !== categoryId)
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
    };
  }

  // Fallback response with personality
  const fallbackResponses = [
    '¿Puedes decirme el monto y en qué gastaste? 🤔',
    'Oye, no entendí bien. ¿Cuánto fue y en qué?',
    'Hmm, necesito más info. ¿Monto y descripción? 💭',
  ];
  return {
    message:
      aiResponse.response ||
      fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
    needsMoreInfo: true,
    missingFields: ['amount', 'description'],
  };
}

/**
 * Parse a money string into cents
 * Handles formats like:
 * - $2,500.00 -> 250000 (commas as thousands, period as decimal)
 * - $2500 -> 250000 (no separators)
 * - $2.50 -> 250 (period as decimal)
 * - $2,50 -> 250 (European format, comma as decimal)
 */
function parseMoneyToCents(moneyStr: string): number {
  // Remove currency symbols and whitespace
  let cleaned = moneyStr.replace(/[$\s]/g, '');

  // Check if it has both comma and period
  const hasComma = cleaned.includes(',');
  const hasPeriod = cleaned.includes('.');

  if (hasComma && hasPeriod) {
    // Format like 2,500.00 - comma is thousands separator, period is decimal
    cleaned = cleaned.replace(/,/g, '');
    const amount = parseFloat(cleaned);
    return Math.round(amount * 100);
  } else if (hasComma) {
    // Could be 2,500 (thousands) or 2,50 (European decimal)
    // If 3 digits after comma, it's thousands separator
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length === 3) {
      // 2,500 -> 2500
      cleaned = cleaned.replace(/,/g, '');
      return Math.round(parseFloat(cleaned) * 100);
    } else {
      // 2,50 -> 2.50 (European format)
      cleaned = cleaned.replace(',', '.');
      return Math.round(parseFloat(cleaned) * 100);
    }
  } else if (hasPeriod) {
    // Check if it looks like thousands (2.500) or decimal (2.50)
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      // 2.500 -> 2500 (some locales use period as thousands separator)
      cleaned = cleaned.replace(/\./g, '');
      return Math.round(parseFloat(cleaned) * 100);
    } else {
      // Normal decimal like 2.50
      return Math.round(parseFloat(cleaned) * 100);
    }
  }

  // No separators - just a number
  return Math.round(parseFloat(cleaned) * 100);
}

/**
 * Rule-based transaction extraction (fallback when AI is not available)
 */
function extractTransactionFromText(text: string): any {
  const lowerText = text.toLowerCase();

  // Extract amount - patterns like "$50", "$2,500", "$2,500.00", "50 dólares"
  const amountPatterns = [
    // $2,500.00 or $2500.00 or $2,500 or $2500
    /\$\s*([\d,]+(?:\.\d{1,2})?)/,
    // 2,500 dólares or 2500 dollars
    /([\d,]+(?:\.\d{1,2})?)\s*(?:dólares?|dolares?|pesos?|usd|balboas?)/i,
    // gasté 2500 or gasté $2500
    /gast[eéo]\s+\$?([\d,]+(?:\.\d{1,2})?)/i,
    // 2500 en or 2500 de
    /([\d,]+(?:\.\d{1,2})?)\s+(?:en|de)/i,
    // Me pagaron 2500 or pagaron $2500
    /pagar?on?\s+\$?([\d,]+(?:\.\d{1,2})?)/i,
    // quincena 2500 or quincena de $2500
    /quincena\s+(?:de\s+)?\$?([\d,]+(?:\.\d{1,2})?)/i,
    // salario 2500 or salario de $2500
    /salario\s+(?:de\s+)?\$?([\d,]+(?:\.\d{1,2})?)/i,
  ];

  let amountCents: number | null = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      amountCents = parseMoneyToCents(match[1]);
      break;
    }
  }

  // Extract date
  let date = new Date().toISOString().split('T')[0];
  if (lowerText.includes('ayer')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  } else if (
    lowerText.includes('anteayer') ||
    lowerText.includes('ante ayer')
  ) {
    const dayBeforeYesterday = new Date();
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    date = dayBeforeYesterday.toISOString().split('T')[0];
  }

  // Determine if it's income or expense
  const isIncome =
    /recib[íi]|cobr[eé]|gan[eé]|ingreso|salario|quincena|sueldo|pago.*recibido|me\s+pagar?on?|depositar?on?|bonificaci[oó]n|bono|transferencia.*recib/i.test(
      lowerText
    );
  const type = isIncome ? 'income' : 'expense';

  // Extract description - what they spent on
  let description = '';
  let merchant: string | null = null;

  // Common patterns for what was purchased
  const descPatterns = [
    /(?:en|de)\s+(.+?)(?:\s+por|\s+en|\s+con|\s+\$|$)/i,
    /gast[eéo]\s+(?:\$?\d+(?:[.,]\d{2})?)\s+(?:en|de)\s+(.+)/i,
    /compr[eéo]\s+(.+?)(?:\s+por|\s+en|\s+\$|$)/i,
  ];

  for (const pattern of descPatterns) {
    const match = text.match(pattern);
    if (match) {
      description = match[1].trim();
      break;
    }
  }

  // If no description found, use the whole text cleaned up
  if (!description) {
    description =
      text
        .replace(/\$?\d+(?:[.,]\d{2})?/g, '')
        .replace(/hoy|ayer|anteayer/gi, '')
        .replace(/gast[eéo]/gi, '')
        .trim() || 'Gasto';
  }

  // Try to extract merchant name (capitalized words, brand names)
  const merchantMatch = text.match(
    /(?:en|de)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/
  );
  if (merchantMatch) {
    merchant = merchantMatch[1];
  }

  // Suggest category
  const suggestedCategory = suggestCategoryFromText(text);

  // Determine if we have enough info
  const needsMoreInfo = !amountCents;
  const missingFields: string[] = [];
  if (!amountCents) missingFields.push('monto');

  if (needsMoreInfo) {
    const needsInfoResponses = [
      'Oye, ¿cuánto fue?',
      '¿Cuánto gastaste? 🤔',
      'Me falta el monto!',
    ];
    return {
      understood: false,
      needsMoreInfo: true,
      missingFields,
      followUpQuestion: '¿Cuánto gastaste?',
      response:
        needsInfoResponses[
          Math.floor(Math.random() * needsInfoResponses.length)
        ],
    };
  }

  // Get emoji for the category
  const categoryEmoji = suggestedCategory
    ? CATEGORY_CONFIG[suggestedCategory]?.emoji ||
      (type === 'income' ? '💰' : '📦')
    : null;

  return {
    understood: true,
    needsMoreInfo: false,
    transaction: {
      amountCents,
      description: description.charAt(0).toUpperCase() + description.slice(1),
      merchant,
      date,
      type,
      suggestedCategory,
      suggestedEmoji: categoryEmoji,
    },
    response: null, // Let the main function handle the sassy response
  };
}

/**
 * Suggest a category based on text patterns
 */
function suggestCategoryFromText(text: string): string | null {
  const lowerText = text.toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Get conversation suggestions/quick actions
 */
export function getQuickActions(): Array<{ text: string; example: string }> {
  return [
    { text: 'Registrar gasto', example: 'Gasté $30 en almuerzo' },
    { text: 'Compras', example: 'Compré ropa por $150 en Zara' },
    { text: 'Transporte', example: '$15 de Uber' },
    { text: 'Supermercado', example: 'Super $80' },
  ];
}

/**
 * Update category for a recently created transaction
 */
export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();

  // Verify transaction belongs to user
  const tx = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    );

  if (!tx.length) {
    return false;
  }

  await transactionRepo.updateTransaction(db, transactionId, { categoryId });
  return true;
}
