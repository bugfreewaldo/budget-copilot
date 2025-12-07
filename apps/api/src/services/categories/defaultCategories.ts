import { getDb } from '../../db/client.js';
import * as categoryRepo from '../../server/lib/repo/categories.js';

/**
 * Default categories for new users
 * Comprehensive list covering all common expense/income types
 */

interface CategoryDefinition {
  name: string;
  emoji: string;
  children?: CategoryDefinition[];
}

// Complete category tree for expenses and income
const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  // ========================================
  // GASTOS (Expenses)
  // ========================================
  {
    name: 'Hogar',
    emoji: '🏠',
    children: [
      { name: 'Alquiler/Hipoteca', emoji: '🏡' },
      { name: 'Servicios (Agua/Luz/Gas)', emoji: '💡' },
      { name: 'Internet/Cable', emoji: '📡' },
      { name: 'Teléfono', emoji: '📱' },
      { name: 'Mantenimiento', emoji: '🔧' },
      { name: 'Seguro del Hogar', emoji: '🛡️' },
      { name: 'Muebles/Decoración', emoji: '🛋️' },
      { name: 'Artículos de Limpieza', emoji: '🧹' },
    ],
  },
  {
    name: 'Alimentación',
    emoji: '🍽️',
    children: [
      { name: 'Supermercado', emoji: '🛒' },
      { name: 'Restaurantes', emoji: '🍴' },
      { name: 'Delivery/Comida a Domicilio', emoji: '🛵' },
      { name: 'Café/Snacks', emoji: '☕' },
      { name: 'Comida Rápida', emoji: '🍔' },
      { name: 'Panadería/Pastelería', emoji: '🥐' },
      { name: 'Bebidas', emoji: '🥤' },
    ],
  },
  {
    name: 'Transporte',
    emoji: '🚗',
    children: [
      { name: 'Gasolina', emoji: '⛽' },
      { name: 'Transporte Público', emoji: '🚌' },
      { name: 'Taxi/Uber', emoji: '🚕' },
      { name: 'Mantenimiento del Auto', emoji: '🔧' },
      { name: 'Seguro del Auto', emoji: '🛡️' },
      { name: 'Estacionamiento', emoji: '🅿️' },
      { name: 'Peajes', emoji: '🛣️' },
      { name: 'Préstamo del Auto', emoji: '💳' },
    ],
  },
  {
    name: 'Salud',
    emoji: '🏥',
    children: [
      { name: 'Médico/Consultas', emoji: '👨‍⚕️' },
      { name: 'Medicamentos', emoji: '💊' },
      { name: 'Dentista', emoji: '🦷' },
      { name: 'Óptica/Lentes', emoji: '👓' },
      { name: 'Seguro Médico', emoji: '🏥' },
      { name: 'Psicólogo/Terapia', emoji: '🧠' },
      { name: 'Laboratorios/Estudios', emoji: '🔬' },
      { name: 'Vacunas', emoji: '💉' },
    ],
  },
  {
    name: 'Educación',
    emoji: '📚',
    children: [
      { name: 'Colegiatura/Universidad', emoji: '🎓' },
      { name: 'Cursos/Capacitaciones', emoji: '📖' },
      { name: 'Libros', emoji: '📕' },
      { name: 'Material Escolar', emoji: '✏️' },
      { name: 'Clases Particulares', emoji: '👩‍🏫' },
      { name: 'Idiomas', emoji: '🌐' },
      { name: 'Certificaciones', emoji: '📜' },
    ],
  },
  {
    name: 'Entretenimiento',
    emoji: '🎬',
    children: [
      { name: 'Streaming (Netflix, etc.)', emoji: '📺' },
      { name: 'Cine', emoji: '🎥' },
      { name: 'Conciertos/Eventos', emoji: '🎤' },
      { name: 'Videojuegos', emoji: '🎮' },
      { name: 'Libros/Revistas', emoji: '📰' },
      { name: 'Música (Spotify, etc.)', emoji: '🎵' },
      { name: 'Deportes/Entradas', emoji: '🏟️' },
      { name: 'Parques/Atracciones', emoji: '🎢' },
      { name: 'Bares/Discotecas', emoji: '🍻' },
    ],
  },
  {
    name: 'Compras',
    emoji: '🛍️',
    children: [
      { name: 'Ropa', emoji: '👔' },
      { name: 'Zapatos', emoji: '👟' },
      { name: 'Electrónica', emoji: '💻' },
      { name: 'Accesorios', emoji: '👜' },
      { name: 'Joyería', emoji: '💍' },
      { name: 'Hobbies', emoji: '🎨' },
    ],
  },
  {
    name: 'Cuidado Personal',
    emoji: '💇',
    children: [
      { name: 'Peluquería/Barbería', emoji: '✂️' },
      { name: 'Spa/Masajes', emoji: '💆' },
      { name: 'Cosméticos/Maquillaje', emoji: '💄' },
      { name: 'Gimnasio/Fitness', emoji: '🏋️' },
      { name: 'Productos de Higiene', emoji: '🧴' },
      { name: 'Manicure/Pedicure', emoji: '💅' },
    ],
  },
  {
    name: 'Viajes',
    emoji: '✈️',
    children: [
      { name: 'Vuelos', emoji: '🛫' },
      { name: 'Hoteles/Alojamiento', emoji: '🏨' },
      { name: 'Transporte en Viaje', emoji: '🚐' },
      { name: 'Comida en Viaje', emoji: '🍱' },
      { name: 'Tours/Excursiones', emoji: '🗺️' },
      { name: 'Souvenirs', emoji: '🎁' },
      { name: 'Seguro de Viaje', emoji: '🛡️' },
    ],
  },
  {
    name: 'Familia',
    emoji: '👨‍👩‍👧‍👦',
    children: [
      { name: 'Hijos - Educación', emoji: '📚' },
      { name: 'Hijos - Ropa', emoji: '👶' },
      { name: 'Hijos - Juguetes', emoji: '🧸' },
      { name: 'Hijos - Actividades', emoji: '⚽' },
      { name: 'Cuidado de Mayores', emoji: '👴' },
      { name: 'Pensión Alimenticia', emoji: '💵' },
      { name: 'Guardería/Niñera', emoji: '🏫' },
    ],
  },
  {
    name: 'Mascotas',
    emoji: '🐾',
    children: [
      { name: 'Comida para Mascotas', emoji: '🦴' },
      { name: 'Veterinario', emoji: '🩺' },
      { name: 'Accesorios Mascotas', emoji: '🎾' },
      { name: 'Peluquería de Mascotas', emoji: '✂️' },
      { name: 'Medicamentos Mascotas', emoji: '💊' },
    ],
  },
  {
    name: 'Finanzas',
    emoji: '💳',
    children: [
      { name: 'Pago de Tarjeta de Crédito', emoji: '💳' },
      { name: 'Pago de Préstamos', emoji: '🏦' },
      { name: 'Comisiones Bancarias', emoji: '🏛️' },
      { name: 'Intereses', emoji: '📊' },
      { name: 'Multas/Recargos', emoji: '⚠️' },
      { name: 'Transferencias', emoji: '↔️' },
    ],
  },
  {
    name: 'Impuestos',
    emoji: '📋',
    children: [
      { name: 'Impuesto sobre la Renta', emoji: '📝' },
      { name: 'Impuesto Predial', emoji: '🏠' },
      { name: 'Impuesto Vehicular', emoji: '🚗' },
      { name: 'IVA/IGV', emoji: '🧾' },
      { name: 'Otros Impuestos', emoji: '📑' },
    ],
  },
  {
    name: 'Regalos y Donaciones',
    emoji: '🎁',
    children: [
      { name: 'Regalos para Otros', emoji: '🎀' },
      { name: 'Donaciones/Caridad', emoji: '❤️' },
      { name: 'Propinas', emoji: '💵' },
      { name: 'Ayuda a Familiares', emoji: '👨‍👩‍👧' },
    ],
  },
  {
    name: 'Seguros',
    emoji: '🛡️',
    children: [
      { name: 'Seguro de Vida', emoji: '❤️' },
      { name: 'Seguro Médico', emoji: '🏥' },
      { name: 'Seguro de Auto', emoji: '🚗' },
      { name: 'Seguro del Hogar', emoji: '🏠' },
      { name: 'Otros Seguros', emoji: '📋' },
    ],
  },
  {
    name: 'Suscripciones',
    emoji: '📱',
    children: [
      { name: 'Apps/Software', emoji: '💻' },
      { name: 'Membresías', emoji: '🎫' },
      { name: 'Periódicos/Revistas', emoji: '📰' },
      { name: 'Cloud/Almacenamiento', emoji: '☁️' },
    ],
  },
  {
    name: 'Trabajo/Negocio',
    emoji: '💼',
    children: [
      { name: 'Material de Oficina', emoji: '📎' },
      { name: 'Equipo de Trabajo', emoji: '🖥️' },
      { name: 'Coworking', emoji: '🏢' },
      { name: 'Marketing/Publicidad', emoji: '📢' },
      { name: 'Servicios Profesionales', emoji: '👔' },
      { name: 'Viajes de Trabajo', emoji: '🧳' },
    ],
  },
  {
    name: 'Otros Gastos',
    emoji: '📦',
  },

  // ========================================
  // INGRESOS (Income)
  // ========================================
  {
    name: 'Salario/Sueldo',
    emoji: '💼',
  },
  {
    name: 'Freelance/Trabajos Extra',
    emoji: '💻',
  },
  {
    name: 'Negocio Propio',
    emoji: '🏪',
  },
  {
    name: 'Inversiones',
    emoji: '📈',
    children: [
      { name: 'Dividendos', emoji: '💰' },
      { name: 'Intereses', emoji: '🏦' },
      { name: 'Ganancias de Capital', emoji: '📊' },
      { name: 'Rentas/Alquileres', emoji: '🏠' },
      { name: 'Criptomonedas', emoji: '₿' },
    ],
  },
  {
    name: 'Ventas',
    emoji: '🏷️',
  },
  {
    name: 'Reembolsos',
    emoji: '🔄',
  },
  {
    name: 'Regalos Recibidos',
    emoji: '🎁',
  },
  {
    name: 'Bonos/Aguinaldo',
    emoji: '🎉',
  },
  {
    name: 'Pensión/Jubilación',
    emoji: '👴',
  },
  {
    name: 'Becas/Ayudas',
    emoji: '🎓',
  },
  {
    name: 'Lotería/Premios',
    emoji: '🎰',
  },
  {
    name: 'Otros Ingresos',
    emoji: '📥',
  },
];

/**
 * Create default categories for a new user
 * Called automatically when a user registers
 * @param force - If true, adds missing categories even if user already has some
 */
export async function seedDefaultCategoriesForUser(
  userId: string,
  force = false
): Promise<void> {
  const db = await getDb();

  // Get existing categories for this user
  const existingCategories = await categoryRepo.findAllCategories(db, {
    userId,
  });

  // If not forcing and user has categories, skip
  if (!force && existingCategories.length > 0) {
    console.log(`ℹ️  User ${userId} already has categories, skipping seed`);
    return;
  }

  // Build a set of existing category names (lowercase for comparison)
  const existingNames = new Set(
    existingCategories.map((c) => c.name.toLowerCase())
  );

  console.log(`🌱 Creating default categories for user ${userId}...`);
  console.log(`   (${existingCategories.length} existing categories found)`);

  let count = 0;
  let skipped = 0;

  for (const cat of DEFAULT_CATEGORIES) {
    // Check if parent category already exists
    if (existingNames.has(cat.name.toLowerCase())) {
      skipped++;
      // Still check children
      if (cat.children) {
        const existingParent = existingCategories.find(
          (c) => c.name.toLowerCase() === cat.name.toLowerCase()
        );
        if (existingParent) {
          for (const child of cat.children) {
            if (!existingNames.has(child.name.toLowerCase())) {
              await categoryRepo.createCategory(db, {
                userId,
                name: child.name,
                emoji: child.emoji,
                parentId: existingParent.id,
              });
              count++;
            } else {
              skipped++;
            }
          }
        }
      }
      continue;
    }

    // Create parent category
    const parent = await categoryRepo.createCategory(db, {
      userId,
      name: cat.name,
      emoji: cat.emoji,
    });
    count++;

    // Create children if any
    if (cat.children && parent) {
      for (const child of cat.children) {
        if (!existingNames.has(child.name.toLowerCase())) {
          await categoryRepo.createCategory(db, {
            userId,
            name: child.name,
            emoji: child.emoji,
            parentId: parent.id,
          });
          count++;
        } else {
          skipped++;
        }
      }
    }
  }

  console.log(
    `✅ Created ${count} new categories for user ${userId} (${skipped} already existed)`
  );
}

export { DEFAULT_CATEGORIES };
