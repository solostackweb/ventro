import type { PipelineType, StageName } from './types';
import type { StageRegistration } from './orchestrator';

const stageRegistrations = new Map<string, StageRegistration>();

export const PIPELINE_GRAPHS: Record<PipelineType, { stageName: StageName; dependsOn: StageName[] }[]> = {
  news_ingestion: [
    { stageName: 'discover', dependsOn: [] }, { stageName: 'fetch', dependsOn: ['discover'] },
    { stageName: 'archive', dependsOn: ['fetch'] }, { stageName: 'normalize', dependsOn: ['archive'] },
    { stageName: 'extract', dependsOn: ['normalize'] }, { stageName: 'resolve', dependsOn: ['extract'] },
    { stageName: 'verify', dependsOn: ['resolve'] }, { stageName: 'publish', dependsOn: ['verify'] },
  ],
  full_refresh: [
    { stageName: 'discover', dependsOn: [] }, { stageName: 'fetch', dependsOn: ['discover'] },
    { stageName: 'archive', dependsOn: ['fetch'] }, { stageName: 'normalize', dependsOn: ['archive'] },
    { stageName: 'extract', dependsOn: ['normalize'] }, { stageName: 'resolve', dependsOn: ['extract'] },
    { stageName: 'verify', dependsOn: ['resolve'] }, { stageName: 'publish', dependsOn: ['verify'] },
  ],
  funding_extraction: [
    { stageName: 'extract', dependsOn: [] }, { stageName: 'resolve', dependsOn: ['extract'] },
    { stageName: 'verify', dependsOn: ['resolve'] }, { stageName: 'publish', dependsOn: ['verify'] },
  ],
  thesis_extraction: [
    { stageName: 'extract', dependsOn: [] }, { stageName: 'verify', dependsOn: ['extract'] },
  ],
  pattern_detection: [{ stageName: 'extract', dependsOn: [] }],
};

for (const [pipelineType, graph] of Object.entries(PIPELINE_GRAPHS)) {
  if (!graph.length || graph[0].dependsOn.length) throw new Error(`Pipeline ${pipelineType} must start with a dependency-free stage`);
  const names = new Set(graph.map((stage) => stage.stageName));
  for (const stage of graph) {
    for (const dependency of stage.dependsOn) {
      if (!names.has(dependency)) throw new Error(`Pipeline ${pipelineType}: ${stage.stageName} depends on unknown stage ${dependency}`);
    }
  }
}

function registryKey(pipelineType: PipelineType, stageName: StageName): string {
  return `${pipelineType}:${stageName}`;
}

export function registerStage(registration: StageRegistration): void {
  const key = registryKey(registration.pipelineType, registration.stageName);
  if (stageRegistrations.has(key)) throw new Error(`Stage already registered for ${key}`);
  stageRegistrations.set(key, registration);
}

export function getStageRegistration(pipelineType: PipelineType, stageName: StageName): StageRegistration | undefined {
  return stageRegistrations.get(registryKey(pipelineType, stageName));
}

export function getPipelineGraph(pipelineType: PipelineType) {
  const graph = PIPELINE_GRAPHS[pipelineType];
  if (!graph) throw new Error(`No graph defined for pipeline type: ${pipelineType}`);
  return graph;
}

export function getStagesForPipeline(pipelineType: PipelineType): StageRegistration[] {
  return getPipelineGraph(pipelineType)
    .map(({ stageName }) => getStageRegistration(pipelineType, stageName))
    .filter((registration): registration is StageRegistration => Boolean(registration));
}

export const getStagesForPipelineOrdered = getStagesForPipeline;

export function getAllRegisteredStages(): StageRegistration[] {
  return Array.from(stageRegistrations.values());
}
