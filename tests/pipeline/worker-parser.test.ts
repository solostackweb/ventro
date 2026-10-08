/**
 * Worker Parser Tests — Checkpoint 2
 * Tests the real CLI parser and help command.
 */

import { parseArgs, validateArgs, printHelp } from '@/lib/pipeline/worker-parser';
import { runPipelineWorker } from '@/lib/pipeline/worker-main';

describe('Worker CLI Parser', () => {
  describe('parseArgs', () => {
    it('parses --type with space separator', () => {
      const args = parseArgs(['node', 'script', '--type', 'news_ingestion']);
      expect(args.type).toBe('news_ingestion');
    });

    it('parses --type=value with equals separator', () => {
      const args = parseArgs(['node', 'script', '--type=news_ingestion']);
      expect(args.type).toBe('news_ingestion');
    });

    it('parses --scope with space separator', () => {
      const args = parseArgs(['node', 'script', '--scope', 'sequoia-capital-blog']);
      expect(args.scope).toBe('sequoia-capital-blog');
    });

    it('parses --scope=value with equals separator', () => {
      const args = parseArgs(['node', 'script', '--scope=sequoia-capital-blog']);
      expect(args.scope).toBe('sequoia-capital-blog');
    });

    it('parses --max-stages with space separator', () => {
      const args = parseArgs(['node', 'script', '--max-stages', '5']);
      expect(args.maxStages).toBe(5);
    });

    it('parses --max-stages=value with equals separator', () => {
      const args = parseArgs(['node', 'script', '--max-stages=5']);
      expect(args.maxStages).toBe(5);
    });

    it('parses --once flag', () => {
      const args = parseArgs(['node', 'script', '--once']);
      expect(args.runOnce).toBe(true);
    });

    it('parses --resume with space separator', () => {
      const args = parseArgs(['node', 'script', '--resume', '123e4567-e89b-12d3-a456-426614174000']);
      expect(args.resumeRunId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('parses --resume=value with equals separator', () => {
      const args = parseArgs(['node', 'script', '--resume=123e4567-e89b-12d3-a456-426614174000']);
      expect(args.resumeRunId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('parses --help flag', () => {
      const args = parseArgs(['node', 'script', '--help']);
      expect(args.help).toBe(true);
    });

    it('parses short flags -t, -s, -m, -r, -h', () => {
      const args = parseArgs(['node', 'script', '-t', 'news_ingestion', '-s', 'test', '-m', '5', '-r', '123e4567-e89b-12d3-a456-426614174000', '-h']);
      expect(args.type).toBe('news_ingestion');
      expect(args.scope).toBe('test');
      expect(args.maxStages).toBe(5);
      expect(args.resumeRunId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(args.help).toBe(true);
    });

    it('defaults to news_ingestion when type not specified', () => {
      const args = parseArgs(['node', 'script']);
      expect(args.type).toBe('news_ingestion');
    });

    it('defaults maxStages to 10', () => {
      const args = parseArgs(['node', 'script']);
      expect(args.maxStages).toBe(10);
    });

    it('rejects invalid pipeline type', () => {
      expect(() => validateArgs({ type: 'invalid', scope: '', maxStages: 10, runOnce: false, resumeRunId: null, help: false })).toThrow('Invalid pipeline type');
    });

    it('rejects invalid UUID format', () => {
      expect(() => validateArgs({ type: 'news_ingestion', scope: '', maxStages: 10, runOnce: false, resumeRunId: 'invalid', help: false })).toThrow('valid UUID');
    });

    it('rejects negative maxStages', () => {
      expect(() => parseArgs(['node', 'script', '--max-stages', '-1'])).toThrow('positive integer');
    });

    it('rejects zero maxStages', () => {
      expect(() => parseArgs(['node', 'script', '--max-stages', '0'])).toThrow('positive integer');
    });

    it('rejects unknown option', () => {
      expect(() => parseArgs(['node', 'script', '--unknown'])).toThrow('Unknown option');
    });
  });

  describe('printHelp', () => {
    it('prints usage without throwing', () => {
      expect(() => printHelp()).not.toThrow();
    });
  });

  describe('worker execution', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('once mode calls the bounded orchestrator exactly once', async () => {
      const orchestrator = { runPipelineBounded: jest.fn().mockResolvedValue({ runId: 'run-1', processed: 1, status: 'running' }) };
      await runPipelineWorker(['node', 'worker', '--once', '--type=news_ingestion', '--max-stages=1'], { orchestrator });
      expect(orchestrator.runPipelineBounded).toHaveBeenCalledTimes(1);
      expect(orchestrator.runPipelineBounded).toHaveBeenCalledWith('news_ingestion', 'scheduled', { source_scope: 'all' }, 1, expect.any(String), undefined);
    });

    it('scheduled mode calls the same bounded orchestrator exactly once', async () => {
      const orchestrator = { runPipelineBounded: jest.fn().mockResolvedValue({ runId: 'run-1', processed: 2, status: 'running' }) };
      await runPipelineWorker(['node', 'worker', '--type=funding_extraction', '--max-stages=2'], { orchestrator });
      expect(orchestrator.runPipelineBounded).toHaveBeenCalledTimes(1);
      expect(orchestrator.runPipelineBounded).toHaveBeenCalledWith('funding_extraction', 'scheduled', { source_scope: 'all' }, 2, expect.any(String), undefined);
    });

    it('passes the exact resume run ID without creating a run outside the orchestrator', async () => {
      const resumeRunId = '123e4567-e89b-12d3-a456-426614174000';
      const orchestrator = { runPipelineBounded: jest.fn().mockResolvedValue({ runId: resumeRunId, processed: 1, status: 'running' }) };
      await runPipelineWorker(['node', 'worker', `--resume=${resumeRunId}`, '--once'], { orchestrator });
      expect(orchestrator.runPipelineBounded).toHaveBeenCalledTimes(1);
      expect(orchestrator.runPipelineBounded).toHaveBeenCalledWith('news_ingestion', 'scheduled', { source_scope: 'all' }, 10, expect.any(String), resumeRunId);
    });
  });
});
