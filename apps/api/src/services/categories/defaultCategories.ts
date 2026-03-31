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
  // EXPENSES
  // ========================================
  {
    name: 'Home',
    emoji: '🏠',
    children: [
      { name: 'Rent/Mortgage', emoji: '🏡' },
      { name: 'Utilities (Water/Electric/Gas)', emoji: '💡' },
      { name: 'Internet/Cable', emoji: '📡' },
      { name: 'Phone', emoji: '📱' },
      { name: 'Maintenance', emoji: '🔧' },
      { name: 'Home Insurance', emoji: '🛡️' },
      { name: 'Furniture/Decor', emoji: '🛋️' },
      { name: 'Cleaning Supplies', emoji: '🧹' },
    ],
  },
  {
    name: 'Food',
    emoji: '🍽️',
    children: [
      { name: 'Groceries', emoji: '🛒' },
      { name: 'Restaurants', emoji: '🍴' },
      { name: 'Delivery/Takeout', emoji: '🛵' },
      { name: 'Coffee/Snacks', emoji: '☕' },
      { name: 'Fast Food', emoji: '🍔' },
      { name: 'Bakery/Pastries', emoji: '🥐' },
      { name: 'Drinks', emoji: '🥤' },
    ],
  },
  {
    name: 'Transportation',
    emoji: '🚗',
    children: [
      { name: 'Gas', emoji: '⛽' },
      { name: 'Public Transit', emoji: '🚌' },
      { name: 'Taxi/Rideshare', emoji: '🚕' },
      { name: 'Car Maintenance', emoji: '🔧' },
      { name: 'Car Insurance', emoji: '🛡️' },
      { name: 'Parking', emoji: '🅿️' },
      { name: 'Tolls', emoji: '🛣️' },
      { name: 'Car Payment', emoji: '💳' },
    ],
  },
  {
    name: 'Health',
    emoji: '🏥',
    children: [
      { name: 'Doctor Visits', emoji: '👨‍⚕️' },
      { name: 'Medications', emoji: '💊' },
      { name: 'Dentist', emoji: '🦷' },
      { name: 'Vision/Glasses', emoji: '👓' },
      { name: 'Health Insurance', emoji: '🏥' },
      { name: 'Therapy', emoji: '🧠' },
      { name: 'Lab Tests', emoji: '🔬' },
      { name: 'Vaccines', emoji: '💉' },
    ],
  },
  {
    name: 'Education',
    emoji: '📚',
    children: [
      { name: 'Tuition', emoji: '🎓' },
      { name: 'Courses/Training', emoji: '📖' },
      { name: 'Books', emoji: '📕' },
      { name: 'School Supplies', emoji: '✏️' },
      { name: 'Tutoring', emoji: '👩‍🏫' },
      { name: 'Languages', emoji: '🌐' },
      { name: 'Certifications', emoji: '📜' },
    ],
  },
  {
    name: 'Entertainment',
    emoji: '🎬',
    children: [
      { name: 'Streaming (Netflix, etc.)', emoji: '📺' },
      { name: 'Movies', emoji: '🎥' },
      { name: 'Concerts/Events', emoji: '🎤' },
      { name: 'Video Games', emoji: '🎮' },
      { name: 'Books/Magazines', emoji: '📰' },
      { name: 'Music (Spotify, etc.)', emoji: '🎵' },
      { name: 'Sports/Tickets', emoji: '🏟️' },
      { name: 'Theme Parks', emoji: '🎢' },
      { name: 'Bars/Nightlife', emoji: '🍻' },
    ],
  },
  {
    name: 'Shopping',
    emoji: '🛍️',
    children: [
      { name: 'Clothing', emoji: '👔' },
      { name: 'Shoes', emoji: '👟' },
      { name: 'Electronics', emoji: '💻' },
      { name: 'Accessories', emoji: '👜' },
      { name: 'Jewelry', emoji: '💍' },
      { name: 'Hobbies', emoji: '🎨' },
    ],
  },
  {
    name: 'Personal Care',
    emoji: '💇',
    children: [
      { name: 'Haircuts/Barber', emoji: '✂️' },
      { name: 'Spa/Massage', emoji: '💆' },
      { name: 'Cosmetics/Makeup', emoji: '💄' },
      { name: 'Gym/Fitness', emoji: '🏋️' },
      { name: 'Hygiene Products', emoji: '🧴' },
      { name: 'Nails', emoji: '💅' },
    ],
  },
  {
    name: 'Travel',
    emoji: '✈️',
    children: [
      { name: 'Flights', emoji: '🛫' },
      { name: 'Hotels/Lodging', emoji: '🏨' },
      { name: 'Travel Transport', emoji: '🚐' },
      { name: 'Travel Food', emoji: '🍱' },
      { name: 'Tours/Excursions', emoji: '🗺️' },
      { name: 'Souvenirs', emoji: '🎁' },
      { name: 'Travel Insurance', emoji: '🛡️' },
    ],
  },
  {
    name: 'Family',
    emoji: '👨‍👩‍👧‍👦',
    children: [
      { name: 'Kids - Education', emoji: '📚' },
      { name: 'Kids - Clothing', emoji: '👶' },
      { name: 'Kids - Toys', emoji: '🧸' },
      { name: 'Kids - Activities', emoji: '⚽' },
      { name: 'Elderly Care', emoji: '👴' },
      { name: 'Child Support', emoji: '💵' },
      { name: 'Daycare/Babysitter', emoji: '🏫' },
    ],
  },
  {
    name: 'Pets',
    emoji: '🐾',
    children: [
      { name: 'Pet Food', emoji: '🦴' },
      { name: 'Vet', emoji: '🩺' },
      { name: 'Pet Accessories', emoji: '🎾' },
      { name: 'Pet Grooming', emoji: '✂️' },
      { name: 'Pet Medications', emoji: '💊' },
    ],
  },
  {
    name: 'Finance',
    emoji: '💳',
    children: [
      { name: 'Credit Card Payment', emoji: '💳' },
      { name: 'Loan Payment', emoji: '🏦' },
      { name: 'Bank Fees', emoji: '🏛️' },
      { name: 'Interest', emoji: '📊' },
      { name: 'Fines/Late Fees', emoji: '⚠️' },
      { name: 'Transfers', emoji: '↔️' },
    ],
  },
  {
    name: 'Taxes',
    emoji: '📋',
    children: [
      { name: 'Income Tax', emoji: '📝' },
      { name: 'Property Tax', emoji: '🏠' },
      { name: 'Vehicle Tax', emoji: '🚗' },
      { name: 'Sales Tax/VAT', emoji: '🧾' },
      { name: 'Other Taxes', emoji: '📑' },
    ],
  },
  {
    name: 'Gifts & Donations',
    emoji: '🎁',
    children: [
      { name: 'Gifts for Others', emoji: '🎀' },
      { name: 'Charity/Donations', emoji: '❤️' },
      { name: 'Tips', emoji: '💵' },
      { name: 'Family Support', emoji: '👨‍👩‍👧' },
    ],
  },
  {
    name: 'Insurance',
    emoji: '🛡️',
    children: [
      { name: 'Life Insurance', emoji: '❤️' },
      { name: 'Health Insurance', emoji: '🏥' },
      { name: 'Auto Insurance', emoji: '🚗' },
      { name: 'Home Insurance', emoji: '🏠' },
      { name: 'Other Insurance', emoji: '📋' },
    ],
  },
  {
    name: 'Subscriptions',
    emoji: '📱',
    children: [
      { name: 'Apps/Software', emoji: '💻' },
      { name: 'Memberships', emoji: '🎫' },
      { name: 'Newspapers/Magazines', emoji: '📰' },
      { name: 'Cloud/Storage', emoji: '☁️' },
    ],
  },
  {
    name: 'Work/Business',
    emoji: '💼',
    children: [
      { name: 'Office Supplies', emoji: '📎' },
      { name: 'Work Equipment', emoji: '🖥️' },
      { name: 'Coworking', emoji: '🏢' },
      { name: 'Marketing/Advertising', emoji: '📢' },
      { name: 'Professional Services', emoji: '👔' },
      { name: 'Business Travel', emoji: '🧳' },
    ],
  },
  {
    name: 'Miscellaneous',
    emoji: '📦',
  },

  // ========================================
  // INCOME
  // ========================================
  {
    name: 'Salary',
    emoji: '💼',
  },
  {
    name: 'Freelance/Side Jobs',
    emoji: '💻',
  },
  {
    name: 'Own Business',
    emoji: '🏪',
  },
  {
    name: 'Investments',
    emoji: '📈',
    children: [
      { name: 'Dividends', emoji: '💰' },
      { name: 'Interest', emoji: '🏦' },
      { name: 'Capital Gains', emoji: '📊' },
      { name: 'Rental Income', emoji: '🏠' },
      { name: 'Crypto', emoji: '₿' },
    ],
  },
  {
    name: 'Sales',
    emoji: '🏷️',
  },
  {
    name: 'Refunds',
    emoji: '🔄',
  },
  {
    name: 'Gifts Received',
    emoji: '🎁',
  },
  {
    name: 'Bonus',
    emoji: '🎉',
  },
  {
    name: 'Pension/Retirement',
    emoji: '👴',
  },
  {
    name: 'Scholarships/Grants',
    emoji: '🎓',
  },
  {
    name: 'Lottery/Prizes',
    emoji: '🎰',
  },
  {
    name: 'Other Income',
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
