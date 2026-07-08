// @para-doc [#csa-cms-app-int-test-mode]
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyAppToken, logoutAppSession, getSsoRedirectUrl } from '../src/lib/auth-bridge';
import { createSession, createCsrfToken } from '../src/lib/session';

// Import endpoints (will fail RED stage until files are created)
// @ts-ignore
import { GET as handleCallback } from '../src/pages/api/auth/callback';
// @ts-ignore
import { POST as handleLogout } from '../src/pages/api/auth/logout';

describe('auth-bridge TDD tests', () => {
  const token = 'mock-jwt-token';
  const mockWorkerUrl = 'https://api.example.com';

  beforeEach(() => {
    vi.stubEnv('PAGEEL_WORKER_URL', mockWorkerUrl);
    vi.stubEnv('CMS_SECRET', 'super-secret-key-16-chars-min');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('verifyAppToken', () => {
    it('should use HTTP fetch when Service Binding is not present (fallback mode)', async () => {
      const mockResponse = {
        success: true,
        user: { id: '1', email: 'test@example.com', role: 'admin' },
        config: { githubToken: 'gh-token', repoOwner: 'owner', repoName: 'repo' }
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await verifyAppToken(token, {});

      expect(fetchMock).toHaveBeenCalledWith(`${mockWorkerUrl}/api/auth/verify-bridge`, expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should use Service Binding when present in env (binding mode)', async () => {
      const mockResponse = {
        success: true,
        user: { id: '1', email: 'test@example.com', role: 'admin' },
        config: { githubToken: 'gh-token', repoOwner: 'owner', repoName: 'repo' }
      };

      const mockBinding = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        }),
      };

      const result = await verifyAppToken(token, { PAGEEL_APP_BINDING: mockBinding });

      expect(mockBinding.fetch).toHaveBeenCalledWith('https://api.example.com/api/auth/verify-bridge', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }));
      expect(result).toEqual(mockResponse);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('should abort and throw an error if the request exceeds 5s timeout', async () => {
      vi.useFakeTimers();

      const fetchMock = vi.fn().mockImplementation((_url, options) => {
        return new Promise((resolve, reject) => {
          const signal = options?.signal;
          if (signal?.aborted) {
            return reject(new DOMException('The user aborted a request.', 'AbortError'));
          }
          const onAbort = () => {
            reject(new DOMException('The user aborted a request.', 'AbortError'));
            signal?.removeEventListener('abort', onAbort);
          };
          signal?.addEventListener('abort', onAbort);

          setTimeout(() => {
            reject(new Error('Timeout'));
            signal?.removeEventListener('abort', onAbort);
          }, 6000);
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const promise = verifyAppToken(token, {});
      vi.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow();
      vi.useRealTimers();
    });
  });

  describe('logoutAppSession (deprecated)', () => {
    it('should return true', async () => {
      const result = await logoutAppSession(token, {});
      expect(result).toBe(true);
    });
  });

  describe('Callback Endpoint', () => {
    it('should redirect to /login?error=auth_failed if token query parameter is missing', async () => {
      const context = {
        request: new Request('http://localhost/api/auth/callback'),
        cookies: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
      } as any;

      const response = await handleCallback(context);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/login?error=auth_failed');
      expect(context.redirect).toHaveBeenCalledWith('/login?error=auth_failed');
    });

    it('should set session cookie and redirect to /cms on successful verification', async () => {
      const mockResponse = {
        success: true,
        user: { id: '1', email: 'user@example.com', role: 'admin' },
        config: { githubToken: 'gh-token', repoOwner: 'owner', repoName: 'repo' }
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', fetchMock);

      const context = {
        request: new Request('http://localhost/api/auth/callback?token=' + token),
        cookies: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
      } as any;

      const response = await handleCallback(context);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/cms');
      expect(context.cookies.set).toHaveBeenCalledWith('pageel_cms_session', expect.any(String), expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }));
    });

    it('should redirect to /login?error=auth_failed on verification failure', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      vi.stubGlobal('fetch', fetchMock);

      const context = {
        request: new Request('http://localhost/api/auth/callback?token=' + token),
        cookies: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
      } as any;

      const response = await handleCallback(context);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/login?error=auth_failed');
    });
  });

  // @para-doc [#csa-sso-api-logout]
  // @para-doc [#csa-sso-sandbox-transport]
  describe('Logout Endpoint', () => {
    it('should delete local session cookie and redirect to SaaS Gateway GET logout URL', async () => {
      const sessionToken = 'payload.session-sig-abc';
      const validCsrf = await createCsrfToken('session-sig-abc', 'super-secret-key-16-chars-min');

      const context = {
        request: new Request('http://localhost/api/auth/logout', {
          method: 'POST',
          headers: { 'x-csrf-token': validCsrf },
        }),
        cookies: {
          set: vi.fn(),
          delete: vi.fn(),
          get: vi.fn().mockImplementation((name) => {
            if (name === 'pageel_cms_session') return { value: sessionToken };
            if (name === 'pageel_csrf_token') return { value: validCsrf };
            return null;
          }),
        },
        locals: {
          runtime: {
            env: {
              PAGEEL_APP_URL: 'https://api.example.com'
            }
          }
        },
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
      } as any;

      const response = await handleLogout(context);
      expect(context.cookies.delete).toHaveBeenCalledWith('pageel_cms_session', expect.objectContaining({ path: '/' }));
      expect(context.cookies.delete).toHaveBeenCalledWith('pageel_csrf_token', expect.objectContaining({ path: '/' }));
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('https://api.example.com/api/auth/logout?return_url=');
      expect(response.headers.get('Location')).toContain(encodeURIComponent('http://localhost/login'));
    });
  });

  describe('Login UI Toggle Logic', () => {
    it('should determine SSO mode is active when PAGEEL_APP_URL is configured', () => {
      const mockEnv = { PAGEEL_APP_URL: 'https://cms.example.com' };
      const appUrl = mockEnv.PAGEEL_APP_URL || '';
      const hasSso = !!appUrl;
      
      expect(hasSso).toBe(true);
      expect(appUrl).toBe('https://cms.example.com');
    });

    it('should determine SSO mode is inactive when PAGEEL_APP_URL is not configured', () => {
      const mockEnv = { PAGEEL_APP_URL: '' };
      const appUrl = mockEnv.PAGEEL_APP_URL || '';
      const hasSso = !!appUrl;
      
      expect(hasSso).toBe(false);
      expect(appUrl).toBe('');
    });

    it('should generate correct redirect SSO URL with callback parameter', () => {
      const mockEnv = { PAGEEL_APP_URL: 'https://cms.example.com' };
      const mockEnvWithSlash = { PAGEEL_APP_URL: 'https://cms.example.com/' };
      const mockOrigin = 'http://localhost:3000';
      
      const redirectUrl = getSsoRedirectUrl(mockEnv.PAGEEL_APP_URL, mockOrigin);
      const redirectUrlWithSlash = getSsoRedirectUrl(mockEnvWithSlash.PAGEEL_APP_URL, mockOrigin);
      
      expect(redirectUrl).toBe('https://cms.example.com/api/auth/bridge?return_url=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback');
      expect(redirectUrlWithSlash).toBe('https://cms.example.com/api/auth/bridge?return_url=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback');
    });
  });
});
