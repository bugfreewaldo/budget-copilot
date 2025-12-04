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
import { categories, transactions, accounts, userProfiles } from '../../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import type { Message } from '@budget-copilot/ai';
import { getProvider } from '@budget-copilot/ai';
import * as categoryRepo from '../../server/lib/repo/categories.js';
import * as transactionRepo from '../../server/lib/repo/transactions.js';
import * as accountRepo from '../../server/lib/repo/accounts.js';

// Onboarding questions flow
const ONBOARDING_QUESTIONS = [
  {
    step: 1,
    question: '¡Hola! Soy tu Budget Copilot 🧠 Para ayudarte mejor, ¿cuánto ganas al mes? (Ejemplo: $2500)',
    field: 'monthlySalaryCents',
  },
  {
    step: 2,
    question: '¿Cada cuánto te pagan? (semanal, quincenal, o mensual)',
    field: 'payFrequency',
  },
  {
    step: 3,
    question: '¿Tienes alguna deuda? (tarjetas de crédito, préstamos, etc.) Cuéntame sobre la más importante primero.',
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
  suggestedCategories?: Array<{ id: string; name: string; emoji: string | null }>;
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
2. Auto-crear categorías creativas con emojis cuando sea necesario
3. Dar tips financieros cortos y útiles ocasionalmente
4. Animar al usuario a gastar menos y ahorrar más

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

// Category mapping with emojis for auto-creation
const CATEGORY_CONFIG: Record<string, { patterns: string[]; emoji: string }> = {
  'Compras': { patterns: ['ropa', 'zapatos', 'nike', 'zara', 'h&m', 'adidas', 'tienda', 'mall', 'centro comercial', 'amazon', 'compré', 'compras'], emoji: '🛍️' },
  'Supermercado': { patterns: ['super', 'supermercado', 'mercado', 'walmart', 'costco', 'alimentos', 'verduras', 'frutas', 'rey', 'pricesmart', 'groceries'], emoji: '🛒' },
  'Restaurantes': { patterns: ['restaurante', 'almuerzo', 'cena', 'desayuno', 'pizza', 'sushi', 'hamburguesa', 'mcdonald', 'burger', 'kfc', 'pollo', 'comí', 'comida'], emoji: '🍽️' },
  'Café': { patterns: ['café', 'coffee', 'starbucks', 'dunkin', 'cafetería', 'latte', 'cappuccino'], emoji: '☕' },
  'Transporte': { patterns: ['uber', 'taxi', 'gasolina', 'gas', 'estacionamiento', 'metro', 'bus', 'transporte', 'didi', 'cabify', 'indriver'], emoji: '🚗' },
  'Entretenimiento': { patterns: ['cine', 'juegos', 'concierto', 'película', 'entretenimiento', 'fiesta', 'bar', 'club', 'diversión'], emoji: '🎬' },
  'Streaming': { patterns: ['netflix', 'spotify', 'disney', 'hbo', 'prime', 'youtube', 'apple tv', 'streaming', 'max'], emoji: '📺' },
  'Salud': { patterns: ['farmacia', 'medicina', 'doctor', 'hospital', 'dentista', 'médico', 'salud', 'consulta', 'medicamentos'], emoji: '🏥' },
  'Servicios': { patterns: ['luz', 'agua', 'internet', 'teléfono', 'cable', 'electricidad', 'servicios', 'gas natural', 'factura'], emoji: '💡' },
  'Gimnasio': { patterns: ['gym', 'gimnasio', 'fitness', 'ejercicio', 'yoga', 'deporte', 'crossfit', 'entrenamiento'], emoji: '💪' },
  'Belleza': { patterns: ['peluquería', 'salón', 'uñas', 'barbería', 'spa', 'belleza', 'corte', 'maquillaje', 'skincare'], emoji: '💅' },
  'Educación': { patterns: ['libro', 'curso', 'escuela', 'universidad', 'clase', 'educación', 'udemy', 'platzi', 'coursera', 'estudio'], emoji: '📚' },
  'Suscripciones': { patterns: ['suscripción', 'membresía', 'mensual', 'anual', 'premium'], emoji: '🔄' },
  'Regalos': { patterns: ['regalo', 'cumpleaños', 'navidad', 'presente', 'sorpresa'], emoji: '🎁' },
  'Viajes': { patterns: ['hotel', 'vuelo', 'viaje', 'airbnb', 'avión', 'vacaciones', 'hospedaje', 'pasaje', 'boleto'], emoji: '✈️' },
  'Mascotas': { patterns: ['mascota', 'perro', 'gato', 'veterinario', 'comida mascota', 'pet', 'vet'], emoji: '🐾' },
  'Hogar': { patterns: ['casa', 'hogar', 'muebles', 'decoración', 'electrodoméstico', 'limpieza', 'ferretería'], emoji: '🏠' },
  'Tecnología': { patterns: ['celular', 'laptop', 'computadora', 'tech', 'gadget', 'electrónica', 'apple', 'samsung'], emoji: '📱' },
  'Seguros': { patterns: ['seguro', 'póliza', 'insurance', 'cobertura'], emoji: '🛡️' },
  'Salario': { patterns: ['salario', 'sueldo', 'quincena', 'pago', 'nómina', 'ingreso', 'trabajo'], emoji: '💰' },
  'Freelance': { patterns: ['freelance', 'proyecto', 'cliente', 'trabajo extra', 'side hustle', 'consultoría'], emoji: '💻' },
  'Inversiones': { patterns: ['inversión', 'dividendo', 'interés', 'rendimiento', 'acciones', 'cripto', 'bitcoin'], emoji: '📈' },
  'Deudas': { patterns: ['deuda', 'préstamo', 'tarjeta', 'crédito', 'pago tarjeta', 'cuota'], emoji: '💳' },
  'Ahorro': { patterns: ['ahorro', 'guardé', 'aparté', 'reserva', 'fondo', 'emergencia'], emoji: '🐷' },
};

// Legacy patterns mapping for backward compatibility
const CATEGORY_PATTERNS: Record<string, string[]> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([name, config]) => [name, config.patterns])
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

  return (await db.select().from(userProfiles).where(eq(userProfiles.id, id)))[0];
}

/**
 * Check if user needs onboarding
 */
async function needsOnboarding(db: any, userId: string): Promise<{ needs: boolean; step: number }> {
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

    case 1: { // Salary
      const salaryMatch = userMessage.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
      if (salaryMatch) {
        const salaryCents = parseMoneyToCents(salaryMatch[1]);
        await db
          .update(userProfiles)
          .set({ monthlySalaryCents: salaryCents, onboardingStep: 2, updatedAt: Date.now() })
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

    case 2: { // Pay frequency
      let frequency: string | null = null;
      if (lowerMessage.includes('semanal') || lowerMessage.includes('semana')) {
        frequency = 'weekly';
      } else if (lowerMessage.includes('quincen') || lowerMessage.includes('bi')) {
        frequency = 'biweekly';
      } else if (lowerMessage.includes('mensual') || lowerMessage.includes('mes')) {
        frequency = 'monthly';
      }

      if (frequency) {
        await db
          .update(userProfiles)
          .set({ payFrequency: frequency, onboardingStep: 3, updatedAt: Date.now() })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();

        const freqText = frequency === 'weekly' ? 'semanalmente' : frequency === 'biweekly' ? 'quincenalmente' : 'mensualmente';
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
      if (lowerMessage.includes('no') || lowerMessage.includes('ninguna') || lowerMessage.includes('nada')) {
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

    case 4: { // Savings goal
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
      if (lowerMessage.includes('no') || lowerMessage.includes('saltar') || lowerMessage.includes('skip')) {
        await db
          .update(userProfiles)
          .set({ onboardingStep: 5, onboardingCompleted: true, updatedAt: Date.now() })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();
        return {
          message: '¡Listo! Puedes configurar tu meta de ahorro después.\n\nAhora cuéntame: ¿qué gastaste hoy? 💸',
          isOnboarding: false,
          onboardingStep: 5,
        };
      }
      return {
        message: '¿Cuánto te gustaría ahorrar cada mes? (Ejemplo: $200, o escribe "saltar" para omitir)',
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
function findMatchingCategories(text: string): Array<{ name: string; emoji: string; confidence: number }> {
  const lowerText = text.toLowerCase();
  const matches: Array<{ name: string; emoji: string; confidence: number }> = [];

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
    return processOnboardingResponse(db, userId, userMessage, onboardingStatus.step);
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
    if (provider.isConfigured()) {
      const result = await provider.chat(messages, {
        temperature: 0.3,
        maxTokens: 500,
      });
      aiResponse = JSON.parse(result.message.content);
    }
  } catch (error) {
    console.log('AI provider not available, using rule-based extraction');
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
      const matchingCategories = findMatchingCategories(txData.description || userMessage);

      // If we have multiple good matches, ask user to confirm
      if (matchingCategories.length >= 2) {
        const topTwo = matchingCategories.slice(0, 2);
        // If confidence difference is small (both are plausible), ask user
        if (topTwo[0].confidence - topTwo[1].confidence < 0.3) {
          const formattedAmount = (Math.abs(txData.amountCents) / 100).toFixed(2);
          return {
            message: `$${formattedAmount} en "${txData.description}". ¿En qué categoría lo pongo: ${topTwo[0].emoji} ${topTwo[0].name} o ${topTwo[1].emoji} ${topTwo[1].name}?`,
            needsCategoryConfirmation: true,
            categoryOptions: topTwo.map(c => ({ name: c.name, emoji: c.emoji })),
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
            categoryEmoji = CATEGORY_CONFIG[suggestedCategoryName]?.emoji || null;
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
      amountCents: transaction.type === 'expense' ? -Math.abs(transaction.amountCents) : Math.abs(transaction.amountCents),
      type: transaction.type,
      categoryId: transaction.categoryId,
      accountId: defaultAccount.id,
      cleared: false,
      notes: transaction.merchant ? `Comercio: ${transaction.merchant}` : null,
    });

    // Save database after mutation
    saveDatabase();

    const formattedAmount = (Math.abs(transaction.amountCents) / 100).toFixed(2);
    const categoryText = categoryName ? ` en ${categoryEmoji || ''} ${categoryName}` : '';
    const categoryCreatedText = categoryAutoCreated ? ` (creé esta categoría para ti!)` : '';

    // Generate a sassy response based on transaction type and amount
    let sassyResponse = aiResponse.response;
    if (!sassyResponse) {
      if (transaction.type === 'income') {
        const incomeResponses = [
          `¡Eso! Llegaron $${formattedAmount} 💰 ${categoryText}. ¡A invertir una parte!`,
          `Niceee! $${formattedAmount}${categoryText}. ¿Ya pensaste cuánto vas a ahorrar? 🐷`,
          `¡Ka-ching! $${formattedAmount}${categoryText}. Recuerda: paga tus deudas primero 😉`,
        ];
        sassyResponse = incomeResponses[Math.floor(Math.random() * incomeResponses.length)];
      } else {
        const amountDollars = Math.abs(transaction.amountCents) / 100;
        if (amountDollars < 20) {
          const smallResponses = [
            `Listo! $${formattedAmount}${categoryText}. Pequeños gastos suman, ojo 👀`,
            `Anotado! $${formattedAmount}${categoryText}.`,
          ];
          sassyResponse = smallResponses[Math.floor(Math.random() * smallResponses.length)];
        } else if (amountDollars < 100) {
          const mediumResponses = [
            `$${formattedAmount}${categoryText}. Cada peso cuenta 💪`,
            `Registrado! $${formattedAmount}${categoryText}. ¿Estaba planeado? 🤔`,
          ];
          sassyResponse = mediumResponses[Math.floor(Math.random() * mediumResponses.length)];
        } else {
          const largeResponses = [
            `Uff, $${formattedAmount}${categoryText} 💸 ¿Estaba en el presupuesto?`,
            `$${formattedAmount}${categoryText}. Ese sí se sintió... 🫣`,
            `Bueno bueno, $${formattedAmount}${categoryText}. Espero que valiera la pena 😅`,
          ];
          sassyResponse = largeResponses[Math.floor(Math.random() * largeResponses.length)];
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
    message: aiResponse.response || fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
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
  } else if (lowerText.includes('anteayer') || lowerText.includes('ante ayer')) {
    const dayBeforeYesterday = new Date();
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    date = dayBeforeYesterday.toISOString().split('T')[0];
  }

  // Determine if it's income or expense
  const isIncome = /recib[íi]|cobr[eé]|gan[eé]|ingreso|salario|quincena|sueldo|pago.*recibido|me\s+pagar?on?|depositar?on?|bonificaci[oó]n|bono|transferencia.*recib/i.test(lowerText);
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
    description = text
      .replace(/\$?\d+(?:[.,]\d{2})?/g, '')
      .replace(/hoy|ayer|anteayer/gi, '')
      .replace(/gast[eéo]/gi, '')
      .trim() || 'Gasto';
  }

  // Try to extract merchant name (capitalized words, brand names)
  const merchantMatch = text.match(/(?:en|de)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
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
      response: needsInfoResponses[Math.floor(Math.random() * needsInfoResponses.length)],
    };
  }

  // Get emoji for the category
  const categoryEmoji = suggestedCategory ? CATEGORY_CONFIG[suggestedCategory]?.emoji || (type === 'income' ? '💰' : '📦') : null;

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
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));

  if (!tx.length) {
    return false;
  }

  await transactionRepo.updateTransaction(db, transactionId, { categoryId });
  return true;
}
