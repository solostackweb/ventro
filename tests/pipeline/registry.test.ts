/**
 * Registry Tests — Checkpoint 2
 * Tests the real stage registry and pipeline graphs.
 */

jest.mock('@/lib/ingestion/rss-fetcher', () => ({ loadApprovedConnectors: jest.fn(), runIngestionForSource: jest.fn() }));
jest.mock('@/lib/ingestion/story-clustering', () => ({ runStoryClustering: jest.fn() }));
jest.mock('@/lib/ingestion/funding-extractor', () => ({ extractFundingEvidence: jest.fn() }));
jest.mock('@/lib/ingestion/pattern-detector', () => ({ detectPatterns: jest.fn() }));
jest.mock('@/lib/ingestion/thesis-extractor', () => ({ extractStatedThesisForAllFunds: jest.fn(), computeObservedThesisForAllFunds: jest.fn() }));
jest.mock('@/lib/ingestion/entity-sync', () => ({ syncTrackedEntities: jest.fn() }));
jest.mock('@/lib/intelligence/evidence/with-repository', () => ({ evidenceCore: {} }));
jest.mock('@/lib/supabase/ingestion', () => ({ ingestionSupabase: { from: jest.fn(), rpc: jest.fn() } }));

import { registerStage, getStageRegistration, getStagesForPipeline, getPipelineGraph, getAllRegisteredStages } from '@/lib/pipeline/registry';
import { PipelineType, StageName, STAGE_DEFINITIONS } from '@/lib/pipeline/types';
import '@/lib/pipeline/stage-handlers';

describe('Pipeline Registry', () => {
  beforeEach(() => {
    // Clear registry before each test
    // Note: In real implementation, we'd need a way to reset the registry
    // For now, we test against the actual registrations
  });

  describe('Pipeline Graphs', () => {
    it('news_ingestion graph has 8 stages in correct order', () => {
      const graph = getPipelineGraph('news_ingestion');
      expect(graph).toHaveLength(8);
      expect(graph[0].stageName).toBe('discover');
      expect(graph[1].stageName).toBe('fetch');
      expect(graph[2].stageName).toBe('archive');
      expect(graph[3].stageName).toBe('normalize');
      expect(graph[4].stageName).toBe('extract');
      expect(graph[5].stageName).toBe('resolve');
      expect(graph[6].stageName).toBe('verify');
      expect(graph[7].stageName).toBe('publish');
    });

    it('full_refresh graph has 8 stages in correct order', () => {
      const graph = getPipelineGraph('full_refresh');
      expect(graph).toHaveLength(8);
      expect(graph[0].stageName).toBe('discover');
      expect(graph[1].stageName).toBe('fetch');
      expect(graph[2].stageName).toBe('archive');
      expect(graph[3].stageName).toBe('normalize');
      expect(graph[4].stageName).toBe('extract');
      expect(graph[5].stageName).toBe('resolve');
      expect(graph[6].stageName).toBe('verify');
      expect(graph[7].stageName).toBe('publish');
    });

    it('funding_extraction graph has 4 stages starting at extract', () => {
      const graph = getPipelineGraph('funding_extraction');
      expect(graph).toHaveLength(4);
      expect(graph[0].stageName).toBe('extract');
      expect(graph[1].stageName).toBe('resolve');
      expect(graph[2].stageName).toBe('verify');
      expect(graph[3].stageName).toBe('publish');
    });

    it('thesis_extraction graph has 2 stages', () => {
      const graph = getPipelineGraph('thesis_extraction');
      expect(graph).toHaveLength(2);
      expect(graph[0].stageName).toBe('extract');
      expect(graph[1].stageName).toBe('verify');
    });

    it('pattern_detection graph has 1 stage', () => {
      const graph = getPipelineGraph('pattern_detection');
      expect(graph).toHaveLength(1);
      expect(graph[0].stageName).toBe('extract');
    });

    it('entity_sync graph has one bounded stage', () => {
      const graph = getPipelineGraph('entity_sync');
      expect(graph).toEqual([{ stageName: 'extract', dependsOn: [] }]);
    });

    it('first stage of each graph has zero dependencies', () => {
      const types: PipelineType[] = ['news_ingestion', 'full_refresh', 'funding_extraction', 'thesis_extraction', 'pattern_detection', 'entity_sync'];
      for (const type of types) {
        const graph = getPipelineGraph(type);
        expect(graph[0].dependsOn).toHaveLength(0);
      }
    });

    it('dependencies reference valid stages in same pipeline', () => {
      const types: PipelineType[] = ['news_ingestion', 'full_refresh', 'funding_extraction', 'thesis_extraction', 'pattern_detection', 'entity_sync'];
      for (const type of types) {
        const graph = getPipelineGraph(type);
        const stageNames = new Set(graph.map(s => s.stageName));
        for (const stage of graph) {
          for (const dep of stage.dependsOn) {
            expect(stageNames.has(dep)).toBe(true);
          }
        }
      }
    });
  });

  describe('Stage Registration', () => {
    it('registers stages per (pipelineType, stageName) key', () => {
      const registration = getStageRegistration('news_ingestion', 'discover');
      expect(registration).toBeDefined();
      expect(registration?.pipelineType).toBe('news_ingestion');
      expect(registration?.stageName).toBe('discover');
      expect(registration?.handler).toBeDefined();
    });

    it('rejects duplicate registration for same (pipelineType, stageName)', () => {
      expect(() => {
        registerStage({
          pipelineType: 'news_ingestion',
          stageName: 'discover',
          definition: STAGE_DEFINITIONS.discover,
          handler: async () => ({ outputRef: {}, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0, costUsd: 0 }),
        });
      }).toThrow('already registered');
    });

    it('allows same stageName for different pipelineTypes', () => {
      const newsExtract = getStageRegistration('news_ingestion', 'extract');
      const fundingExtract = getStageRegistration('funding_extraction', 'extract');
      const thesisExtract = getStageRegistration('thesis_extraction', 'extract');
      const patternExtract = getStageRegistration('pattern_detection', 'extract');

      expect(newsExtract).toBeDefined();
      expect(fundingExtract).toBeDefined();
      expect(thesisExtract).toBeDefined();
      expect(patternExtract).toBeDefined();

      expect(newsExtract?.pipelineType).toBe('news_ingestion');
      expect(fundingExtract?.pipelineType).toBe('funding_extraction');
      expect(thesisExtract?.pipelineType).toBe('thesis_extraction');
    });

    it('getStagesForPipeline returns stages in dependency order', () => {
      const stages = getStagesForPipeline('news_ingestion');
      const stageNames = stages.map(s => s.stageName);
      expect(stageNames).toEqual(['discover', 'fetch', 'archive', 'normalize', 'extract', 'resolve', 'verify', 'publish']);
    });

    it('getStagesForPipeline returns only stages for that pipeline type', () => {
      const fundingStages = getStagesForPipeline('funding_extraction');
      expect(fundingStages.every(s => s.pipelineType === 'funding_extraction')).toBe(true);
      expect(fundingStages.length).toBe(4);
    });
  });
});
