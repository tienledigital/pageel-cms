# Security Assessment — Pageel CMS v2.0.0

> **Date:** 2026-03-26
> **Assessor:** AI-assisted (with human review)
> **Scope:** Targeted assessment — auth flow, session management, proxy layer
> **Status:** ✅ Beta-ready (see Recommendations for v2.1)

---

## Summary

Pageel CMS v2.0 uses a server-side authentication model where the client never directly
accesses Git APIs. All Git operations go through authenticated proxy endpoints. This
assessment verifies the security posture of the auth flow, session management, and
API proxy layer.

**Overall rating: ✅ Acceptable for production deployment.**

---

## Assessment Results

### 1. Authentication (OWASP A07:2021 — Identification & Auth Failures)

| Control | Implementation | Status |
|:--------|:---------------|:-------|
| Password hashing | bcryptjs, cost factor 12 | ✅ Strong |
| Timing attack prevention | Constant-time comparison (dummy bcrypt on wrong username) | ✅ `auth.ts:83` |
| Brute force protection | In-memory rate limit: 5 attempts/min/IP | ✅ `auth.ts:21-36` |
| Password storage | Env var only (never in code/DB) | ✅ |
| Hash validation | `isValidBcryptHash()` — length 60 + prefix `$2[aby]$` | ✅ `auth.ts:75-78` |
| dotenv-expand bypass | 3-tier resolution: import.meta.env → process.env → raw .env | ✅ `auth.ts:46-67` |

**Finding:** None. Auth implementation follows best practices.

---

### 2. Session Management (OWASP A01:2021 — Broken Access Control)

| Control | Implementation | Status |
|:--------|:---------------|:-------|
| Session token | HMAC-SHA256 signed cookie | ✅ `session.ts` |
| Cookie: HttpOnly | `true` — not accessible via JavaScript | ✅ |
| Cookie: Secure | `true` in production (HTTPS only) | ✅ |
| Cookie: SameSite | `Strict` — blocks CSRF | ✅ |
| Cookie: Path | `/` | ✅ |
| Session expiration | 24 hours (MAX_AGE = 86400) | ✅ |
| Session fixation | New session created per login (no reuse) | ✅ |
| Stale session detection | Middleware Layer 3 — validates credentials completeness | ✅ BUG-19 fix |
| Mode transition safety | Cookie auto-cleared when env changes invalidate credentials | ✅ |

**Finding A (v2.1):** Dynamic credentials (token, repo) stored as base64 in cookie payload.
HMAC ensures **integrity** but not **confidentiality**. If an attacker obtains the raw cookie
value, they can decode the GitHub token.

- **Current mitigation:** HttpOnly + Secure + SameSite=Strict prevents XSS and MITM extraction.
- **Risk:** 🟢 Low — requires physical access or server-side vulnerability.
- **Recommendation:** Encrypt payload with AES-GCM before HMAC signing in v2.1.

**Finding B (v2.1):** No mechanism for mass session invalidation. When admin changes
env vars, existing sessions remain valid until expiration (24h).

- **Current mitigation:** Middleware Layer 3 detects missing credentials and auto-clears.
- **Risk:** 🟢 Low — only affects mode transitions, not security bypass.
- **Recommendation:** Add `CMS_SESSION_VERSION` env var for explicit invalidation in v2.1.

---

### 3. CSRF Protection (OWASP A01:2021)

| Vector | Protection | Status |
|:-------|:-----------|:-------|
| Cross-site form submission | `SameSite=Strict` cookie | ✅ |
| Cross-origin API calls | Cookie not sent cross-origin (SameSite) | ✅ |
| Login form | Standard HTML form POST to same origin | ✅ |

**Finding:** None. `SameSite=Strict` is the strongest CSRF protection available.

---

### 4. API Proxy Security (OWASP A01:2021, A03:2021)

| Control | Implementation | Status |
|:--------|:---------------|:-------|
| Action whitelist | 12 methods explicitly allowed via `ALLOWED_ACTIONS` Set | ✅ `git.ts:14-27` |
| Auth guard (middleware) | 3-layer verification: cookie → HMAC → credentials | ✅ `middleware.ts` |
| Auth guard (endpoint) | Double-check session in each proxy handler | ✅ Defense in depth |
| Input validation | Action + params validated per switch case | ✅ |
| Error handling | Catch-all returns generic error, logs server-side only | ✅ |
| File upload | FormData with path + file validation | ✅ `upload.ts` |
| Path traversal | Paths passed to GitHub API (GitHub validates) | ✅ |

**Allowed proxy actions (whitelist):**
```
getRepoContents, listFiles, getFileContent, getFileSha,
createFileFromString, updateFileContent, deleteFile,
scanForContentDirectories, scanForImageDirectories,
findProductionUrl, getRepoTree, getRepoDetails
```

**Finding:** None. Whitelist approach is secure by default.

---

### 5. Sensitive Data Exposure (OWASP A02:2021)

| Data | Protection | Status |
|:-----|:-----------|:-------|
| GitHub token (env) | Server-side only, never sent to client | ✅ |
| GitHub token (session) | In HMAC cookie, HttpOnly | ✅ (see Finding A) |
| Bcrypt hash | Never exposed in API responses | ✅ |
| CMS_SECRET | Used for HMAC signing only, min 16 chars enforced | ✅ |
| Error messages | Generic user-facing, detailed server-side only | ✅ |
| Route naming | `/cms` instead of `/admin` | ✅ |

**Finding:** None critical. See Finding A for cookie confidentiality note.

---

### 6. Security Headers

| Header | Present | Notes |
|:-------|:--------|:------|
| HttpOnly cookie | ✅ | Prevents XSS token theft |
| Secure cookie | ✅ (prod) | HTTPS only in production |
| SameSite=Strict | ✅ | CSRF protection |
| Content-Type | ✅ | Set on all API responses |
| X-Frame-Options | ❌ | Not set — consider for v2.1 |
| X-Content-Type-Options | ❌ | Not set — consider for v2.1 |
| CSP | ❌ | Complex with client:only React — future |

**Recommendation:** Add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`
via Astro middleware in v2.1.

---

## Threat Summary

| Threat | Severity | Status | Notes |
|:-------|:---------|:-------|:------|
| Brute force login | 🟡 | ✅ Mitigated | Rate limiting 5/min/IP |
| Session hijacking (XSS) | 🔴 | ✅ Mitigated | HttpOnly cookie |
| Session hijacking (MITM) | 🔴 | ✅ Mitigated | Secure flag (HTTPS) |
| CSRF | 🟡 | ✅ Mitigated | SameSite=Strict |
| Stale session (mode change) | 🟡 | ✅ Mitigated | Middleware Layer 3 |
| Token leak via cookie | 🟡 | ⚠️ Noted | Finding A — encrypt in v2.1 |
| Mass session invalidation | 🟢 | ⚠️ Noted | Finding B — version in v2.1 |
| Clickjacking | 🟢 | ⚠️ Missing | X-Frame-Options not set |
| Path traversal | 🟢 | ✅ Mitigated | GitHub API validates paths |

---

## Recommendations for v2.1

1. **Encrypt session payload** (Finding A): AES-GCM encrypt before HMAC sign
2. **Session versioning** (Finding B): `CMS_SESSION_VERSION` env var
3. **Security headers**: X-Frame-Options, X-Content-Type-Options via middleware
4. **Content Security Policy**: Evaluate feasibility with React client:only
5. **Full OWASP audit**: See `plans/security-owasp-full.md` for comprehensive plan

---

_Assessment completed: 2026-03-26_
