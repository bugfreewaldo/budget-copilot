import { json } from '@/lib/api/utils';
import { getQuickActions } from '@/lib/copilot';

/**
 * GET /api/v1/copilot/quick-actions - Get quick action suggestions
 */
export async function GET() {
  const actions = getQuickActions();
  return json({ data: actions });
}
