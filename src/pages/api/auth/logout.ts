import type { APIRoute } from 'astro';
import { COOKIE_NAME } from '../../../lib/session';
import { getWorkerUrl } from '../../../lib/auth-bridge';

// @para-doc [#csa-sso-api-logout]
// @para-doc [#csa-sso-sandbox-transport]
export const POST: APIRoute = async ({ cookies, redirect, request, locals }) => {
  // 1. Delete local session cookie unconditionally first
  cookies.delete(COOKIE_NAME, { path: '/' });

  // 2. Redirect browser to SaaS Gateway GET logout URL to clear domain cookies
  const env = (locals as any)?.runtime?.env || {};
  const workerUrl = getWorkerUrl(env);
  const origin = new URL(request.url).origin;

  return redirect(`${workerUrl}/api/auth/logout?return_url=${encodeURIComponent(origin + '/login')}`);
};
