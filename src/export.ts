import { writeFileSync } from "fs";
import pc from "picocolors";
import type { ProcessHistory } from "./display.js";

export interface ExportData {
  timestamp: string;
  processType: string;
  filterPattern?: string;
  duration: number;
  processes: ExportProcess[];
}

export interface ExportProcess {
  pid: number;
  name: string;
  cmd?: string;
  samples: number;
  avgCPU: number;
  peakCPU: number;
  avgMemoryMB: number;
  peakMemoryMB: number;
  cpuHistory: number[];
  memoryHistory: number[];
}

/**
 * Export monitoring history to a JSON file
 */
export function exportToJSON(
  history: Map<number, ProcessHistory>,
  processType: string,
  filterPattern: string | undefined,
  startTime: number
): string {
  const timestamp = new Date().toISOString();
  const duration = Date.now() - startTime;

  const processes: ExportProcess[] = [];

  for (const [pid, hist] of history) {
    const avgCPU =
      hist.cpuHistory.length > 0
        ? hist.cpuHistory.reduce((a, b) => a + b, 0) / hist.cpuHistory.length
        : 0;

    const avgMemory =
      hist.memoryHistory.length > 0
        ? hist.memoryHistory.reduce((a, b) => a + b, 0) / hist.memoryHistory.length
        : 0;

    processes.push({
      pid,
      name: hist.name,
      cmd: hist.cmd,
      samples: hist.samples,
      avgCPU: Math.round(avgCPU * 100) / 100,
      peakCPU: Math.round(hist.peakCPU * 100) / 100,
      avgMemoryMB: Math.round(avgMemory * 100) / 100,
      peakMemoryMB: Math.round(hist.peakMemory * 100) / 100,
      cpuHistory: hist.cpuHistory.map((v) => Math.round(v * 100) / 100),
      memoryHistory: hist.memoryHistory.map((v) => Math.round(v * 100) / 100),
    });
  }

  const data: ExportData = {
    timestamp,
    processType,
    filterPattern,
    duration,
    processes,
  };

  // Generate filename with timestamp
  const dateStr = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `procmon-${dateStr}.json`;

  try {
    writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(pc.green(`\n  Exported to ${filename}`));
    return filename;
  } catch (error) {
    console.error(pc.red(`\n  Failed to export: ${error}`));
    return "";
  }
}

/**
 * Format duration in human readable form
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Trace history interface (to avoid circular imports)
interface TraceHistoryData {
  pid: number;
  name: string;
  cmd?: string;
  startTime: number;
  timestamps: number[];
  cpuHistory: number[];
  memoryHistory: number[];
  peakCPU: number;
  peakMemory: number;
}

/**
 * Export trace history to CSV file
 */
export function exportTraceToCSV(trace: TraceHistoryData): string {
  const dateStr = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `trace-${trace.pid}-${dateStr}.csv`;

  const lines: string[] = [];

  // Header
  lines.push("timestamp,elapsed_ms,cpu_percent,memory_mb");

  // Data rows
  for (let i = 0; i < trace.timestamps.length; i++) {
    const elapsed = trace.timestamps[i] - trace.startTime;
    const cpu = trace.cpuHistory[i].toFixed(2);
    const mem = trace.memoryHistory[i].toFixed(2);
    lines.push(`${trace.timestamps[i]},${elapsed},${cpu},${mem}`);
  }

  try {
    writeFileSync(filename, lines.join("\n"));
    console.log(pc.green(`  Exported to ${filename}`));
    return filename;
  } catch (error) {
    console.error(pc.red(`  Failed to export: ${error}`));
    return "";
  }
}
