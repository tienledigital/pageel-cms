# Development Guide

A comprehensive guide for setting up and developing Pageel Core.

---

## Prerequisites

| Requirement | Version                                    |
| :---------- | :----------------------------------------- |
| Node.js     | 20.19+ or 22.12+                           |
| npm         | 10+                                        |
| Git         | Latest                                     |
| Browser     | Chrome/Firefox/Safari with ES2020+ support |

---

## Project Structure

```
pageel/                        # Workspace (not a git repo)
├── .agent/                    # Internal - AI workflows
├── docs-internal/             # Internal - planning, strategy
│   ├── planning/
│   └── strategy/
├── metadata.json              # Internal - workspace metadata
│
└── pageel-core/               # ← GIT REPO (push this folder)
    ├── .gitignore
    ├── README.md
    ├── CHANGELOG.md
    ├── LICENSES.md
    ├── scripts/
    │   └── release.ps1        # Release automation
    ├── core/                  # Pageel Core Application
    │   ├── src/
    │   │   ├── components/    # React components
    │   │   ├── services/      # Git API adapters
    │   │   ├── utils/         # Utilities
    │   │   ├── i18n/          # Translations
    │   │   ├── App.tsx        # Main app
    │   │   ├── index.tsx      # Entry point
    │   │   └── types.ts       # TypeScript types
    │   ├── index.html
    │   ├── vite.config.ts
    │   ├── tsconfig.json
    │   └── package.json
    └── docs/
        └── guides/            # This guide!
```

---

## Quick Start

```bash
# Clone repo
git clone https://github.com/pageel/pageel-core.git
cd pageel-core

# Navigate to core
cd core

# Install dependencies
npm install

# Start dev server
npm run dev
```

App will run at [http://localhost:3000](http://localhost:3000)

---

## Available Scripts

| Command           | Description                       |
| :---------------- | :-------------------------------- |
| `npm run dev`     | Start Vite dev server (port 3000) |
| `npm run build`   | Build production bundle           |
| `npm run preview` | Preview production build          |

---

## Release Workflow

To release a new version:

```powershell
# Navigate to pageel-core
cd pageel-core

# Run release script (dry-run first)
.\scripts\release.ps1 1.1.0 -DryRun

# Run actual release
.\scripts\release.ps1 1.1.0
```

The script will:

1. Verify repository
2. Check for uncommitted changes
3. Build project
4. Update `package.json` version
5. Create commit and tag
6. Push to GitHub

## Technology Stack

| Category       | Technology            |
| :------------- | :-------------------- |
| **Framework**  | React 19              |
| **Language**   | TypeScript 5.9+       |
| **Build Tool** | Vite 7+               |
| **Styling**    | Tailwind CSS (CDN)    |
| **Icons**      | Custom SVG components |
| **Fonts**      | Inter (Google Fonts)  |

### CDN Dependencies

| Library     | Purpose            |
| :---------- | :----------------- |
| `marked`    | Markdown parsing   |
| `DOMPurify` | HTML sanitization  |
| `JSZip`     | Archive generation |
| `js-yaml`   | YAML parsing       |

---

## Architecture Overview

### Adapter Pattern

Core uses `IGitService` interface to abstract different Git APIs:

```typescript
interface IGitService {
  getRepoContents(path: string): Promise<ContentInfo[]>;
  getFileContent(path: string): Promise<string>;
  uploadFile(path, file, message, sha?): Promise<any>;
  // ...more methods
}
```

Implementations:

- `GithubAdapter` - GitHub REST API
- `GiteaAdapter` - Gitea API
- `GogsAdapter` - Gogs API

### Security Model

- PAT encrypted with **AES-GCM** (256-bit)
- Key generated per session
- Stored in `sessionStorage` (cleared on tab close)

### State Management

| Location         | Data                     |
| :--------------- | :----------------------- |
| sessionStorage   | Encrypted PAT, repo info |
| localStorage     | Settings (per-repo)      |
| URL Query        | Active view state        |
| `.pageelrc.json` | Remote config            |

---

## Debugging

### Browser DevTools

1. Open DevTools (F12)
2. Check Console for errors
3. Network tab for API calls
4. Application tab for storage

### Common Issues

| Issue       | Solution                                |
| :---------- | :-------------------------------------- |
| Token error | Regenerate PAT with correct permissions |
| CORS error  | Check Git instance CORS settings        |
| Build error | Run `npm install` again                 |

---

## Testing Workflow

1. **Manual Testing:**

   - Connect to test repository
   - Create/edit/delete posts
   - Upload/manage images
   - Test all modules

2. **Browser Testing:**
   - Chrome, Firefox, Safari
   - Desktop and mobile responsive

---

## Resources

- [README.md](../../README.md) - Project overview
- [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute
- [CHANGELOG.md](../../CHANGELOG.md) - Version history
