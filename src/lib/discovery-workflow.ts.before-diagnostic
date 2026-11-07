import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseServerConfig } from '@/lib/supabase-server';

export type DiscoveryWorkflowRow = Record<string, unknown>;

const actionMessages:Record<string,string>={
  active_research_session:'Complete the current research session before sending another clarification request.',
  discovery_not_available:'This Discovery request is archived or already converted to a project.',
  discovery_questions_unresolved:'Answer or close every open question before marking the request ready for scope.',
  discovery_session_incomplete:'Complete every selected research session before marking the request ready for scope.',
  discovery_services_not_reviewed:'Review every client-confirmed service and mark it suitable before continuing.',
  client_service_choice_required:'The client must confirm which service or services they want to discuss.',
  create_a_followup_invitation_instead:'Prepare a new follow-up invitation instead of reopening a question on a completed response.',
  discovery_question_not_open:'Only an unanswered question can be closed.',
  discovery_question_not_closed:'This question is not closed.',
  session_not_ready_for_confirmation:'Save a valid future session plan before requesting confirmation.',
  session_confirmation_unavailable:'This session is not awaiting client confirmation.',
  session_must_be_confirmed:'The client must confirm the session before findings can be completed.',
  clarification_link_unavailable:'This private clarification link is invalid, expired, or already used.',
  method_not_offered:'Choose one of the discussion methods offered by RapidlyOn.',
  question_not_available:'One of the selected questions is no longer available.',
};

export class DiscoveryWorkflowActionError extends Error {
  readonly status=409;
}

export function hashDiscoveryWorkflowToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function discoveryWorkflowHeaders(config: SupabaseServerConfig, json = false) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export async function readDiscoveryWorkflowRows(
  config: SupabaseServerConfig,
  table: string,
  params: URLSearchParams,
) {
  const response = await fetch(`${config.url}/rest/v1/${table}?${params}`, {
    headers: discoveryWorkflowHeaders(config),
    cache: 'no-store',
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Workflow ${table} lookup failed (${response.status}).`);
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error(`Workflow ${table} response was invalid.`);
  return value.filter((row): row is DiscoveryWorkflowRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
}

export async function callDiscoveryWorkflowRpc<T = unknown>(
  config: SupabaseServerConfig,
  functionName: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: discoveryWorkflowHeaders(config, true),
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) {
    const payload:unknown=await response.json().catch(()=>({}));
    const data=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
    const databaseMessage=typeof data.message==='string'?data.message:'';
    const known=Object.entries(actionMessages).find(([key])=>databaseMessage.includes(key));
    if(known)throw new DiscoveryWorkflowActionError(known[1]);
    console.error(`Discovery workflow RPC ${functionName} failed with status ${response.status}.`);
    throw new Error(`Workflow action failed (${response.status}).`);
  }
  return await response.json() as T;
}