const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('discussion author relationships', () => {
  it.each([
    'src/app/api/discussion/threads/route.ts',
    'src/app/api/discussion/comments/route.ts',
    'src/app/api/discussion/comments/[commentId]/route.ts',
  ])('%s selects the comment author through user_id', (file) => {
    const source = read(file);
    expect(source).not.toMatch(/user_profiles!inner/);
    expect(source).toMatch(/user_profiles!discussion_comments_user_id_fkey!inner/);
  });
});

describe('company profile topic badges', () => {
  it('keys each mapped badge', () => {
    const source = read('src/app/(dashboard)/companies/[id]/page.tsx');
    expect(source).toMatch(/<Badge key=\{key\} variant=/);
    expect(source).toMatch(/\.map\(\(tag, index\) => getTopicBadge\(tag, `\$\{tag\}-\$\{index\}`\)\)/);
  });
});
