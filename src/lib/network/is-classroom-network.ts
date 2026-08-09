import { NextRequest } from 'next/server';
import { getClientIp, normalizeIp } from './get-client-ip';

export interface NetworkVerificationResult {
  isAllowed: boolean;
  clientIp: string;
  allowedIps: string[];
}

export function isClassroomNetwork(req: NextRequest | Request): NetworkVerificationResult {
  const clientIp = getClientIp(req);
  const rawAllowedIps = process.env.CLASSROOM_ALLOWED_IPS || '127.0.0.1,::1';
  
  const allowedIps = rawAllowedIps
    .split(',')
    .map((ip) => normalizeIp(ip.trim()))
    .filter(Boolean);

  // If wildcards or dev allowance is specified, or client IP matches any allowed IP
  const isAllowed = allowedIps.includes('*') || allowedIps.includes(clientIp);

  return {
    isAllowed,
    clientIp,
    allowedIps,
  };
}
