const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

test('Tailwind 4 is wired into PostCSS and the global stylesheet', () => {
  const pkg = require(path.join(root, 'package.json'));
  const css = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8');
  const postcss = fs.readFileSync(path.join(root, 'postcss.config.mjs'), 'utf8');

  expect(pkg.devDependencies['@tailwindcss/postcss']).toBeTruthy();
  expect(postcss).toContain('"@tailwindcss/postcss"');
  expect(css).toMatch(/^@import "tailwindcss";/);
  expect(css).toContain('@config "../../tailwind.config.ts";');
  expect(css).not.toMatch(/@tailwind\s+(?:base|components|utilities)/);
});
