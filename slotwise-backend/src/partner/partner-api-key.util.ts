import { createHash, randomBytes } from 'crypto';

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function generateApiKeyMaterial() {
  const secret = randomBytes(24).toString('base64url');
  const raw = `sk_${secret}`;
  return {
    raw,
    prefix: raw.slice(0, 12),
    hash: hashApiKey(raw),
  };
}

export function extractApiKeyFromRequest(
  authorization?: string,
  xApiKey?: string,
): string | null {
  if (xApiKey?.trim()) return xApiKey.trim();
  if (!authorization?.trim()) return null;
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  return bearer ? bearer[1].trim() : authorization.trim();
}
