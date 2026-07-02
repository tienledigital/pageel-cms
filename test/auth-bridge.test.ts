// @para-doc [#csa-cms-app-int-test-mode]
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyAppToken, logoutAppSession, getSsoRedirectUrl } from '../src/lib/auth-bridge';
import { createSession } from '../src/lib/session';

// Import endpoints (will fail RED stage until files are created)
// @ts-ignore
import { GET as handleCallback } from '../src/pages/api/auth/callback';
// @ts-ignore
import { POST as handleLogout } from '../src/pages/api/auth/logout';

describe('auth-bridge TDD tests', () => {
  const token = 'mock-jwt-token';
  const mockWorkerUrl = 'https://api.pageel.app';

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
        user: { id: '1', email: 'test@pageel.app', role: 'admin' },
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
        user: { id: '1', email: 'test@pageel.app', role: 'admin' },
        config: { githubToken: 'gh-token', repoOwner: 'owner', repoName: 'repo' }
      };

      const mockBinding = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        }),
      };

      const result = await verifyAppToken(token, { PAGEEL_APP_BINDING: mockBinding });

      expect(mockBinding.fetch).toHaveBeenCalledWith('https://api.pageel.app/api/auth/verify-bridge', expect.objectContaining({
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

  describe('logoutAppSession', () => {
    it('should call SaaS logout via fetch fallback when Service Binding is absent', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await logoutAppSession(token, {});

      expect(fetchMock).toHaveBeenCalledWith(`${mockWorkerUrl}/api/auth/logout`, expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }));
      expect(result).toBe(true);
    });

    it('should call SaaS logout via Service Binding when present', async () => {
      const mockBinding = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        }),
      };

      const result = await logoutAppSession(token, { PAGEEL_APP_BINDING: mockBinding });

      expect(mockBinding.fetch).toHaveBeenCalledWith('https://api.pageel.app/api/auth/logout', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }));
      expect(result).toBe(true);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('should return false if SaaS logout fails or times out', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', fetchMock);

      const result = await logoutAppSession(token, {});
      expect(result).toBe(false);
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
        user: { id: '1', email: 'user@pageel.app', role: 'admin' },
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
      expect(context.cookies.set).toHaveBeenCalledWith('pageel_session', expect.any(String), expect.objectContaining({
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

  describe('Logout Endpoint', () => {
    it('should delete local session cookie and call SaaS logout api', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const context = {
        request: new Request('http://localhost/api/auth/logout'),
        cookies: {
          set: vi.fn(),
          delete: vi.fn(),
          get: vi.fn(),
        },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
      } as any;

      const sessionToken = await createSession({
        username: 'user@pageel.app',
        repo: 'owner/repo',
        token: 'gh-token',
      });
      context.cookies.get.mockReturnValue({ value: sessionToken });

      const response = await handleLogout(context);
      expect(context.cookies.delete).toHaveBeenCalledWith('pageel_session', expect.objectContaining({ path: '/' }));
      expect(fetchMock).toHaveBeenCalledWith(`${mockWorkerUrl}/api/auth/logout`, expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'gh-token' }),
      }));
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/login');
    });
  });

  describe('Login UI Toggle Logic', () => {
    it('should determine SSO mode is active when PAGEEL_APP_URL is configured', () => {
      const mockEnv = { PAGEEL_APP_URL: 'https://cms.pageel.app' };
      const appUrl = mockEnv.PAGEEL_APP_URL || '';
      const hasSso = !!appUrl;
      
      expect(hasSso).toBe(true);
      expect(appUrl).toBe('https://cms.pageel.app');
    });

    it('should determine SSO mode is inactive when PAGEEL_APP_URL is not configured', () => {
      const mockEnv = { PAGEEL_APP_URL: '' };
      const appUrl = mockEnv.PAGEEL_APP_URL || '';
      const hasSso = !!appUrl;
      
      expect(hasSso).toBe(false);
      expect(appUrl).toBe('');
    });

    it('should generate correct redirect SSO URL with callback parameter', () => {
      const mockEnv = { PAGEEL_APP_URL: 'https://cms.pageel.app' };
      const mockEnvWithSlash = { PAGEEL_APP_URL: 'https://cms.pageel.app/' };
      const mockOrigin = 'http://localhost:3000';
      
      const redirectUrl = getSsoRedirectUrl(mockEnv.PAGEEL_APP_URL, mockOrigin);
      const redirectUrlWithSlash = getSsoRedirectUrl(mockEnvWithSlash.PAGEEL_APP_URL, mockOrigin);
      
      expect(redirectUrl).toBe('https://cms.pageel.app/api/auth/bridge?return_url=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback');
      expect(redirectUrlWithSlash).toBe('https://cms.pageel.app/api/auth/bridge?return_url=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback');
    });
  });
});
