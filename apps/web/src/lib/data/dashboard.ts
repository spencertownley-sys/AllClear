import 'server-only';
import type { DashboardSummaryRow, WatchLocation } from '@allclear/shared';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { listLocations } from './locations';

export interface DashboardCard {
  location: WatchLocation;
  summary: DashboardSummaryRow | null;
  /** True when the summary query failed for this card (card-level error state). */
  error: boolean;
}

/** Two queries total regardless of how many Watch Locations the user has (Launch Checklist: no N+1). */
export async function getDashboard(supabase: ServerSupabaseClient): Promise<DashboardCard[]> {
  const locations = await listLocations(supabase);
  if (locations.length === 0) return [];
  const { data, error } = await supabase.rpc('dashboard_summary');
  if (error) console.error('[dashboard] summary failed', error.message);
  const byId = new Map<string, DashboardSummaryRow>();
  for (const row of (data ?? []) as DashboardSummaryRow[]) byId.set(row.location_id, row);
  return locations.map((location) => ({
    location,
    summary: byId.get(location.id) ?? null,
    error: Boolean(error),
  }));
}
