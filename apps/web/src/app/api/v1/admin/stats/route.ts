import { NextRequest, NextResponse } from 'next/server';
import { sql, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  users,
  transactions,
  accounts,
  debts,
  goals,
  sessions,
  uploadedFiles,
} from '@/lib/db/schema';
import { getAdminUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/stats - Get admin dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAdminUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();

    // Time boundaries
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // User stats
    const [totalUsers = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const [activeUsers = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.status} = 'active'`);

    const [suspendedUsers = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.status} = 'suspended'`);

    const [newUsersToday = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, oneDayAgo));

    const [newUsersWeek = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, sevenDaysAgo));

    const [newUsersMonth = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo));

    // Users by plan
    const [freeUsers = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.plan} = 'free'`);

    const [proUsers = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.plan} = 'pro'`);

    const [premiumUsers = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.plan} = 'premium'`);

    // Users by role
    const [adminUsers = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.role} = 'admin' OR ${users.role} = 'superadmin'`);

    // Transaction stats
    const [totalTransactions = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions);

    const [recentTransactions = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(gte(transactions.createdAt, sevenDaysAgo));

    // Account stats
    const [totalAccounts = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts);

    // Debt stats
    const [totalDebts = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(debts);

    const [activeDebts = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(debts)
      .where(sql`${debts.status} = 'active'`);

    // Goal stats
    const [totalGoals = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(goals);

    const [activeGoals = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(goals)
      .where(sql`${goals.status} = 'active'`);

    // Session stats
    const [activeSessions = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(sql`${sessions.isValid} = 1 AND ${sessions.expiresAt} > ${now}`);

    // File upload stats
    const [totalFiles = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(uploadedFiles);

    const [processedFiles = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(uploadedFiles)
      .where(sql`${uploadedFiles.status} = 'processed'`);

    return NextResponse.json({
      data: {
        users: {
          total: Number(totalUsers.count),
          active: Number(activeUsers.count),
          suspended: Number(suspendedUsers.count),
          newToday: Number(newUsersToday.count),
          newThisWeek: Number(newUsersWeek.count),
          newThisMonth: Number(newUsersMonth.count),
          byPlan: {
            free: Number(freeUsers.count),
            pro: Number(proUsers.count),
            premium: Number(premiumUsers.count),
          },
          admins: Number(adminUsers.count),
        },
        transactions: {
          total: Number(totalTransactions.count),
          recentWeek: Number(recentTransactions.count),
        },
        accounts: {
          total: Number(totalAccounts.count),
        },
        debts: {
          total: Number(totalDebts.count),
          active: Number(activeDebts.count),
        },
        goals: {
          total: Number(totalGoals.count),
          active: Number(activeGoals.count),
        },
        sessions: {
          active: Number(activeSessions.count),
        },
        files: {
          total: Number(totalFiles.count),
          processed: Number(processedFiles.count),
        },
      },
    });
  } catch (error) {
    console.error('Failed to get admin stats:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to get statistics', 500);
  }
}
