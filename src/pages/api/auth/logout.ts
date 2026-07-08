import type { APIRoute } from 'astro';
import { COOKIE_NAME, verifyCsrfToken } from '../../../lib/session';
import { getWorkerUrl } from '../../../lib/auth-bridge';

// @para-doc [#csa-cms-sdk-logout-webhook]
// @para-doc [#csa-cms-app-int-logout]
export const POST: APIRoute = async ({ cookies, redirect, request, locals }) => {
  const sessionToken = cookies.get(COOKIE_NAME)?.value;
  const csrfCookie = cookies.get('pageel_csrf_token')?.value;

  if (!sessionToken || !csrfCookie) {
    return new Response(JSON.stringify({ error: 'Forbidden: Missing credentials' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionId = sessionToken.split('.')[1] || '';
  const csrfHeader = request.headers.get('x-csrf-token') || '';
  
  let csrfBody = '';
  try {
    const formData = await request.clone().formData();
    csrfBody = formData.get('csrf_token')?.toString() || '';
  } catch {}

  const submittedCsrf = decodeURIComponent(csrfHeader || csrfBody);
  const decodedCsrfCookie = decodeURIComponent(csrfCookie || '');
  const env = (locals as any)?.runtime?.env || {};
  const csrfSecret = env.CMS_SECRET || import.meta.env.CMS_SECRET || 'fallback-secret-key-16-chars';

  const isValidCsrf = (await verifyCsrfToken(submittedCsrf, sessionId, csrfSecret)) && (submittedCsrf === decodedCsrfCookie);

  if (!isValidCsrf) {
    return new Response(JSON.stringify({ error: 'Forbidden: Invalid CSRF token' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete both local session cookie and CSRF cookie
  cookies.delete(COOKIE_NAME, { path: '/' });
  cookies.delete('pageel_csrf_token', { path: '/' });

  // Redirect browser to SaaS Gateway GET logout URL to clear domain cookies
  const workerUrl = getWorkerUrl(env);
  const origin = new URL(request.url).origin;

  return redirect(`${workerUrl}/api/auth/logout?return_url=${encodeURIComponent(origin + '/login')}`);
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      'Allow': 'POST',
    },
  });
};
