import { initializeDatabase, flushSave } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import * as accountRepo from '../server/lib/repo/accounts.js';
import * as categoryRepo from '../server/lib/repo/categories.js';
import * as envelopeRepo from '../server/lib/repo/envelopes.js';
import * as transactionRepo from '../server/lib/repo/transactions.js';
import { register, AuthError } from '../services/auth/index.js';

/**
 * Seed script for Budget Copilot
 * Creates sample data: test user, account, categories, envelopes, and transactions
 */

// Test user credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';
const TEST_NAME = 'Usuario de Prueba';

async function seed() {
  console.log('🌱 Seeding database...');

  const db = await initializeDatabase();
  await runMigrations();

  // Get current month (YYYY-MM)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get current date (YYYY-MM-DD)
  const _currentDate = now.toISOString().split('T')[0];

  try {
    // 0. Create test user
    console.log('Creating test user...');
    let userId: string;
    try {
      const result = await register({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      });
      userId = result.user.id;
      console.log(`✅ Created user: ${TEST_EMAIL} (${userId})`);
    } catch (error) {
      if (error instanceof AuthError && error.code === 'EMAIL_EXISTS') {
        console.log(`ℹ️  User ${TEST_EMAIL} already exists, skipping...`);
        // Get existing user ID - for now just use a placeholder
        // In real scenario we'd query the DB
        throw new Error('User already exists. Delete database and re-run seed.');
      }
      throw error;
    }

    // 1. Create checking account
    console.log('Creating account...');
    const account = await accountRepo.createAccount(db, {
      userId,
      name: 'My Checking',
      institution: 'Demo Bank',
      type: 'checking',
    });
    console.log(`✅ Created account: ${account?.name} (${account?.id})`);

    // 2. Create parent categories (Gastos e Ingresos)
    console.log('Creating categories...');

    const gastosParent = await categoryRepo.createCategory(db, {
      userId: userId,
      name: 'Gastos',
      emoji: '💸',
    });
    console.log(`✅ Created parent category: Gastos`);

    const ingresosParent = await categoryRepo.createCategory(db, {
      userId: userId,
      name: 'Ingresos',
      emoji: '💵',
    });
    console.log(`✅ Created parent category: Ingresos`);

    // Subcategorías de Gastos
    const expenseCategories = [
      // Esenciales
      { name: 'Supermercado', emoji: '🛒' },
      { name: 'Servicios', emoji: '💡' },
      { name: 'Alquiler/Vivienda', emoji: '🏠' },
      { name: 'Transporte', emoji: '🚗' },
      { name: 'Salud', emoji: '🏥' },
      { name: 'Seguros', emoji: '🛡️' },
      // Estilo de vida
      { name: 'Compras', emoji: '🛍️' },
      { name: 'Entretenimiento', emoji: '🎬' },
      { name: 'Restaurantes', emoji: '🍽️' },
      { name: 'Café', emoji: '☕' },
      // Personal
      { name: 'Cuidado Personal', emoji: '💇' },
      { name: 'Educación', emoji: '📚' },
      { name: 'Gimnasio', emoji: '🏋️' },
      { name: 'Suscripciones', emoji: '📱' },
      // Finanzas
      { name: 'Ahorros', emoji: '💰' },
      { name: 'Inversiones', emoji: '📈' },
      { name: 'Pagos de Deuda', emoji: '💳' },
      // Otros
      { name: 'Regalos', emoji: '🎁' },
      { name: 'Viajes', emoji: '✈️' },
      { name: 'Mascotas', emoji: '🐾' },
      { name: 'Otros Gastos', emoji: '📦' },
    ];

    // Subcategorías de Ingresos
    const incomeCategories = [
      { name: 'Salario', emoji: '💼' },
      { name: 'Freelance', emoji: '💻' },
      { name: 'Inversiones', emoji: '📈' },
      { name: 'Ventas', emoji: '🏷️' },
      { name: 'Reembolsos', emoji: '🔄' },
      { name: 'Regalos Recibidos', emoji: '🎁' },
      { name: 'Otros Ingresos', emoji: '📦' },
    ];

    const createdCategories: Record<string, Awaited<ReturnType<typeof categoryRepo.createCategory>>> = {};

    // Create expense subcategories
    for (const cat of expenseCategories) {
      const category = await categoryRepo.createCategory(db, {
        userId: userId,
        name: cat.name,
        emoji: cat.emoji,
        parentId: gastosParent!.id,
      });
      if (category) {
        createdCategories[cat.name] = category;
      }
    }

    // Create income subcategories
    for (const cat of incomeCategories) {
      const category = await categoryRepo.createCategory(db, {
        userId: userId,
        name: cat.name,
        emoji: cat.emoji,
        parentId: ingresosParent!.id,
      });
      if (category) {
        createdCategories[cat.name] = category;
      }
    }

    const groceries = createdCategories['Supermercado'];
    const utilities = createdCategories['Servicios'];
    const entertainment = createdCategories['Entretenimiento'];
    const salaryCategory = createdCategories['Salario'];

    const totalCategories = 2 + expenseCategories.length + incomeCategories.length;
    console.log(`✅ Created ${totalCategories} categories (2 parents + ${expenseCategories.length} expense + ${incomeCategories.length} income)`);

    // 3. Create envelopes for current month
    console.log(`Creating envelopes for ${currentMonth}...`);

    const envelopeData = [
      { cat: groceries, budget: 40000 },     // $400 - Supermercado
      { cat: utilities, budget: 25000 },     // $250 - Servicios
      { cat: entertainment, budget: 10000 }, // $100 - Entretenimiento
      { cat: createdCategories['Transporte'], budget: 15000 },    // $150
      { cat: createdCategories['Restaurantes'], budget: 20000 },  // $200
      { cat: createdCategories['Café'], budget: 5000 },           // $50
      { cat: createdCategories['Compras'], budget: 15000 },       // $150
      { cat: createdCategories['Gimnasio'], budget: 6000 },       // $60
      { cat: createdCategories['Suscripciones'], budget: 5000 },  // $50
      { cat: createdCategories['Alquiler/Vivienda'], budget: 100000 }, // $1000
    ];

    for (const env of envelopeData) {
      await envelopeRepo.upsertEnvelope(db, {
        userId: userId,
        categoryId: env.cat!.id,
        month: currentMonth,
        budgetCents: env.budget,
      });
    }
    console.log(`✅ Created ${envelopeData.length} envelopes for ${currentMonth}`);

    // 4. Create sample transactions with realistic mock data
    console.log('Creating transactions...');

    const transport = createdCategories['Transporte'];
    const restaurants = createdCategories['Restaurantes'];
    const coffee = createdCategories['Café'];
    const shopping = createdCategories['Compras'];
    const gym = createdCategories['Gimnasio'];
    const subscriptions = createdCategories['Suscripciones'];
    const health = createdCategories['Salud'];
    const housing = createdCategories['Alquiler/Vivienda'];
    const freelance = createdCategories['Freelance'];

    // All transactions for the month
    const transactions = [
      // Income
      { date: `${currentMonth}-01`, desc: 'Depósito de Salario', amount: 350000, type: 'income' as const, cat: salaryCategory },
      { date: `${currentMonth}-15`, desc: 'Pago Freelance - Diseño Web', amount: 75000, type: 'income' as const, cat: freelance },

      // Housing
      { date: `${currentMonth}-01`, desc: 'Alquiler del Apartamento', amount: -95000, type: 'expense' as const, cat: housing },

      // Groceries (weekly)
      { date: `${currentMonth}-02`, desc: 'Supermercado Rey', amount: -8745, type: 'expense' as const, cat: groceries },
      { date: `${currentMonth}-09`, desc: 'Super 99 - Compras Semanales', amount: -6532, type: 'expense' as const, cat: groceries },
      { date: `${currentMonth}-16`, desc: 'Riba Smith - Víveres', amount: -9821, type: 'expense' as const, cat: groceries },
      { date: `${currentMonth}-23`, desc: 'Supermercado Rey', amount: -7456, type: 'expense' as const, cat: groceries },

      // Utilities
      { date: `${currentMonth}-05`, desc: 'Recibo de Luz - ENSA', amount: -12500, type: 'expense' as const, cat: utilities },
      { date: `${currentMonth}-08`, desc: 'Factura de Agua - IDAAN', amount: -4500, type: 'expense' as const, cat: utilities },
      { date: `${currentMonth}-10`, desc: 'Internet - Cable & Wireless', amount: -6999, type: 'expense' as const, cat: utilities },

      // Transport
      { date: `${currentMonth}-03`, desc: 'Gasolina - Terpel', amount: -4500, type: 'expense' as const, cat: transport },
      { date: `${currentMonth}-10`, desc: 'Uber - Trabajo', amount: -850, type: 'expense' as const, cat: transport },
      { date: `${currentMonth}-17`, desc: 'Gasolina - Shell', amount: -5200, type: 'expense' as const, cat: transport },
      { date: `${currentMonth}-24`, desc: 'Estacionamiento Mall', amount: -300, type: 'expense' as const, cat: transport },

      // Entertainment
      { date: `${currentMonth}-01`, desc: 'Netflix', amount: -1599, type: 'expense' as const, cat: entertainment },
      { date: `${currentMonth}-01`, desc: 'Spotify Premium', amount: -999, type: 'expense' as const, cat: subscriptions },
      { date: `${currentMonth}-12`, desc: 'Cine - Cinépolis', amount: -2400, type: 'expense' as const, cat: entertainment },
      { date: `${currentMonth}-20`, desc: 'Disney+', amount: -899, type: 'expense' as const, cat: subscriptions },

      // Restaurants
      { date: `${currentMonth}-04`, desc: 'McDonald\'s', amount: -1250, type: 'expense' as const, cat: restaurants },
      { date: `${currentMonth}-07`, desc: 'Almuerzo - Niko\'s Café', amount: -1800, type: 'expense' as const, cat: restaurants },
      { date: `${currentMonth}-14`, desc: 'Cena - Restaurante Beirut', amount: -4500, type: 'expense' as const, cat: restaurants },
      { date: `${currentMonth}-21`, desc: 'Pizza Hut', amount: -2100, type: 'expense' as const, cat: restaurants },
      { date: `${currentMonth}-28`, desc: 'Sushi - Matsuei', amount: -3500, type: 'expense' as const, cat: restaurants },

      // Coffee
      { date: `${currentMonth}-02`, desc: 'Starbucks', amount: -650, type: 'expense' as const, cat: coffee },
      { date: `${currentMonth}-06`, desc: 'Kotowa Coffee', amount: -450, type: 'expense' as const, cat: coffee },
      { date: `${currentMonth}-11`, desc: 'Café Unido', amount: -550, type: 'expense' as const, cat: coffee },
      { date: `${currentMonth}-18`, desc: 'Starbucks', amount: -750, type: 'expense' as const, cat: coffee },
      { date: `${currentMonth}-25`, desc: 'Bajareque Coffee', amount: -500, type: 'expense' as const, cat: coffee },

      // Shopping
      { date: `${currentMonth}-06`, desc: 'Amazon - Accesorios', amount: -4599, type: 'expense' as const, cat: shopping },
      { date: `${currentMonth}-19`, desc: 'Zara - Ropa', amount: -8999, type: 'expense' as const, cat: shopping },

      // Health & Gym
      { date: `${currentMonth}-01`, desc: 'Gimnasio PowerClub', amount: -5500, type: 'expense' as const, cat: gym },
      { date: `${currentMonth}-15`, desc: 'Farmacia Arrocha', amount: -2350, type: 'expense' as const, cat: health },
    ];

    let txCount = 0;
    for (const tx of transactions) {
      await transactionRepo.createTransaction(db, {
        userId: userId,
        date: tx.date,
        description: tx.desc,
        amountCents: tx.amount,
        type: tx.type,
        categoryId: tx.cat!.id,
        accountId: account!.id,
        cleared: true,
      });
      txCount++;
    }

    console.log(`✅ Created ${txCount} transactions`);

    // Flush database to disk
    await flushSave();

    console.log('\n✨ Seed completed successfully!');
    console.log('\nSummary:');
    console.log(`  - 1 user (${TEST_EMAIL})`);
    console.log(`  - 1 account (${account?.name})`);
    console.log(`  - ${totalCategories} categories (2 parents: Gastos/Ingresos + subcategorías)`);
    console.log(`  - ${envelopeData.length} envelopes for ${currentMonth}`);
    console.log(`  - ${txCount} transactions (2 income, ${txCount - 2} expenses)`);
    console.log('\n📧 Login credentials:');
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Password: ${TEST_PASSWORD}`);
    console.log('\nRun `pnpm --filter api dev` to start the server!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// Run if called directly (handles Windows paths)
const isDirectRun = import.meta.url.includes('seed.ts') ||
                    import.meta.url === `file://${process.argv[1]}` ||
                    import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`;

if (isDirectRun) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { seed };
