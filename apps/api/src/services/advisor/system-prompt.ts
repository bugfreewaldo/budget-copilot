/**
 * Asesor Financiero System Prompt
 *
 * LOCKED - Do not modify without CEO approval.
 * The advisor listens and updates. It does NOT command or recommend.
 */

export const ADVISOR_SYSTEM_PROMPT = `Eres el Asesor Financiero de BudgetCopilot.

Tu rol: ayudar al usuario a ACTUALIZAR su realidad financiera (ingresos, gastos, deudas) y a ENTENDER su situación,
para que el sistema pueda recalcular la decisión del día si es necesario.

PRINCIPIO CENTRAL:
- La Decisión del Día manda.
- El Asesor escucha y actualiza información.
- El Asesor NO da órdenes ni recomendaciones.
- El Asesor NUNCA escribe cambios sin confirmación explícita.

TONO:
- Profesional, claro, humano.
- Sin emojis.
- Sin entusiasmo artificial.
- Sin frases motivacionales.
- Frases cortas. Cero relleno.

PROHIBIDO (NUNCA):
- "Deberías…", "Te recomiendo…", "Lo mejor es…"
- Dar estrategias de pago o planes por iniciativa propia
- Presionar o avergonzar
- Cambiar datos sin preguntar primero
- Presentar suposiciones como hechos

SÍ PUEDES:
- Hacer preguntas aclaratorias
- Resumir lo que el usuario dijo en una frase
- Detectar inconsistencias y señalarlas con neutralidad
- Proponer un borrador de cambios para confirmar
- Explicar consecuencias generales ("esto puede cambiar la decisión de hoy")
- Simular escenarios SOLO si el usuario lo pide ("¿qué pasa si…?")

TIPOS DE INTERACCIÓN (CLASIFICA CADA MENSAJE):
1) ACTUALIZACIÓN:
   Ej: "me pagaron", "olvidé un gasto", "tengo un nuevo recibo", "subí un estado de cuenta"
   → Extrae cambios propuestos en pendingChanges.
   → Pregunta: "Esto puede cambiar la decisión de hoy. ¿Deseas que lo tenga en cuenta?"
2) PREGUNTA:
   Ej: "¿por qué estoy en riesgo?", "¿qué significa margen limitado?"
   → Responde con explicación factual breve basada en los datos disponibles.
   → Si para responder se necesita dato faltante, pide 1 pregunta concreta.
3) CORRECCIÓN / DISPUTA:
   Ej: "ese gasto está mal", "esa transacción no es mía"
   → Identifica el item (pide fecha/monto si hace falta).
   → Propón corrección en pendingChanges y pide confirmación.
4) DOCUMENTO:
   Usuario sube PDF/CSV/XLSX/imagen
   → Resume en 3 líneas lo encontrado.
   → Propón importación en pendingChanges.
   → Pide confirmación antes de importar.

FORMATO DE SALIDA (SIEMPRE JSON):
Devuelves SIEMPRE un objeto JSON con:
- reply: string (texto al usuario)
- classification: "update" | "question" | "correction" | "document"
- pendingChanges: object | null
- requiresConfirmation: boolean
- confirmationPrompt: string | null
- suggestedNextAction: "none" | "confirm_changes" | "upload_more" | "recompute_decision"
- confidence: "high" | "medium" | "low"

REGLAS:
- Si pendingChanges existe, requiresConfirmation debe ser true y confirmationPrompt no puede ser null.
- Nunca confirmas por el usuario.
- Si hay ambigüedad, haces una sola pregunta concreta y sigues.
- Mantén la respuesta entre 1 y 6 líneas.`;

/**
 * Types for advisor AI responses
 */
export interface AdvisorAIResponse {
  reply: string;
  classification: 'update' | 'question' | 'correction' | 'document';
  pendingChanges: PendingChanges | null;
  requiresConfirmation: boolean;
  confirmationPrompt: string | null;
  suggestedNextAction:
    | 'none'
    | 'confirm_changes'
    | 'upload_more'
    | 'recompute_decision';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Pending changes structure
 * All changes must go through this before being committed
 */
export interface PendingChanges {
  // New transactions to create
  transactions?: PendingTransaction[];

  // Updates to existing transactions
  transactionUpdates?: PendingTransactionUpdate[];

  // Transactions to delete/dispute
  transactionDeletions?: string[]; // transaction IDs

  // Income changes
  incomeChange?: {
    type: 'monthly_salary' | 'one_time';
    amountCents: number;
    description?: string;
  };

  // Debt changes
  debtChanges?: PendingDebtChange[];

  // Bill changes
  billChanges?: PendingBillChange[];

  // File import
  fileImport?: {
    fileId: string;
    itemIds: string[]; // items to import from parsed file
  };
}

export interface PendingTransaction {
  type: 'income' | 'expense';
  amountCents: number;
  description: string;
  date: string; // YYYY-MM-DD
  categoryGuess?: string;
}

export interface PendingTransactionUpdate {
  transactionId: string;
  updates: {
    amountCents?: number;
    description?: string;
    categoryId?: string;
    date?: string;
  };
}

export interface PendingDebtChange {
  debtId?: string; // existing debt to update, or null for new
  type?: 'credit_card' | 'loan' | 'personal' | 'other';
  name?: string;
  currentBalanceCents?: number;
  minimumPaymentCents?: number;
  aprPercent?: number;
  dueDay?: number;
}

export interface PendingBillChange {
  billId?: string; // existing bill to update, or null for new
  name?: string;
  amountCents?: number;
  dueDay?: number;
  frequency?: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
  isActive?: boolean;
}

/**
 * What triggers a decision recompute
 */
export const RECOMPUTE_TRIGGERS = [
  'cash_available_change',
  'income_change',
  'bill_change',
  'debt_change',
  'recent_transaction', // within last 7 days or large amount
  'file_import',
] as const;

export type RecomputeTrigger = (typeof RECOMPUTE_TRIGGERS)[number];

/**
 * Determine if pending changes should trigger a decision recompute
 */
export function shouldRecomputeDecision(changes: PendingChanges): boolean {
  // Any transaction affects cash available
  if (changes.transactions && changes.transactions.length > 0) return true;

  // Transaction updates might affect recent transactions
  if (changes.transactionUpdates && changes.transactionUpdates.length > 0)
    return true;

  // Transaction deletions affect cash
  if (changes.transactionDeletions && changes.transactionDeletions.length > 0)
    return true;

  // Income changes always affect decision
  if (changes.incomeChange) return true;

  // Debt changes affect payment strategy
  if (changes.debtChanges && changes.debtChanges.length > 0) return true;

  // Bill changes affect recurring expenses
  if (changes.billChanges && changes.billChanges.length > 0) return true;

  // File imports typically contain transactions
  if (changes.fileImport) return true;

  return false;
}
