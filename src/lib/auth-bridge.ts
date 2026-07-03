import type { BridgeVerificationResponse } from '../types/auth';

/**
 * Helper to call fetch with a 5-second timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, binding?: any): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000);

  try {
    const fetchFn = binding && typeof binding.fetch === 'function' ? binding.fetch.bind(binding) : globalThis.fetch;
    const response = await fetchFn(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Resolve Worker URL adhering to OSS standards:
 * - Use explicit config if available
 * - Throw error in Production if missing
 * - Fallback to localhost in Development
 */
export function getWorkerUrl(env: any): string {
  const configured = env.PAGEEL_WORKER_URL || (typeof process !== 'undefined' ? process.env.PAGEEL_WORKER_URL : '') || env.PAGEEL_APP_URL;
  if (configured) return configured;
  
  // Try to determine if we are in production.
  // Astro uses import.meta.env, but we also check process.env for robust fallback.
  const isProd = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) || 
                 (typeof process !== 'undefined' && process.env.NODE_ENV === 'production');
                 
  if (isProd) {
    throw new Error('PAGEEL_WORKER_URL environment variable is required in production for SSO authentication.');
  }
  
  return 'http://localhost:8787';
}

/**
 * Verify JWT token from SaaS app
 */
// @para-doc [#csa-cms-app-int-binding]
// @para-doc [#csa-cms-app-int-test-mode]
export async function verifyAppToken(token: string, env: any): Promise<BridgeVerificationResponse> {
  const workerUrl = getWorkerUrl(env);
  const binding = env.PAGEEL_APP_BINDING;

  // Endpoint to call
  const url = `${workerUrl}/api/auth/verify-bridge`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }, binding);

  if (!response.ok) {
    throw new Error(`Verification failed with status: ${response.status}`);
  }

  return response.json();
}

/**
 * Logout session from SaaS app
 * @deprecated Use GET browser redirect-based logout instead.
 */
export async function logoutAppSession(token: string, env: any): Promise<boolean> {
  return true;
}

/**
 * Generate absolute redirect URL to Pageel App login page
 */
// @para-doc [#csa-cms-app-int-opt-in]
// @para-doc [#csa-cms-app-int-button]
export function getSsoRedirectUrl(appUrl: string, origin: string): string {
  const cleanAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
  return `${cleanAppUrl}/api/auth/bridge?return_url=${encodeURIComponent(origin + '/api/auth/callback')}`;
}
