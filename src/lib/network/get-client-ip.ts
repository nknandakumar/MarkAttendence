import { NextRequest } from 'next/server';

export function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return '';
  let cleaned = ip.trim();
  // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:192.168.1.1 or ::ffff:103.20.30.40)
  if (cleaned.startsWith('::ffff:')) {
    cleaned = cleaned.substring(7);
  }
  // If multiple IPs are present (e.g. 103.20.30.40, 10.0.0.1)
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim();
  }
  // Convert localhost IPv6 to standard IPv4 for clean comparison
  if (cleaned === '::1') {
    cleaned = '127.0.0.1';
  }
  return cleaned;
}

export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const rawIp = xForwardedFor.split(',')[0];
    const normalized = normalizeIp(rawIp);
    if (normalized) return normalized;
  }

  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) {
    const normalized = normalizeIp(xRealIp);
    if (normalized) return normalized;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    const normalized = normalizeIp(cfConnectingIp);
    if (normalized) return normalized;
  }

  const xClientIp = headers.get('x-client-ip');
  if (xClientIp) {
    const normalized = normalizeIp(xClientIp);
    if (normalized) return normalized;
  }

  return '127.0.0.1';
}
