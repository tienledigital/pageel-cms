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
 * Verify JWT token from SaaS app
 */
// @para-doc [#csa-cms-app-int-binding]
// @para-doc [#csa-cms-app-int-test-mode]
export async function verifyAppToken(token: string, env: any): Promise<BridgeVerificationResponse> {
  const appUrl = env.PAGEEL_APP_URL || (typeof process !== 'undefined' ? process.env.PAGEEL_APP_URL : '') || 'https://cms.pageel.app';
  const binding = env.PAGEEL_APP_BINDING;

  // Endpoint to call
  const url = `${appUrl}/api/verify-bridge`;

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
 */
export async function logoutAppSession(token: string, env: any): Promise<boolean> {
  const appUrl = env.PAGEEL_APP_URL || (typeof process !== 'undefined' ? process.env.PAGEEL_APP_URL : '') || 'https://cms.pageel.app';
  const binding = env.PAGEEL_APP_BINDING;

  // Endpoint to call
  const url = `${appUrl}/api/auth/logout`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }, binding);

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Generate absolute redirect URL to Pageel App login page
 */
// @para-doc [#csa-cms-app-int-opt-in]
// @para-doc [#csa-cms-app-int-button]
export function getSsoRedirectUrl(appUrl: string, origin: string): string {
  const cleanAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
  return `${cleanAppUrl}/login?redirect_uri=${origin}/api/auth/callback`;
}
