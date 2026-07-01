import { getFileAsBlob, createGitConfig } from './git-client';
import { resolveGitCredentials, verifySession } from './session';

// @para-doc [#csa-cms-path-val-context]
export type PathContext = 'blob' | 'cms-read' | 'cms-write';

// @para-doc [#csa-cms-path-val-universal-blocked]
const UNIVERSAL_BLOCKED: RegExp[] = [
  /^\.\.\//,                                         // Path traversal
  /^\.\//,                                           // Relative paths
  /^\.env/i,                                         // Environment secrets
  /^\.git\//i,                                       // Git internals
  /^node_modules\//i,                                // Dependencies
];

// @para-doc [#csa-cms-path-val-source-blocked]
const SOURCE_BLOCKED: RegExp[] = [
  /^\.github\//i,                                    // CI/CD configs
  /^src\//i,                                         // All source code
  /\.(ts|tsx|js|jsx|mjs|cjs|sh|yml|yaml|toml)$/i,    // Code/config file extensions
];

// @para-doc [#csa-cms-path-val-content-allowed]
const CMS_CONTENT_ALLOWED: RegExp[] = [
  /^src\/content(\/|$)/i,                            // Astro content collections
  /^src\/data(\/|$)/i,                               // Astro Content Layer (v5+)
  /^src\/assets(\/|$)/i,                             // Astro optimized assets
];

// @para-doc [#csa-cms-path-val-code-extensions-blocked]
const CODE_EXTENSIONS_BLOCKED: RegExp[] = [
  /\.(ts|tsx|js|jsx|mjs|cjs|sh)$/i,                  // Execution-capable script extensions
];

// @para-doc [#csa-cms-path-val-normalize]
export function normalizePath(path: string): string {
  // Convert backslashes to forward slashes, and split
  const segments = path.replace(/\\/g, '/').split('/');
  const stack: string[] = [];

  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop();
      } else {
        stack.push('..');
      }
    } else {
      stack.push(segment);
    }
  }
  return stack.join('/');
}

// @para-doc [#csa-cms-path-val-is-allowed]
// @para-doc [#csa-cms-path-val-unit-tests]
export function isPathAllowed(path: string, context: PathContext = 'blob'): boolean {
  let decodedPath = path;
  try {
    decodedPath = decodeURIComponent(path);
  } catch (e) {
    // If decode fails, use original path
  }

  const normalizedPath = normalizePath(decodedPath);
  
  // Block any path traversal attempts going outside the repository root
  if (normalizedPath.startsWith('../') || normalizedPath === '..') {
    return false;
  }
  
  // Universal blocks apply to ALL contexts
  if (UNIVERSAL_BLOCKED.some(pattern => pattern.test(normalizedPath))) {
    return false;
  }
  
  switch (context) {
    case 'blob':
      // Strictest — original behavior, blocks all src/ and code/config extensions
      return !SOURCE_BLOCKED.some(pattern => pattern.test(normalizedPath));
      
    case 'cms-read':
      // Allow reading from content directories BUT block code file extensions
      if (CMS_CONTENT_ALLOWED.some(pattern => pattern.test(normalizedPath))) {
        return !CODE_EXTENSIONS_BLOCKED.some(pattern => pattern.test(normalizedPath));
      }
      return !SOURCE_BLOCKED.some(pattern => pattern.test(normalizedPath));
      
    case 'cms-write':
      // Allow writing to content dirs BUT block code file extensions
      if (CMS_CONTENT_ALLOWED.some(pattern => pattern.test(normalizedPath))) {
        return !CODE_EXTENSIONS_BLOCKED.some(pattern => pattern.test(normalizedPath));
      }
      return !SOURCE_BLOCKED.some(pattern => pattern.test(normalizedPath));
  }
}

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.md': 'text/markdown',
};

export function getMimeType(filepath: string): string {
  const ext = filepath.substring(filepath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export async function createAuthenticatedBlobResponse(
  sessionToken: string,
  filePath: string,
  tryPublicFallback: boolean = false
): Promise<Response> {
  const session = await verifySession(sessionToken);
  if (!session) {
    return new Response('Session expired', { status: 401 });
  }

  const creds = resolveGitCredentials(session);
  const config = createGitConfig(creds.token, creds.repo);
  const decodedPath = decodeURIComponent(filePath);

  if (!isPathAllowed(decodedPath)) {
    return new Response('Path not allowed', { status: 403 });
  }

  try {
    const upstreamResponse = await getFileAsBlob(config, decodedPath);
    const contentType = getMimeType(decodedPath);

    return new Response(upstreamResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    // Thử tìm trong public/ nếu cho phép fallback và lỗi là Not Found
    if (tryPublicFallback && (error.message?.includes('404') || error.status === 404)) {
      if (!decodedPath.startsWith('public/')) {
        const publicPath = `public/${decodedPath.replace(/^\//, '')}`;
        try {
          const fallbackResponse = await getFileAsBlob(config, publicPath);
          const contentType = getMimeType(publicPath);

          return new Response(fallbackResponse.body, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        } catch (fallbackError) {
          // ignore error and throw the original one
        }
      }
    }

    console.error(`[proxy] Blob fetch failed for ${decodedPath}:`, error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Blob fetch failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
