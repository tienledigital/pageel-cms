import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// @ts-ignore
import { verifyPBKDF2, hashPBKDF2, timingSafeEqual } from '../src/lib/auth';
// @ts-ignore
import { createCsrfToken, verifyCsrfToken } from '../src/lib/session';
// @ts-ignore
import { POST as handleLogin } from '../src/pages/api/auth/login';

describe('Edge Security Hardening TDD Tests', () => {
  const secretKey = 'super-secret-key-16-chars-min';

  beforeEach(() => {
    vi.stubEnv('CMS_SECRET', secretKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Constant-Time String Comparison', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(timingSafeEqual('abc', 'abcdef')).toBe(false);
    });
  });

  describe('PBKDF2 Web Crypto Cryptography', () => {
    it('should hash a password into the expected format', async () => {
      const password = 'my-secure-password';
      const hash = await hashPBKDF2(password);
      
      // Expected format: pbkdf2:iterations:salt_hex:hash_hex
      expect(hash).toMatch(/^pbkdf2:100000:[a-f0-9]{32}:[a-f0-9]{64}$/);
    });

    it('should verify a correct password successfully', async () => {
      const password = 'my-secure-password';
      const hash = await hashPBKDF2(password);
      
      const isValid = await verifyPBKDF2(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'my-secure-password';
      const wrongPassword = 'wrong-password';
      const hash = await hashPBKDF2(password);
      
      const isValid = await verifyPBKDF2(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should fail verification for malformed hash formats', async () => {
      const isValid = await verifyPBKDF2('password', 'invalid-hash-format');
      expect(isValid).toBe(false);
    });
  });

  describe('Double Submit HMAC CSRF Token', () => {
    const sessionId = 'session-id-12345';

    it('should generate a valid CSRF token containing sessionId signature', async () => {
      const token = await createCsrfToken(sessionId, secretKey);
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(64);
    });

    it('should validate a correct CSRF token successfully', async () => {
      const token = await createCsrfToken(sessionId, secretKey);
      const isValid = await verifyCsrfToken(token, sessionId, secretKey);
      expect(isValid).toBe(true);
    });

    it('should reject CSRF token if sessionId does not match', async () => {
      const token = await createCsrfToken(sessionId, secretKey);
      const wrongSessionId = 'wrong-session-id';
      const isValid = await verifyCsrfToken(token, wrongSessionId, secretKey);
      expect(isValid).toBe(false);
    });

    it('should reject CSRF token if signed with a different secret', async () => {
      const token = await createCsrfToken(sessionId, secretKey);
      const wrongSecret = 'wrong-secret-key-16-chars';
      const isValid = await verifyCsrfToken(token, sessionId, wrongSecret);
      expect(isValid).toBe(false);
    });

    it('should reject expired CSRF tokens', async () => {
      const expiredToken = await createCsrfToken(sessionId, secretKey);
      vi.useFakeTimers();
      // Advance by 25 hours (max age is 24 hours)
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      
      const isValid = await verifyCsrfToken(expiredToken, sessionId, secretKey);
      expect(isValid).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('Login API Endpoint with PBKDF2 & CSRF Cookie', () => {
    let testHash = '';

    beforeEach(async () => {
      testHash = await hashPBKDF2('correct-password');
      vi.stubEnv('CMS_USER', 'admin');
      vi.stubEnv('CMS_PASS_HASH', testHash);
      vi.stubEnv('CMS_SECRET', secretKey);
      vi.stubEnv('GITHUB_TOKEN', 'gh-token');
      vi.stubEnv('CMS_REPO', 'owner/repo');
    });

    it('should login successfully with correct credentials and set session + CSRF cookies', async () => {
      const formData = new FormData();
      formData.append('username', 'admin');
      formData.append('password', 'correct-password');

      const context = {
        request: new Request('http://localhost/api/auth/login', {
          method: 'POST',
          body: formData,
        }),
        cookies: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
        clientAddress: '127.0.0.1',
      } as any;

      const response = await handleLogin(context);
      expect(response.status).toBe(302);
      expect(context.redirect).toHaveBeenCalledWith('/cms');
      
      // Should set session cookie
      expect(context.cookies.set).toHaveBeenCalledWith('pageel_cms_session', expect.any(String), expect.any(Object));
      // Should set CSRF cookie
      expect(context.cookies.set).toHaveBeenCalledWith('pageel_csrf_token', expect.any(String), expect.objectContaining({
        httpOnly: false, // CSRF token cookie allows client-side JS to read and attach to custom header
        path: '/',
      }));
    });

    it('should reject login if password is incorrect', async () => {
      const formData = new FormData();
      formData.append('username', 'admin');
      formData.append('password', 'wrong-password');

      const context = {
        request: new Request('http://localhost/api/auth/login', {
          method: 'POST',
          body: formData,
        }),
        cookies: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
        clientAddress: '127.0.0.1',
      } as any;

      const response = await handleLogin(context);
      expect(response.status).toBe(302);
      expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining('Invalid%20credentials'));
      expect(context.cookies.set).not.toHaveBeenCalled();
    });
  });
});
