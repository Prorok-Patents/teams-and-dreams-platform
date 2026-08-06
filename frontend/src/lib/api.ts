import { supabase } from './supabase';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';

export async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend API unavailable for stats, querying Supabase directly:', e);
  }

  // Fallback to direct Supabase queries
  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });

  const { count: activeScrapers } = await supabase
    .from('scraper_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'running');

  const { count: failedRuns } = await supabase
    .from('scraper_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  return {
    active_scrapers: activeScrapers || 0,
    total_events: totalEvents || 0,
    heal_rate: 0,
    failed_runs: failedRuns || 0,
    total_cost_usd: 0.0,
  };
}

export async function fetchProfiles() {
  const res = await fetch(`${API_BASE}/scraper/profiles`);
  if (!res.ok) throw new Error('Failed to fetch profiles');
  return res.json();
}

export async function fetchProfileDetail(siteId: string) {
  const res = await fetch(`${API_BASE}/scraper/profiles/${siteId}`);
  if (!res.ok) throw new Error('Failed to fetch profile detail');
  return res.json();
}

export async function updateProfile(siteId: string, data: any) {
  const res = await fetch(`${API_BASE}/scraper/profiles/${siteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

export async function runScraper(siteId: string) {
  const res = await fetch(`${API_BASE}/scraper/run/${siteId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to run scraper');
  return res.json();
}

export async function fetchEventsList(page: number, limit: number, status?: string, reviewStatus?: string) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('events')
    .select('*, venues(name)', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (reviewStatus) query = query.eq('review_status', reviewStatus);

  query = query.order('start_date', { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  const events = (data || []).map((e: any) => ({
    ...e,
    sport: e.sport_name_raw,
    venue_name: e.venues?.name || e.venue_name || 'N/A',
  }));

  return {
    events,
    total: count || 0,
    page,
    pages: Math.ceil((count || 0) / limit),
  };
}

export async function reviewEvent(eventId: string, reviewStatus: string) {
  const { data, error } = await supabase
    .from('events')
    .update({ review_status: reviewStatus })
    .eq('id', eventId)
    .select();

  if (error) throw error;
  return { status: 'success', review_status: reviewStatus, data };
}
