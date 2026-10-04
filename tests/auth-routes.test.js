const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function loadRedirectHelpers() {
  const sourcePath = path.resolve(__dirname, '../src/lib/auth/redirects.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const compiledModule = { exports: {} };

  new Function('exports', 'module', 'require', output)(compiledModule.exports, compiledModule, require);
  return compiledModule.exports;
}

describe('authentication route contracts', () => {
  const { buildAuthCallbackUrl, sanitizeRedirectPath } = loadRedirectHelpers();

  it('uses the server callback route and preserves a safe destination', () => {
    expect(buildAuthCallbackUrl('http://localhost:3000', '/onboarding')).toBe(
      'http://localhost:3000/api/auth/callback?next=%2Fonboarding'
    );
  });

  it('rejects external and protocol-relative redirect destinations', () => {
    expect(sanitizeRedirectPath('https://example.com', '/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectPath('//example.com', '/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectPath('/settings', '/dashboard')).toBe('/settings');
  });

  it('does not reference nonexistent /auth UI routes', () => {
    const authRoot = path.resolve(__dirname, '../src/app/(auth)');
    const source = [
      'signup/page.tsx',
      'login/page.tsx',
      'verify-email/page.tsx',
      'reset-password/page.tsx',
      'callback/page.tsx',
    ].map((file) => fs.readFileSync(path.join(authRoot, file), 'utf8')).join('\n');

    expect(source).not.toMatch(/['"`]\/auth\/(?:verify-email|callback|reset-password|auth-code-error)/);
  });

  it('keeps compatibility redirects for confirmation links already sent', async () => {
    const config = require('../next.config.js');
    const redirects = await config.redirects();

    expect(redirects).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '/auth/verify-email', destination: '/verify-email' }),
      expect.objectContaining({ source: '/auth/callback', destination: '/api/auth/callback' }),
      expect.objectContaining({ source: '/auth/reset-password', destination: '/reset-password' }),
      expect.objectContaining({ source: '/auth/auth-code-error', destination: '/auth-code-error' }),
    ]));
  });
});
