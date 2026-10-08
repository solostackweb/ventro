/**
 * Pipeline Orchestration Module — Checkpoint 2
 * Server-only module for durable, resumable pipeline execution.
 * Do not import in browser code.
 */

export * from './types';
export * from './errors';
export * from './logging';
export * from './budget';
export * from './lease-client';
export * from './pipeline-client';
export * from './registry';
export * from './orchestrator';

// Import stage handlers to register them
import './stage-handlers';

// Re-export key functions
export {
  registerStage,
  getStagesForPipeline,
  getStageRegistration,
  getPipelineGraph,
  getAllRegisteredStages,
} from './registry';

export { createPipelineOrchestrator } from './orchestrator';

export { PipelineOrchestrator } from './orchestrator';
export { PipelineClient, createPipelineClient } from './pipeline-client';
export { LeaseClient, createLeaseClient } from './lease-client';
export { BudgetGuard, createBudgetGuard } from './budget';
