const fs = require('fs');
const path = require('path');

describe('company topic badges', () => {
  it('gives every mapped badge a stable key', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/app/(dashboard)/companies/page.tsx'),
      'utf8'
    );

    expect(source).toMatch(/<Badge key=\{key\} variant=/);
    expect(source).toMatch(/\.map\(\(tag, index\) => getTopicBadge\(tag, `\$\{company\.id\}-\$\{tag\}-\$\{index\}`\)\)/);
  });
});
