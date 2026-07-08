/**
 * Auth helpers — bcryptjs password verification + rate limiting
 */

// --- Rate Limiting (in-memory, best-effort) ---

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

/**
 * Check rate limit for an IP. Returns true if allowed.
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Get bcrypt hash from environment.
 *
 * Priority:
 * 1. import.meta.env — works on Vercel/Railway/Docker (no dotenv-expand issue)
 * 2. process.env — works when set via shell export
 * 3. Raw .env file read — local dev fallback (bypasses dotenv-expand $ corruption)
 */
async function getPassHash(): Promise<string> {
  // Platform env (Vercel, Railway, Docker) — not corrupted by dotenv-expand
  const metaHash = import.meta.env.CMS_PASS_HASH;
  if (metaHash && isValidHash(metaHash)) return metaHash;

  // Shell export
  const procHash = process.env.CMS_PASS_HASH;
  if (procHash && isValidHash(procHash)) return procHash;

  // Local dev fallback — read raw .env file (bypasses dotenv-expand $ corruption)
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const envPath = path.resolve(process.cwd(), '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const regex = /^CMS_PASS_HASH=["']?(.+?)["']?\s*$/m;
    const match = content.match(regex);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

/**
 * Validate password hash: supports bcrypt and PBKDF2 Web Crypto formats
 */
function isValidHash(hash: string): boolean {
  return hash.startsWith('pbkdf2:') && hash.split(':').length === 4;
}

/**
 * Verify username + password against env vars
 */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const envUser = import.meta.env.CMS_USER || '';
  const envHash = await getPassHash();

  if (!envUser || !envHash) {
    console.error('[auth] CMS_USER or CMS_PASS_HASH not set');
    return false;
  }

  if (username !== envUser) {
    // Constant-time comparison: always run PBKDF2 to prevent timing attacks
    await verifyPBKDF2(password, 'pbkdf2:100000:73616c7473616c7473616c7473616c74:e7c7a8264ef81ec01c7bb7418a0e5b7b9195b058a9e9a4f4dcf19c4b7264a938');
    return false;
  }

  if (envHash.startsWith('pbkdf2:')) {
    return verifyPBKDF2(password, envHash);
  }
  return false;
}

// @para-doc [#csa-cms-sec-pbkdf2]
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// @para-doc [#csa-cms-local-auth-pbkdf2]
export async function hashPBKDF2(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256 // 32 bytes (256 bits)
  );
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

export async function verifyPBKDF2(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const parts = hashedPassword.split(':');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const hashHex = parts[3];
    
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      baseKey,
      256
    );
    
    const computedHashHex = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return timingSafeEqual(hashHex, computedHashHex);
  } catch {
    return false;
  }
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 300_000);

// @para-doc [#csa-cms-sdk-rbac-mapping]
export type UserRole = 'admin' | 'editor' | 'viewer';

const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  admin: new Set(['read', 'write', 'delete', 'config']),
  editor: new Set(['read', 'write']),
  viewer: new Set(['read']),
};

export function hasPermission(role: string | undefined, action: string): boolean {
  const userRole = (role || 'admin') as UserRole;
  const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.viewer;
  return permissions.has(action);
}
