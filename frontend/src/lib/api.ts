const API_BASE = 'http://localhost:8000/api/v1';

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/dashboard/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
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
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (status) params.append('status', status);
  if (reviewStatus) params.append('review_status', reviewStatus);
  
  const res = await fetch(`${API_BASE}/events/list?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch events list');
  return res.json();
}

export async function reviewEvent(eventId: string, reviewStatus: string) {
  const res = await fetch(`${API_BASE}/events/${eventId}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_status: reviewStatus }),
  });
  if (!res.ok) throw new Error('Failed to review event');
  return res.json();
}
