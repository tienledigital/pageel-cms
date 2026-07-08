import type { APIRoute } from 'astro';
import { COOKIE_NAME, verifyCsrfToken } from '../../../lib/session';
import { getWorkerUrl } from '../../../lib/auth-bridge';

// @para-doc [#csa-cms-sdk-logout-webhook]
// @para-doc [#csa-cms-app-int-logout]
export const POST: APIRoute = async ({ cookies, redirect, request, locals }) => {
  const sessionToken = cookies.get(COOKIE_NAME)?.value;
  const csrfCookie = cookies.get('pageel_cms_csrf')?.value;

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

  const isProd = import.meta.env.PROD;

  // Clear session cookie with identical flags (Secure, SameSite)
  cookies.set(COOKIE_NAME, '', {
    path: '/',
    expires: new Date(0),
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
  });

  // Clear CSRF cookie
  cookies.set('pageel_cms_csrf', '', {
    path: '/',
    expires: new Date(0),
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
  });

  // Redirect browser to SaaS Gateway GET logout URL to clear domain cookies
  const workerUrl = getWorkerUrl(env);
  const origin = new URL(request.url).origin;

  const response = redirect(`${workerUrl}/api/auth/logout?return_url=${encodeURIComponent(origin + '/login')}`);

  // Bulletproof fallback: manually append expired Set-Cookie headers for both Strict and Lax SameSite configurations
  const secureFlag = isProd ? '; Secure' : '';
  response.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly${secureFlag}; SameSite=Strict`);
  response.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly${secureFlag}; SameSite=Lax`);
  response.headers.append('Set-Cookie', `pageel_cms_csrf=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;${secureFlag}; SameSite=Strict`);
  response.headers.append('Set-Cookie', `pageel_cms_csrf=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;${secureFlag}; SameSite=Lax`);

  return response;
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
