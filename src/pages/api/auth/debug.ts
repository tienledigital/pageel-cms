import type { APIRoute } from 'astro';
import { verifySession, COOKIE_NAME } from '../../../lib/session';

export const GET: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(COOKIE_NAME)?.value;
  const secret = import.meta.env.CMS_SECRET || '';
  
  let session = null;
  let error = null;
  
  if (token) {
    try {
      session = await verifySession(token);
    } catch (e: any) {
      error = e.message || e;
    }
  }

  return new Response(JSON.stringify({
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 10) + '...' : null,
    secretLength: secret.length,
    secretValid: secret.length >= 16,
    session,
    error,
    headers: Object.fromEntries(request.headers.entries())
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
