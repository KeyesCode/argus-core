import { Injectable } from '@nestjs/common';

interface MetricEntry {
  value: number;
  timestamp: number;
}

@Injectable()
export class MetricsService {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private rateHistory = new Map<string, MetricEntry[]>();
  private errors: Array<{ timestamp: Date; worker: string; message: string; context?: string }> = [];

  private readonly maxRateEntries = 120;
  private readonly maxErrors = 100;

  // --- Counters (monotonically increasing) ---

  increment(name: string, amount = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  // --- Gauges (current value) ---

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getGauge(name: string): number {
    return this.gauges.get(name) ?? 0;
  }

  // --- Rate tracking ---

  recordRate(name: string, value: number): void {
    const entries = this.rateHistory.get(name) ?? [];
    entries.push({ value, timestamp: Date.now() });

    // Keep only recent entries
    if (entries.length > this.maxRateEntries) {
      entries.splice(0, entries.length - this.maxRateEntries);
    }

    this.rateHistory.set(name, entries);
  }

  getRatePerMinute(name: string): number {
    const entries = this.rateHistory.get(name);
    if (!entries || entries.length < 2) return 0;

    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const recent = entries.filter((e) => e.timestamp >= oneMinuteAgo);

    if (recent.length === 0) return 0;

    return recent.reduce((sum, e) => sum + e.value, 0);
  }

  // --- Error tracking ---

  recordError(worker: string, message: string, context?: string): void {
    this.errors.push({
      timestamp: new Date(),
      worker,
      message,
      context,
    });

    if (this.errors.length > this.maxErrors) {
      this.errors.splice(0, this.errors.length - this.maxErrors);
    }
  }

  getRecentErrors(limit = 20): typeof this.errors {
    return this.errors.slice(-limit);
  }

  // --- Snapshot ---

  getSnapshot(): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};

    for (const [key, value] of this.counters) {
      snapshot[`counter.${key}`] = value;
    }
    for (const [key, value] of this.gauges) {
      snapshot[`gauge.${key}`] = value;
    }
    for (const [key] of this.rateHistory) {
      snapshot[`rate.${key}_per_min`] = this.getRatePerMinute(key);
    }

    snapshot['errors.recent_count'] = this.errors.length;

    return snapshot;
  }
}
