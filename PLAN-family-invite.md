# Plan: Family Invite Feature

## Current State Analysis

After exploring the codebase, I found:

1. **Auth system exists** (`apps/web/src/lib/auth/index.ts`) with:
   - User registration/login
   - Session-based authentication
   - Password hashing with bcrypt
   - HTTP-only cookies

2. **But it's NOT wired up** - All 47+ API routes use hardcoded `userId`:
   ```typescript
   // Every API route has this pattern:
   const userId = 'test-user-00000000000000000001';
   ```

3. **No household/family concept** exists in the database

---

## Implementation Options

### Option A: Full Multi-User Implementation (Recommended)
- Wire up existing auth system across all routes
- Add `households` and `household_members` tables
- Implement email/link-based invite flow
- Family members have full access to shared data
- **Scope: Large** - Requires refactoring all API routes

### Option B: Simple Share Link (Read-Only)
- Generate a unique shareable link for dashboard
- Viewers can see data but not modify
- No login required for viewers
- **Scope: Small** - Less invasive

### Option C: Household Code System
- Users enter a "household code" on first visit
- All users with same code share data
- No email invites, just share the code
- **Scope: Medium**

---

## Recommended Implementation: Option A (Full)

### Phase 1: Wire Up Authentication

1. **Create auth middleware** (`apps/web/src/middleware.ts`):
   - Validate session cookie on protected routes
   - Inject user context into request headers
   - Redirect unauthenticated users to login

2. **Create auth helper for API routes**:
   ```typescript
   // apps/web/src/lib/auth/getUser.ts
   export async function getUserFromRequest(request: NextRequest): Promise<User | null>
   ```

3. **Update all API routes** (47+ files) to use session-based auth:
   - Replace hardcoded `userId` with `user.id` from session
   - Return 401 if not authenticated

4. **Create login/register pages**:
   - `/login` - Login form
   - `/register` - Registration form
   - Update Providers to include auth context

### Phase 2: Household System

1. **Database changes** - Add to `schema.ts`:
   ```typescript
   // Households table
   export const households = sqliteTable('households', {
     id: text('id').primaryKey(),
     name: text('name').notNull(),
     inviteCode: text('invite_code').unique(), // For sharing
     createdById: text('created_by_id').references(() => users.id),
     createdAt: integer('created_at'),
   });

   // Household members (join table)
   export const householdMembers = sqliteTable('household_members', {
     id: text('id').primaryKey(),
     householdId: text('household_id').references(() => households.id),
     userId: text('user_id').references(() => users.id),
     role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }),
     invitedAt: integer('invited_at'),
     acceptedAt: integer('accepted_at'),
   });

   // Household invites
   export const householdInvites = sqliteTable('household_invites', {
     id: text('id').primaryKey(),
     householdId: text('household_id').references(() => households.id),
     email: text('email'),
     token: text('token').unique(),
     role: text('role', { enum: ['admin', 'member', 'viewer'] }),
     expiresAt: integer('expires_at'),
     createdAt: integer('created_at'),
   });
   ```

2. **Add `householdId` to financial tables**:
   - Update all tables (accounts, transactions, etc.) to have optional `householdId`
   - Default to user's primary household
   - Query by `householdId` instead of `userId` for shared data

3. **Migration strategy**:
   - Create new tables
   - Auto-create household for existing users
   - Add themselves as owner
   - Update all their data with householdId

### Phase 3: Invite Flow

1. **API endpoints**:
   - `POST /api/v1/households` - Create household
   - `GET /api/v1/households/current` - Get current household
   - `POST /api/v1/households/invite` - Generate invite (email or link)
   - `GET /api/v1/households/invite/:token` - Get invite details
   - `POST /api/v1/households/invite/:token/accept` - Accept invite
   - `GET /api/v1/households/members` - List members
   - `DELETE /api/v1/households/members/:id` - Remove member

2. **UI Components**:
   - Family settings page (`/settings/family`)
   - Invite modal with email input or shareable link
   - Member list with role management
   - Accept invite page (`/invite/:token`)

3. **Sidebar update**:
   - Add "Familia" section with invite button
   - Show household name and member avatars

---

## Files to Create/Modify

### New Files:
- `apps/web/src/middleware.ts` - Auth middleware
- `apps/web/src/lib/auth/getUser.ts` - Request user helper
- `apps/web/src/app/login/page.tsx` - Login page
- `apps/web/src/app/register/page.tsx` - Register page
- `apps/web/src/app/settings/family/page.tsx` - Family settings
- `apps/web/src/app/invite/[token]/page.tsx` - Accept invite
- `apps/web/src/components/family/InviteModal.tsx`
- `apps/web/src/components/family/MemberList.tsx`
- `apps/web/src/lib/api/households.ts` - API client functions
- Household API routes (6 new route files)
- Database migration for new tables

### Modified Files:
- `apps/web/src/lib/db/schema.ts` - Add household tables
- `apps/web/src/components/layout/Sidebar.tsx` - Add family section
- `apps/web/src/components/providers.tsx` - Add auth provider
- All 47+ API route files - Replace hardcoded userId

---

## Questions for You

Before proceeding, please confirm:

1. **Which option do you prefer?** (A, B, or C)

2. **For Option A**: Should invites be:
   - Email-based (send email with link)
   - Link-based (copy shareable link)
   - Code-based (share a 6-digit code)
   - All of the above?

3. **Roles**: What permissions should family members have?
   - Owner: Full control (delete household, remove members)
   - Admin: Add/remove members, full financial access
   - Member: Full financial access (add/edit/delete data)
   - Viewer: Read-only access

4. **Scope priority**: Should I implement in phases or all at once?

---

## Estimated Effort

- **Phase 1 (Auth)**: Update 47+ files, create login/register pages
- **Phase 2 (Households)**: Database changes, migration, update queries
- **Phase 3 (Invites)**: New API routes, UI components, invite flow

This is a significant change. Please review and let me know which direction to take!
