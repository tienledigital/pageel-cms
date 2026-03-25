# Deployment Guide

## Prerequisites

- Node.js >= 22.12.0
- A GitHub repository with markdown content
- A GitHub personal access token (fine-grained recommended)

## Environment Variables

Create a `.env` file (see `.env.example`):

| Variable | Required | Description |
|:---------|:---------|:------------|
| `CMS_USER` | ✅ | Login username |
| `CMS_PASS_HASH` | ✅ | Bcrypt hash of the login password |
| `CMS_SECRET` | ✅ | Random string (min 16 chars) for session signing |
| `GITHUB_TOKEN` | ✅ | Git personal access token (fine-grained recommended) |
| `CMS_REPO` | ✅ | Repository in `owner/repo` format |
| `CMS_SERVICE` | ❌ | `github` (default), `gitea`, or `gogs` |
| `CMS_INSTANCE_URL` | ❌ | Self-hosted instance URL (for Gitea/Gogs) |

## Generating CMS_PASS_HASH

The password is stored as a **bcrypt hash** — the server never stores your plaintext password.

### Option 1: Using Node.js (recommended)

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 12).then(h => console.log(h))"
```

### Option 2: Using npx (no install required)

```bash
npx -y bcryptjs-cli hash "your-password" 12
```

### Option 3: Online generator

Use [bcrypt-generator.com](https://bcrypt-generator.com/) with 12 rounds.

### Important Notes

- The hash starts with `$2a$12$` or `$2b$12$` — this is normal
- Use **12 rounds** for a good balance of security and speed
- The `$` characters in the hash can cause issues with some `.env` parsers — wrap the value in double quotes:

```env
CMS_PASS_HASH="$2a$12$LJ3m4ys8Rqh5X.9Q4j5KyOZ1gGCIk9PM5dLr7h2EXAMPLE"
```

## Generating CMS_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or any random string generator — minimum 16 characters.

---

## Deploy to VPS / Docker

### 1. Build

```bash
cd astro
npm install
npm run build
```

### 2. Run

```bash
# Set environment variables
export CMS_USER=admin
export CMS_PASS_HASH='$2a$12$...'
export CMS_SECRET=your-secret
export GITHUB_TOKEN=ghp_xxx
export CMS_REPO=owner/repo

# Start server
node dist/server/entry.mjs
```

Server runs on `http://localhost:4321` by default.

### 3. With Docker (example)

```dockerfile
FROM node:22-alpine
WORKDIR /app

COPY astro/package*.json ./
RUN npm ci --omit=dev

COPY astro/ ./
RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
```

### 4. With PM2

```bash
pm2 start dist/server/entry.mjs --name pageel-cms
```

### 5. Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name cms.example.com;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Deploy to Vercel

> **Important:** The Astro app lives in the `astro/` subdirectory, not at the repo root.
> Vercel needs to know this — there are two ways to handle it.

### 1. Swap Adapter

In `astro/astro.config.mjs`, replace the adapter:

```diff
- import node from '@astrojs/node';
+ import vercel from '@astrojs/vercel';

  export default defineConfig({
    output: 'server',
    integrations: [react()],
-   adapter: node({ mode: 'standalone' }),
+   adapter: vercel(),
    vite: {
      plugins: [tailwindcss()],
    },
  });
```

```bash
cd astro && npm install @astrojs/vercel
```

### 2. Configure Root Directory (choose ONE method)

#### Method A: `vercel.json` at repo root (recommended — already included)

The repo includes a `vercel.json` that tells Vercel how to find the app:

```json
{
  "buildCommand": "cd astro && npm install && npm run build",
  "outputDirectory": "astro/dist",
  "installCommand": "cd astro && npm install",
  "framework": "astro"
}
```

This file is already in the repo — no extra config needed on Vercel.

#### Method B: Vercel Dashboard setting

If you prefer not to use `vercel.json`:

1. Go to **Vercel Dashboard → Project → Settings → General**
2. Set **Root Directory** to `astro`
3. Vercel will then treat `astro/` as the project root

| Setting | Value |
|:--------|:------|
| **Root Directory** | `astro` |
| **Framework** | Astro (auto-detected) |
| **Build Command** | `npm run build` (runs inside Root Directory) |
| **Output Directory** | `dist` (relative to Root Directory) |

### 3. Set Environment Variables

In **Vercel Dashboard → Project → Settings → Environment Variables**:

```
CMS_USER       = admin
CMS_PASS_HASH  = $2a$12$...   ← paste as-is, Vercel doesn't corrupt $ chars
CMS_SECRET     = your-random-secret
GITHUB_TOKEN   = ghp_xxx
CMS_REPO       = owner/repo
CMS_SERVICE    = github
```

> **Note:** Vercel environment variables are NOT processed by dotenv-expand,
> so bcrypt hashes with `$` characters work without escaping.

### 4. Deploy

```bash
# Via Vercel CLI
cd astro && vercel --prod

# Or push to GitHub — Vercel auto-deploys from connected repo
```

### Vercel Limitations

- **Rate limiting** resets on each cold start (serverless function lifecycle)
- **Session storage** uses Vercel's default (check Astro session docs for Vercel adapter)
- **File system access** is read-only — the `.env` file fallback won't work (not needed since Vercel provides env vars natively)

---

## Security Checklist

Before going to production:

- [ ] Use HTTPS (required for `Secure` cookie flag)
- [ ] Set a strong `CMS_SECRET` (32+ chars recommended)
- [ ] Use a strong password with 12+ characters
- [ ] Restrict `GITHUB_TOKEN` permissions (fine-grained: Contents read/write only)
- [ ] Monitor access logs for brute force attempts
- [ ] Keep dependencies updated (`npm audit`)
