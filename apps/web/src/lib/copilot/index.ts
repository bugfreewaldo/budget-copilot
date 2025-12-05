/**
 * Budget Copilot - AI-Powered Financial Agent
 *
 * A truly intelligent conversational agent powered by Claude that:
 * - UNDERSTANDS natural language (not just pattern matching)
 * - Has a sassy, friendly personality like a smart friend who's good with money
 * - Can register income/expenses, manage debts, give advice
 * - Makes decisions and takes actions autonomously
 */

import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  categories,
  transactions,
  accounts,
  debts,
  userProfiles,
  scheduledBills,
  // scheduledIncome - will be used for income scheduling feature
} from '../db/schema';

// ============================================================================
// TYPES
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
  intent?: string;
  debtCreated?: boolean;
  debtId?: string;
  followUpActions?: Array<{
    label: string;
    type: 'quick_reply' | 'action_button';
    value: string;
  }>;
}

// ============================================================================
// CLAUDE CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// SYSTEM PROMPT - The Copilot's Personality
// ============================================================================

const SYSTEM_PROMPT = `Eres un asistente financiero personal llamado "Budget Copilot". Tu personalidad es:
- Amigable y cercano, como un amigo inteligente que es bueno con el dinero
- Un poco sassy/picante - no tienes miedo de decir las cosas como son
- Motivador pero realista - celebras los logros pero también das feedback honesto
- Hablas en español mexicano casual (puedes usar expresiones como "va", "órale", "chido")
- Usas emojis con moderación para dar vida a tus respuestas

Tu trabajo es ayudar a los usuarios a:
1. Registrar gastos e ingresos de forma natural
2. Manejar sus deudas y crear planes de pago
3. Dar consejos financieros prácticos
4. Motivarlos a ahorrar y mejorar sus finanzas

IMPORTANTE:
- Siempre responde en español
- Sé conciso pero cálido
- Si el usuario te dice un gasto/ingreso, SIEMPRE usa la herramienta correspondiente para registrarlo
- Si no entiendes algo, pregunta de forma amigable
- Cuando registres algo, confirma los detalles de forma clara
- Da tips financieros ocasionalmente pero sin ser pesado

Puedes usar las herramientas disponibles para:
- Registrar transacciones (gastos e ingresos)
- Registrar deudas
- Actualizar el perfil del usuario (salario, etc)
- Programar pagos recurrentes
- Consultar el estado financiero del usuario`;

// ============================================================================
// TOOLS DEFINITIONS - What Claude can do
// ============================================================================

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_transaction',
    description:
      'Registra una transacción (gasto o ingreso). Usa esta herramienta cuando el usuario mencione que gastó dinero, compró algo, recibió un pago, le depositaron, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: {
          type: 'number',
          description: 'Monto en pesos (ej: 150.50)',
        },
        description: {
          type: 'string',
          description: 'Descripción de la transacción (ej: "Café en Starbucks")',
        },
        type: {
          type: 'string',
          enum: ['expense', 'income'],
          description: 'Tipo de transacción: expense (gasto) o income (ingreso)',
        },
        category: {
          type: 'string',
          description:
            'Categoría sugerida (ej: "Café", "Restaurantes", "Supermercado", "Salario")',
        },
        date: {
          type: 'string',
          description:
            'Fecha en formato YYYY-MM-DD. Si el usuario dice "ayer", calcula la fecha. Por defecto es hoy.',
        },
      },
      required: ['amount', 'description', 'type'],
    },
  },
  {
    name: 'create_debt',
    description:
      'Registra una deuda. Usa cuando el usuario mencione que debe dinero, tiene una tarjeta de crédito, préstamo, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Nombre de la deuda (ej: "Tarjeta BBVA", "Préstamo personal")',
        },
        amount: {
          type: 'number',
          description: 'Monto total de la deuda en pesos',
        },
        apr: {
          type: 'number',
          description: 'Tasa de interés anual (APR) en porcentaje (ej: 45 para 45%)',
        },
        type: {
          type: 'string',
          enum: [
            'credit_card',
            'personal_loan',
            'auto_loan',
            'mortgage',
            'student_loan',
            'medical',
            'other',
          ],
          description: 'Tipo de deuda',
        },
        minimum_payment: {
          type: 'number',
          description: 'Pago mínimo mensual (opcional)',
        },
      },
      required: ['name', 'amount', 'type'],
    },
  },
  {
    name: 'update_profile',
    description:
      'Actualiza el perfil financiero del usuario (salario, frecuencia de pago, etc). Usa cuando mencionen su sueldo o cómo les pagan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        monthly_salary: {
          type: 'number',
          description: 'Salario mensual en pesos. Si dicen quincena, multiplica por 2.',
        },
        pay_frequency: {
          type: 'string',
          enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
          description:
            'Frecuencia de pago: weekly (semanal), biweekly (cada 2 semanas), semimonthly (quincenal), monthly (mensual)',
        },
      },
      required: ['monthly_salary'],
    },
  },
  {
    name: 'get_financial_summary',
    description:
      'Obtiene un resumen financiero del usuario. Usa cuando pregunten cuánto han gastado, su balance, sus deudas, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        include_debts: {
          type: 'boolean',
          description: 'Incluir información de deudas',
        },
        include_recent_transactions: {
          type: 'boolean',
          description: 'Incluir transacciones recientes',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_scheduled_bill',
    description:
      'Programa un gasto recurrente/fijo (luz, agua, renta, Netflix, etc). Usa cuando mencionen pagos mensuales fijos.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Nombre del gasto (ej: "Luz", "Renta", "Netflix")',
        },
        amount: {
          type: 'number',
          description: 'Monto en pesos',
        },
        due_day: {
          type: 'number',
          description: 'Día del mes en que vence (1-31)',
        },
        type: {
          type: 'string',
          enum: [
            'mortgage',
            'rent',
            'auto_loan',
            'credit_card',
            'personal_loan',
            'student_loan',
            'utility',
            'insurance',
            'subscription',
            'other',
          ],
          description: 'Tipo de gasto fijo',
        },
      },
      required: ['name', 'amount', 'due_day', 'type'],
    },
  },
  {
    name: 'get_debt_strategy',
    description:
      'Genera un plan de pago de deudas. Usa cuando pregunten cómo pagar sus deudas, estrategias, método avalancha o bola de nieve.',
    input_schema: {
      type: 'object' as const,
      properties: {
        method: {
          type: 'string',
          enum: ['avalanche', 'snowball', 'both'],
          description:
            'Método: avalanche (mayor interés primero), snowball (menor balance primero), both (mostrar ambos)',
        },
      },
      required: [],
    },
  },
];

// ============================================================================
// TOOL EXECUTORS - What happens when Claude calls a tool
// ============================================================================

async function executeCreateTransaction(
  userId: string,
  params: {
    amount: number;
    description: string;
    type: 'expense' | 'income';
    category?: string;
    date?: string;
  }
): Promise<{ transactionId: string; categoryId: string | null; categoryName: string | null }> {
  const db = getDb();
  const amountCents = Math.round(params.amount * 100);

  // Get or create default account
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
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
    const [newAccount] = await db.select().from(accounts).where(eq(accounts.id, id));
    defaultAccount = newAccount!;
  }

  // Find or create category
  let categoryId: string | null = null;
  let categoryName: string | null = params.category || null;

  if (params.category) {
    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    const existing = userCategories.find(
      (c) => c.name.toLowerCase() === params.category!.toLowerCase()
    );

    if (existing) {
      categoryId = existing.id;
      categoryName = existing.name;
    } else {
      // Auto-create the category
      const newId = nanoid();
      const emoji = getCategoryEmoji(params.category);
      await db.insert(categories).values({
        id: newId,
        userId,
        name: params.category,
        emoji,
        createdAt: Date.now(),
      });
      categoryId = newId;
    }
  }

  // Create transaction
  const transactionId = nanoid();
  const now = Date.now();
  const date = params.date || new Date().toISOString().split('T')[0]!;

  await db.insert(transactions).values({
    id: transactionId,
    userId,
    date,
    description: params.description,
    amountCents: params.type === 'expense' ? -Math.abs(amountCents) : Math.abs(amountCents),
    type: params.type,
    categoryId,
    accountId: defaultAccount.id,
    cleared: false,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

  return { transactionId, categoryId, categoryName };
}

async function executeCreateDebt(
  userId: string,
  params: {
    name: string;
    amount: number;
    apr?: number;
    type: string;
    minimum_payment?: number;
  }
): Promise<{ debtId: string }> {
  const db = getDb();
  const amountCents = Math.round(params.amount * 100);

  // Calculate danger score
  let dangerScore = 0;
  if (params.apr) {
    if (params.apr >= 25) dangerScore += 40;
    else if (params.apr >= 18) dangerScore += 30;
    else if (params.apr >= 12) dangerScore += 20;
  }
  if (params.amount >= 50000) dangerScore += 40;
  else if (params.amount >= 20000) dangerScore += 30;
  else if (params.amount >= 10000) dangerScore += 20;

  const id = nanoid();
  const now = Date.now();

  await db.insert(debts).values({
    id,
    userId,
    name: params.name,
    type: params.type as any,
    originalBalanceCents: amountCents,
    currentBalanceCents: amountCents,
    aprPercent: params.apr ?? 0,
    minimumPaymentCents: params.minimum_payment ? Math.round(params.minimum_payment * 100) : null,
    status: 'active',
    dangerScore: Math.min(100, dangerScore),
    createdAt: now,
    updatedAt: now,
  });

  return { debtId: id };
}

async function executeUpdateProfile(
  userId: string,
  params: {
    monthly_salary: number;
    pay_frequency?: string;
  }
): Promise<{ success: boolean }> {
  const db = getDb();
  const now = Date.now();
  const salaryCents = Math.round(params.monthly_salary * 100);

  const [existing] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  if (existing) {
    await db
      .update(userProfiles)
      .set({
        monthlySalaryCents: salaryCents,
        payFrequency: (params.pay_frequency as any) ?? existing.payFrequency,
        updatedAt: now,
      })
      .where(eq(userProfiles.userId, userId));
  } else {
    await db.insert(userProfiles).values({
      id: nanoid(),
      userId,
      monthlySalaryCents: salaryCents,
      payFrequency: (params.pay_frequency as any) || 'monthly',
      onboardingCompleted: false,
      onboardingStep: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { success: true };
}

async function executeGetFinancialSummary(
  userId: string,
  params: {
    include_debts?: boolean;
    include_recent_transactions?: boolean;
  }
): Promise<{
  monthlyIncome: number;
  monthlyExpenses: number;
  balance: number;
  transactionCount: number;
  debts?: Array<{ name: string; balance: number; apr: number; type: string }>;
  recentTransactions?: Array<{ description: string; amount: number; type: string; date: string }>;
}> {
  const db = getDb();

  // Get this month's transactions
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]!;

  const monthTx = await db
    .select({
      amountCents: transactions.amountCents,
      type: transactions.type,
      description: transactions.description,
      date: transactions.date,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.date, startOfMonth)));

  const totalIncome = monthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const totalExpenses = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  const result: any = {
    monthlyIncome: totalIncome / 100,
    monthlyExpenses: totalExpenses / 100,
    balance: (totalIncome - totalExpenses) / 100,
    transactionCount: monthTx.length,
  };

  if (params.include_debts) {
    const userDebts = await db
      .select({
        name: debts.name,
        currentBalanceCents: debts.currentBalanceCents,
        aprPercent: debts.aprPercent,
        type: debts.type,
      })
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

    result.debts = userDebts.map((d) => ({
      name: d.name,
      balance: d.currentBalanceCents / 100,
      apr: d.aprPercent,
      type: d.type,
    }));
  }

  if (params.include_recent_transactions) {
    const recent = await db
      .select({
        description: transactions.description,
        amountCents: transactions.amountCents,
        type: transactions.type,
        date: transactions.date,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(5);

    result.recentTransactions = recent.map((t) => ({
      description: t.description,
      amount: Math.abs(t.amountCents) / 100,
      type: t.type,
      date: t.date,
    }));
  }

  return result;
}

async function executeCreateScheduledBill(
  userId: string,
  params: {
    name: string;
    amount: number;
    due_day: number;
    type: string;
  }
): Promise<{ billId: string }> {
  const db = getDb();
  const amountCents = Math.round(params.amount * 100);

  const id = nanoid();
  const now = Date.now();

  // Calculate next due date
  const today = new Date();
  let nextDueDate = new Date(today.getFullYear(), today.getMonth(), params.due_day);
  if (nextDueDate <= today) {
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }

  await db.insert(scheduledBills).values({
    id,
    userId,
    name: params.name,
    type: params.type as any,
    amountCents,
    dueDay: params.due_day,
    frequency: 'monthly',
    status: 'active',
    nextDueDate: nextDueDate.toISOString().split('T')[0],
    createdAt: now,
    updatedAt: now,
  });

  return { billId: id };
}

async function executeGetDebtStrategy(
  userId: string,
  _params: { method?: string }
): Promise<{
  totalDebt: number;
  debts: Array<{ name: string; balance: number; apr: number }>;
  avalancheOrder: string[];
  snowballOrder: string[];
  recommendation: string;
}> {
  const db = getDb();

  const userDebts = await db
    .select({
      name: debts.name,
      currentBalanceCents: debts.currentBalanceCents,
      aprPercent: debts.aprPercent,
    })
    .from(debts)
    .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

  if (userDebts.length === 0) {
    return {
      totalDebt: 0,
      debts: [],
      avalancheOrder: [],
      snowballOrder: [],
      recommendation: 'No tienes deudas registradas. ¡Eso está genial!',
    };
  }

  const debtsList = userDebts.map((d) => ({
    name: d.name,
    balance: d.currentBalanceCents / 100,
    apr: d.aprPercent,
  }));

  const totalDebt = debtsList.reduce((sum, d) => sum + d.balance, 0);

  // Avalanche: highest APR first
  const avalanche = [...debtsList].sort((a, b) => b.apr - a.apr);
  // Snowball: lowest balance first
  const snowball = [...debtsList].sort((a, b) => a.balance - b.balance);

  const hasHighInterest = debtsList.some((d) => d.apr >= 25);
  const recommendation = hasHighInterest
    ? 'Con deudas de alto interés, el método Avalancha te ahorrará más dinero a largo plazo.'
    : 'Ambos métodos son buenos. Bola de Nieve te dará victorias rápidas que te mantendrán motivado.';

  return {
    totalDebt,
    debts: debtsList,
    avalancheOrder: avalanche.map((d) => d.name),
    snowballOrder: snowball.map((d) => d.name),
    recommendation,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    café: '☕',
    coffee: '☕',
    restaurantes: '🍽️',
    restaurant: '🍽️',
    comida: '🍽️',
    food: '🍽️',
    supermercado: '🛒',
    super: '🛒',
    groceries: '🛒',
    uber: '🚕',
    didi: '🚕',
    taxi: '🚕',
    transporte: '🚗',
    gasolina: '⛽',
    gas: '⛽',
    luz: '💡',
    agua: '💧',
    internet: '🌐',
    celular: '📱',
    ropa: '👕',
    clothes: '👕',
    netflix: '📺',
    streaming: '📺',
    cine: '🎬',
    gym: '💪',
    gimnasio: '💪',
    doctor: '🏥',
    salud: '🏥',
    farmacia: '💊',
    renta: '🏠',
    rent: '🏠',
    salario: '💰',
    salary: '💰',
    freelance: '💻',
    bono: '🎯',
    regalo: '🎁',
    mascota: '🐾',
    pet: '🐾',
    educación: '📚',
    education: '📚',
    viaje: '✈️',
    travel: '✈️',
    hotel: '🏨',
    bar: '🍺',
    videojuegos: '🎮',
    gaming: '🎮',
  };

  const lower = category.toLowerCase();
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lower.includes(key)) return emoji;
  }
  return '📦';
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export async function processMessage(
  userId: string,
  userMessage: string
): Promise<CopilotResponse> {
  try {
    // Build context about the user's financial situation
    const summary = await executeGetFinancialSummary(userId, {
      include_debts: true,
      include_recent_transactions: true,
    });

    const contextMessage = `
CONTEXTO DEL USUARIO (info interna, no la menciones directamente a menos que pregunten):
- Ingresos este mes: $${summary.monthlyIncome.toLocaleString('es-MX')}
- Gastos este mes: $${summary.monthlyExpenses.toLocaleString('es-MX')}
- Balance: $${summary.balance.toLocaleString('es-MX')}
- Transacciones: ${summary.transactionCount}
${summary.debts && summary.debts.length > 0 ? `- Deudas activas: ${summary.debts.map((d) => `${d.name} ($${d.balance})`).join(', ')}` : '- Sin deudas registradas'}
- Fecha de hoy: ${new Date().toISOString().split('T')[0]}
`;

    // Call Claude with tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + '\n\n' + contextMessage,
      tools: TOOLS,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Process the response
    let finalMessage = '';
    let transactionCreated = false;
    let transactionId: string | undefined;
    let debtCreated = false;
    let debtId: string | undefined;
    let transaction: ExtractedTransaction | undefined;

    // Handle tool calls
    for (const content of response.content) {
      if (content.type === 'text') {
        finalMessage = content.text;
      } else if (content.type === 'tool_use') {
        const toolName = content.name;
        const toolInput = content.input as any;

        let toolResult: any;

        switch (toolName) {
          case 'create_transaction':
            const txResult = await executeCreateTransaction(userId, toolInput);
            transactionCreated = true;
            transactionId = txResult.transactionId;
            transaction = {
              amountCents: Math.round(toolInput.amount * 100),
              description: toolInput.description,
              merchant: null,
              date: toolInput.date || new Date().toISOString().split('T')[0]!,
              categoryId: txResult.categoryId,
              categoryName: txResult.categoryName,
              type: toolInput.type,
              notes: null,
            };
            toolResult = { success: true, transactionId: txResult.transactionId };
            break;

          case 'create_debt':
            const debtResult = await executeCreateDebt(userId, toolInput);
            debtCreated = true;
            debtId = debtResult.debtId;
            toolResult = { success: true, debtId: debtResult.debtId };
            break;

          case 'update_profile':
            await executeUpdateProfile(userId, toolInput);
            toolResult = { success: true };
            break;

          case 'get_financial_summary':
            toolResult = await executeGetFinancialSummary(userId, toolInput);
            break;

          case 'create_scheduled_bill':
            const billResult = await executeCreateScheduledBill(userId, toolInput);
            toolResult = { success: true, billId: billResult.billId };
            break;

          case 'get_debt_strategy':
            toolResult = await executeGetDebtStrategy(userId, toolInput);
            break;

          default:
            toolResult = { error: 'Unknown tool' };
        }

        // Get Claude's response after tool use
        const followUp = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: response.content },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: content.id,
                  content: JSON.stringify(toolResult),
                },
              ],
            },
          ],
        });

        // Extract final text response
        for (const followUpContent of followUp.content) {
          if (followUpContent.type === 'text') {
            finalMessage = followUpContent.text;
          }
        }
      }
    }

    // Build follow-up actions based on context
    const followUpActions: CopilotResponse['followUpActions'] = [];

    if (transactionCreated) {
      followUpActions.push(
        { label: 'Otro gasto', type: 'quick_reply', value: 'Gasté $' },
        { label: 'Ver resumen', type: 'quick_reply', value: '¿Cuánto llevo gastado?' }
      );
    } else if (debtCreated) {
      followUpActions.push(
        { label: 'Ver deudas', type: 'quick_reply', value: '¿Cuánto debo?' },
        { label: 'Plan de pago', type: 'quick_reply', value: '¿Cómo pago mis deudas?' }
      );
    } else {
      followUpActions.push(
        { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $50 en' },
        { label: 'Ver resumen', type: 'quick_reply', value: '¿Cuánto he gastado?' }
      );
    }

    return {
      message: finalMessage || 'Hmm, no estoy seguro de qué hacer con eso. ¿Puedes darme más detalles?',
      transactionCreated,
      transactionId,
      transaction,
      debtCreated,
      debtId,
      followUpActions,
    };
  } catch (error) {
    console.error('Copilot error:', error);

    // Fallback response
    return {
      message:
        '¡Ups! Algo salió mal. 😅 Intenta de nuevo o dime qué necesitas de otra forma.',
      followUpActions: [
        { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
        { label: 'Ayuda', type: 'quick_reply', value: '¿Qué puedes hacer?' },
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
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));

  if (!tx) return false;

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
    { text: 'Ingreso', example: 'Me pagaron mi quincena de $2400' },
    { text: 'Configurar salario', example: 'Gano $15,000 al mes' },
    { text: 'Registrar deuda', example: 'Tengo una tarjeta con $5000 al 45%' },
    { text: 'Plan de pago', example: '¿Cómo pago mis deudas?' },
    { text: 'Ver resumen', example: '¿Cuánto he gastado este mes?' },
    { text: 'Tips', example: '¿Qué es la regla 50/30/20?' },
  ];
}

export function clearConversationHistory(_userId: string): void {
  // No-op - stateless
}
