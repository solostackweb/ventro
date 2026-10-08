/**
 * Evidence Foundation Module — Checkpoint 1 (With Repository)
 * Includes database operations — requires service-role credentials.
 * Use this in production ingestion workers.
 */

import { evidenceCore as pureCore } from './core';
import { evidenceRepository, type EvidenceRepository } from './repository';

export * from './index';
export { evidenceRepository, type EvidenceRepository } from './repository';

export const evidenceCore = {
  ...pureCore,
  repository: evidenceRepository,
};