/**
 * Budget Guards & Metrics Aggregation — Checkpoint 2
 * Server-only module for provider/model budget tracking and cost controls.
 * Do not import in browser code.
 */

import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { pipelineLogger } from './logging';

export interface BudgetConfig {
  maxCostUsdPerRun: number;
  maxCostUsdPerStage: Record<string, number>;
  maxTokensPerRun: number;
  maxLatencyMsPerStage: Record<string, number>;
  alertThresholds: {
    costUsdPercent: number;
    tokensPercent: number;
    latencyPercent: number;
  };
}

export interface BudgetState {
  runId: string;
  totalCostUsd: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  stageCosts: Record<string, number>;
  stageTokens: Record<string, { input: number; output: number }>;
  stageLatency: Record<string, number>;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  type: 'cost' | 'tokens' | 'latency';
  level: 'warning' | 'critical';
  message: string;
  stage?: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
}

export interface ProviderBudget {
  provider: string;
  model: string;
  maxDailyCostUsd: number;
  maxDailyTokens: number;
  currentDailyCostUsd: number;
  currentDailyTokens: number;
  lastReset: string;
}

const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  maxCostUsdPerRun: 10.00,
  maxCostUsdPerStage: {
    discover: 0.10,
    fetch: 0.50,
    archive: 0.10,
    normalize: 0.50,
    extract: 5.00,
    resolve: 0.50,
    verify: 0.10,
    publish: 0.10,
  },
  maxTokensPerRun: 1_000_000,
  maxLatencyMsPerStage: {
    discover: 60_000,
    fetch: 300_000,
    archive: 60_000,
    normalize: 300_000,
    extract: 600_000,
    resolve: 60_000,
    verify: 60_000,
    publish: 60_000,
  },
  alertThresholds: {
    costUsdPercent: 80,
    tokensPercent: 80,
    latencyPercent: 80,
  },
};

export class BudgetGuard {
  private config: BudgetConfig;
  private state: BudgetState;
  private providerBudgets: Map<string, ProviderBudget> = new Map();

  constructor(runId: string, config: Partial<BudgetConfig> = {}) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
    this.state = {
      runId,
      totalCostUsd: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      stageCosts: {},
      stageTokens: {},
      stageLatency: {},
      alerts: [],
    };
  }

  recordModelRun(
    stage: string,
    provider: string,
    model: string,
    tokensInput: number,
    tokensOutput: number,
    costUsd: number,
    latencyMs: number
  ): void {
    this.state.totalCostUsd += costUsd;
    this.state.totalTokensInput += tokensInput;
    this.state.totalTokensOutput += tokensOutput;

    this.state.stageCosts[stage] = (this.state.stageCosts[stage] || 0) + costUsd;
    this.state.stageTokens[stage] = {
      input: (this.state.stageTokens[stage]?.input || 0) + tokensInput,
      output: (this.state.stageTokens[stage]?.output || 0) + tokensOutput,
    };
    this.state.stageLatency[stage] = (this.state.stageLatency[stage] || 0) + latencyMs;

    // Check stage budget
    const stageCostLimit = this.config.maxCostUsdPerStage[stage];
    if (stageCostLimit && this.state.stageCosts[stage] > stageCostLimit) {
      this.addAlert('cost', 'critical', `Stage ${stage} exceeded cost budget`, stage, this.state.stageCosts[stage], stageCostLimit);
    } else if (stageCostLimit && this.state.stageCosts[stage] > stageCostLimit * (this.config.alertThresholds.costUsdPercent / 100)) {
      this.addAlert('cost', 'warning', `Stage ${stage} approaching cost budget`, stage, this.state.stageCosts[stage], stageCostLimit * (this.config.alertThresholds.costUsdPercent / 100));
    }

    // Check stage latency
    const stageLatencyLimit = this.config.maxLatencyMsPerStage[stage];
    if (stageLatencyLimit && this.state.stageLatency[stage] > stageLatencyLimit) {
      this.addAlert('latency', 'critical', `Stage ${stage} exceeded latency budget`, stage, this.state.stageLatency[stage], stageLatencyLimit);
    } else if (stageLatencyLimit && this.state.stageLatency[stage] > stageLatencyLimit * (this.config.alertThresholds.latencyPercent / 100)) {
      this.addAlert('latency', 'warning', `Stage ${stage} approaching latency budget`, stage, this.state.stageLatency[stage], stageLatencyLimit * (this.config.alertThresholds.latencyPercent / 100));
    }

    // Update provider budget
    const providerKey = `${provider}:${model}`;
    let providerBudget = this.providerBudgets.get(providerKey);
    if (!providerBudget) {
      providerBudget = {
        provider,
        model,
        maxDailyCostUsd: 50.00,
        maxDailyTokens: 5_000_000,
        currentDailyCostUsd: 0,
        currentDailyTokens: 0,
        lastReset: new Date().toISOString().split('T')[0],
      };
      this.providerBudgets.set(providerKey, providerBudget);
    }

    // Reset daily budget if new day
    const today = new Date().toISOString().split('T')[0];
    if (providerBudget.lastReset !== today) {
      providerBudget.currentDailyCostUsd = 0;
      providerBudget.currentDailyTokens = 0;
      providerBudget.lastReset = today;
    }

    providerBudget.currentDailyCostUsd += costUsd;
    providerBudget.currentDailyTokens += tokensInput + tokensOutput;

    if (providerBudget.currentDailyCostUsd > providerBudget.maxDailyCostUsd) {
      this.addAlert('cost', 'critical', `Provider ${providerKey} exceeded daily cost budget`, stage, providerBudget.currentDailyCostUsd, providerBudget.maxDailyCostUsd);
    }
  }

  private addAlert(
    type: 'cost' | 'tokens' | 'latency',
    level: 'warning' | 'critical',
    message: string,
    stage: string | undefined,
    currentValue: number,
    threshold: number
  ): void {
    const alert: BudgetAlert = {
      type,
      level,
      message,
      stage,
      currentValue,
      threshold,
      timestamp: new Date().toISOString(),
    };

    this.state.alerts.push(alert);

    if (level === 'critical') {
      pipelineLogger.error(`Budget alert: ${message}`, {
        event: 'budget_alert',
        alert_type: type,
        alert_level: level,
        stage,
        current_value: currentValue,
        threshold,
      });
    } else {
      pipelineLogger.warn(`Budget alert: ${message}`, {
        event: 'budget_alert',
        alert_type: type,
        alert_level: level,
        stage,
        current_value: currentValue,
        threshold,
      });
    }
  }

  checkRunBudget(): { allowed: boolean; reason?: string } {
    if (this.state.totalCostUsd > this.config.maxCostUsdPerRun) {
      return { allowed: false, reason: `Run exceeded total cost budget: $${this.state.totalCostUsd.toFixed(4)} > $${this.config.maxCostUsdPerRun.toFixed(4)}` };
    }

    const totalTokens = this.state.totalTokensInput + this.state.totalTokensOutput;
    if (totalTokens > this.config.maxTokensPerRun) {
      return { allowed: false, reason: `Run exceeded total token budget: ${totalTokens} > ${this.config.maxTokensPerRun}` };
    }

    return { allowed: true };
  }

  getState(): BudgetState {
    return { ...this.state };
  }

  getProviderBudgets(): ProviderBudget[] {
    return Array.from(this.providerBudgets.values());
  }

  getAlerts(): BudgetAlert[] {
    return [...this.state.alerts];
  }

  async persistMetrics(): Promise<void> {
    const { error } = await ingestionSupabase
      .from('model_run_budget_snapshots')
      .upsert({
        run_id: this.state.runId,
        total_cost_usd: this.state.totalCostUsd,
        total_tokens_input: this.state.totalTokensInput,
        total_tokens_output: this.state.totalTokensOutput,
        stage_costs: this.state.stageCosts,
        stage_tokens: this.state.stageTokens,
        stage_latency: this.state.stageLatency,
        alerts: this.state.alerts,
        provider_budgets: Object.fromEntries(this.providerBudgets),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'run_id' });

    if (error) {
      pipelineLogger.error(`Failed to persist budget metrics: ${error.message}`, {
        event: 'budget_persist_failed',
        error: error.message,
      });
    }
  }
}

export function createBudgetGuard(runId: string, config?: Partial<BudgetConfig>): BudgetGuard {
  return new BudgetGuard(runId, config);
}

export function getDefaultBudgetConfig(): BudgetConfig {
  return { ...DEFAULT_BUDGET_CONFIG };
}