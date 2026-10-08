import { parseAnswerArgs, runAnswerWorker } from '@/lib/intelligence/answers/worker';

describe('answer snapshot worker CLI', () => {
  it('prints help without loading credentials', async () => {
    const log = jest.fn();
    await expect(runAnswerWorker(['node', 'script', '--help'], { log })).resolves.toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('accepts equals and spaced values', () => {
    const parsed = parseAnswerArgs(['node', 'script', '--period-start=2026-07-01T00:00:00Z', '--period-end', '2026-10-01T00:00:00Z', '--domains', 'agents,infra']);
    expect(parsed.filters).toBeDefined();
    expect((parsed.filters?.domains as string[])).toEqual(['agents', 'infra']);
  });

  it('rejects missing required windows', () => {
    expect(() => parseAnswerArgs(['node', 'script', '--domains', 'agents'])).toThrow('required');
  });
});
