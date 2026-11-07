import 'server-only';
import { getSupabaseServerConfig } from '@/lib/supabase-server';

export async function adminTable(table: 'support_tickets'|'support_ticket_events'|'client_relationship_notes'|'admin_workspace_settings', params: URLSearchParams, method: 'GET'|'POST'|'PATCH' = 'GET', body?: unknown, id?: string) {
  const config = getSupabaseServerConfig();
  if (!config) throw new Error('Supabase server configuration is missing.');
  const base = `${config.url}/rest/v1/${table}${id ? `?${table==='admin_workspace_settings'?'setting_id':'id'}=eq.${encodeURIComponent(id)}&` : '?'}${params.toString()}`;
  const response = await fetch(base, { method, cache:'no-store', signal:AbortSignal.timeout(10000), headers: {
    apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`,
    ...(method !== 'GET' ? {'Content-Type':'application/json',Prefer:'return=representation'} : {}),
  }, ...(method !== 'GET' ? {body:JSON.stringify(body)} : {}) });
  if (!response.ok) { console.error('Admin table request failed',table,method,response.status); throw new Error('The requested operation could not be completed. Check the staging migration and try again.'); }
  return (await response.json()) as Record<string,unknown>[];
}
