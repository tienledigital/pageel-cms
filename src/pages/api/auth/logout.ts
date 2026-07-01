/**
 * POST /api/auth/logout
 * Clear session cookie → resolve token → call SaaS remote logout API → redirect /login
 */

import type { APIRoute } from 'astro';
import { COOKIE_NAME, verifySession, resolveGitCredentials } from '../../../lib/session';
import { logoutAppSession } from '../../../lib/auth-bridge';

// @para-doc [#csa-cms-app-int-logout]
export const POST: APIRoute = async ({ cookies, redirect, locals }) => {
  // 1. Delete local session cookie unconditionally first
  const sessionToken = cookies.get(COOKIE_NAME)?.value;
  cookies.delete(COOKIE_NAME, { path: '/' });

  // 2. Resolve token and call SaaS remote logout API in try-catch
  if (sessionToken) {
    try {
      const session = await verifySession(sessionToken);
      if (session) {
        const credentials = resolveGitCredentials(session);
        if (credentials.token) {
          const env = (locals as any)?.runtime?.env || {};
          await logoutAppSession(credentials.token, env);
        }
      }
    } catch (err: any) {
      console.error('[logout] Remote logout failed:', err.message || err);
    }
  }

  return redirect('/login');
};
