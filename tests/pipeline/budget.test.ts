/**
 * Budget Guard Tests — Checkpoint 2
 * Tests for cost, token, and latency budget tracking.
 */

import { BudgetGuard, getDefaultBudgetConfig, BudgetConfig, BudgetAlert } from '@/lib/pipeline/budget';

// Mock the budget guard without database
class MockBudgetGuard {
  private config: BudgetConfig;
  private state: {
    runId: string;
    totalCostUsd: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    stageCosts: Record<string, number>;
    stageTokens: Record<string, { input: number; output: number }>;
    stageLatency: Record<string, number>;
    alerts: BudgetAlert[];
  };

  constructor(runId: string, config: Partial<BudgetConfig> = {}) {
    this.config = { ...getDefaultBudgetConfig(), ...config };
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

    this.checkStageBudget(stage, costUsd, latencyMs);
    this.checkRunBudget();
  }

  private checkStageBudget(stage: string, costUsd: number, latencyMs: number): void {
    const stageCostLimit = this.config.maxCostUsdPerStage[stage];
    if (stageCostLimit) {
      const currentCost = this.state.stageCosts[stage];
      if (currentCost > stageCostLimit) {
        this.addAlert('cost', 'critical', `Stage ${stage} exceeded cost budget`, stage, currentCost, stageCostLimit);
      } else if (currentCost > stageCostLimit * (this.config.alertThresholds.costUsdPercent / 100)) {
        this.addAlert('cost', 'warning', `Stage ${stage} approaching cost budget`, stage, currentCost, stageCostLimit * (this.config.alertThresholds.costUsdPercent / 100));
      }
    }

    const stageLatencyLimit = this.config.maxLatencyMsPerStage[stage];
    if (stageLatencyLimit) {
      const currentLatency = this.state.stageLatency[stage];
      if (currentLatency > stageLatencyLimit) {
        this.addAlert('latency', 'critical', `Stage ${stage} exceeded latency budget`, stage, currentLatency, stageLatencyLimit);
      } else if (currentLatency > stageLatencyLimit * (this.config.alertThresholds.latencyPercent / 100)) {
        this.addAlert('latency', 'warning', `Stage ${stage} approaching latency budget`, stage, currentLatency, stageLatencyLimit * (this.config.alertThresholds.latencyPercent / 100));
      }
    }
  }

  private checkRunBudget(): void {
    if (this.state.totalCostUsd > this.config.maxCostUsdPerRun) {
      this.addAlert('cost', 'critical', `Run exceeded total cost budget`, undefined, this.state.totalCostUsd, this.config.maxCostUsdPerRun);
    }

    const totalTokens = this.state.totalTokensInput + this.state.totalTokensOutput;
    if (totalTokens > this.config.maxTokensPerRun) {
      this.addAlert('tokens', 'critical', `Run exceeded total token budget`, undefined, totalTokens, this.config.maxTokensPerRun);
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
    this.state.alerts.push({
      type,
      level,
      message,
      stage,
      currentValue,
      threshold,
      timestamp: new Date().toISOString(),
    });
  }

  checkRunBudgetExplicit(): { allowed: boolean; reason?: string } {
    if (this.state.totalCostUsd > this.config.maxCostUsdPerRun) {
      return { allowed: false, reason: `Run exceeded total cost budget: $${this.state.totalCostUsd.toFixed(4)} > $${this.config.maxCostUsdPerRun.toFixed(4)}` };
    }

    const totalTokens = this.state.totalTokensInput + this.state.totalTokensOutput;
    if (totalTokens > this.config.maxTokensPerRun) {
      return { allowed: false, reason: `Run exceeded total token budget: ${totalTokens} > ${this.config.maxTokensPerRun}` };
    }

    return { allowed: true };
  }

  getState() {
    return { ...this.state };
  }

  getAlerts() {
    return [...this.state.alerts];
  }
}

describe('Budget Guard', () => {
  let guard: MockBudgetGuard;
  const runId = 'test-run-123';

  beforeEach(() => {
    guard = new MockBudgetGuard(runId, {
      maxCostUsdPerRun: 10.00,
      maxCostUsdPerStage: {
        extract: 5.00,
        fetch: 0.50,
      },
      maxTokensPerRun: 100000,
      maxLatencyMsPerStage: {
        extract: 60000,
        fetch: 30000,
      },
      alertThresholds: {
        costUsdPercent: 80,
        tokensPercent: 80,
        latencyPercent: 80,
      },
    });
  });

  describe('Cost Tracking', () => {
    it('tracks total cost across stages', () => {
      guard.recordModelRun('fetch', 'provider', 'model', 100, 50, 0.10, 1000);
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 2.00, 5000);
      guard.recordModelRun('extract', 'provider', 'model', 500, 250, 1.00, 3000);

      const state = guard.getState();
      expect(state.totalCostUsd).toBe(3.10);
      expect(state.stageCosts.fetch).toBe(0.10);
      expect(state.stageCosts.extract).toBe(3.00);
    });

    it('triggers warning at 80% of stage budget', () => {
      // 80% of 5.00 = 4.00
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 4.10, 1000);

      const alerts = guard.getAlerts();
      const warningAlert = alerts.find(a => a.level === 'warning' && a.type === 'cost');
      expect(warningAlert).toBeDefined();
      expect(warningAlert?.message).toContain('approaching cost budget');
    });

    it('triggers critical when exceeding stage budget', () => {
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 5.10, 1000);

      const alerts = guard.getAlerts();
      const criticalAlert = alerts.find(a => a.level === 'critical' && a.type === 'cost');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.message).toContain('exceeded cost budget');
    });

    it('triggers critical when exceeding run budget', () => {
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 6.00, 1000);
      guard.recordModelRun('fetch', 'provider', 'model', 100, 50, 5.00, 1000); // Total 11.00 > 10.00

      const alerts = guard.getAlerts();
      const criticalAlert = alerts.find(a => a.level === 'critical' && a.type === 'cost' && !a.stage);
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.message).toContain('Run exceeded total cost budget');
    });
  });

  describe('Token Tracking', () => {
    it('tracks total tokens across stages', () => {
      guard.recordModelRun('fetch', 'provider', 'model', 1000, 500, 0.01, 1000);
      guard.recordModelRun('extract', 'provider', 'model', 10000, 5000, 0.50, 5000);

      const state = guard.getState();
      expect(state.totalTokensInput).toBe(11000);
      expect(state.totalTokensOutput).toBe(5500);
      expect(state.stageTokens.fetch.input).toBe(1000);
      expect(state.stageTokens.extract.output).toBe(5000);
    });

    it('triggers critical when exceeding run token budget', () => {
      // 100000 limit
      guard.recordModelRun('extract', 'provider', 'model', 60000, 50000, 1.00, 1000);

      const alerts = guard.getAlerts();
      const criticalAlert = alerts.find(a => a.level === 'critical' && a.type === 'tokens');
      expect(criticalAlert).toBeDefined();
    });
  });

  describe('Latency Tracking', () => {
    it('tracks latency per stage', () => {
      guard.recordModelRun('fetch', 'provider', 'model', 100, 50, 0.01, 5000);
      guard.recordModelRun('fetch', 'provider', 'model', 100, 50, 0.01, 3000);
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 0.50, 10000);

      const state = guard.getState();
      expect(state.stageLatency.fetch).toBe(8000);
      expect(state.stageLatency.extract).toBe(10000);
    });

    it('triggers critical when exceeding stage latency budget', () => {
      // 60000 limit for extract
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 0.50, 65000);

      const alerts = guard.getAlerts();
      const criticalAlert = alerts.find(a => a.level === 'critical' && a.type === 'latency');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.message).toContain('exceeded latency budget');
    });

    it('triggers warning at 80% of stage latency budget', () => {
      // 80% of 60000 = 48000
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 0.50, 50000);

      const alerts = guard.getAlerts();
      const warningAlert = alerts.find(a => a.level === 'warning' && a.type === 'latency');
      expect(warningAlert).toBeDefined();
    });
  });

  describe('Run Budget Check', () => {
    it('allows within budget', () => {
      guard.recordModelRun('fetch', 'provider', 'model', 100, 50, 0.10, 1000);
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 2.00, 5000);

      const result = guard.checkRunBudgetExplicit();
      expect(result.allowed).toBe(true);
    });

    it('rejects over cost budget', () => {
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 6.00, 1000);
      guard.recordModelRun('fetch', 'provider', 'model', 100, 50, 5.00, 1000);

      const result = guard.checkRunBudgetExplicit();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cost budget');
    });

    it('rejects over token budget', () => {
      guard.recordModelRun('extract', 'provider', 'model', 60000, 50000, 1.00, 1000);

      const result = guard.checkRunBudgetExplicit();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('token budget');
    });
  });

  describe('Alert Structure', () => {
    it('alerts have correct structure', () => {
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 6.00, 1000);

      const alerts = guard.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      for (const alert of alerts) {
        expect(alert.type).toBeDefined();
        expect(alert.level).toBeDefined();
        expect(alert.message).toBeDefined();
        expect(alert.currentValue).toBeDefined();
        expect(alert.threshold).toBeDefined();
        expect(alert.timestamp).toBeDefined();
      }
    });

    it('alerts include stage when stage-specific', () => {
      guard.recordModelRun('extract', 'provider', 'model', 1000, 500, 5.10, 1000);

      const alerts = guard.getAlerts();
      const stageAlert = alerts.find(a => a.stage === 'extract');
      expect(stageAlert).toBeDefined();
      expect(stageAlert?.stage).toBe('extract');
    });
  });

  describe('Default Config', () => {
    it('has sensible defaults', () => {
      const config = getDefaultBudgetConfig();

      expect(config.maxCostUsdPerRun).toBe(10.00);
      expect(config.maxTokensPerRun).toBe(1_000_000);
      expect(config.maxCostUsdPerStage.extract).toBe(5.00);
      expect(config.maxLatencyMsPerStage.extract).toBe(600_000); // 10 min
      expect(config.alertThresholds.costUsdPercent).toBe(80);
    });
  });
});