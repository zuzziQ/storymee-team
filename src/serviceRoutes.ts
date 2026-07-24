import { CoreApiClient } from '@storymee/api-client';

const gateway = (process.env.CORE_API_URL || 'http://127.0.0.1:5100').replace(/\/+$/, '');
const serviceKey = process.env.STORYMEE_SERVICE_API_KEY || process.env.HUB_API_KEY || '';
const serviceHeaders = serviceKey
  ? { Authorization: `Bearer ${serviceKey}` }
  : {};

/** Machine-to-machine surface. Never use the consumer /api/v1 prefix here. */
export const TEAM_SERVICE_BASE_URL = `${gateway}/internal/v1/team`;
export const TEAM_AI_SERVICE_URL = `${gateway}/internal/v1/ai/team/chat`;

export function createTeamServiceClient() {
  return new CoreApiClient({
    baseURL: TEAM_SERVICE_BASE_URL,
    enforceApiPrefix: false,
    headers: serviceHeaders,
  });
}

export function serviceAuthHeaders(extra: Record<string, string> = {}) {
  return { ...serviceHeaders, ...extra };
}
