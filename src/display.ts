import pc from "picocolors";
import type { ProcessInfo } from "./process.js";
import { formatMemory, formatCPU, extractScriptName, formatScriptName } from "./process.js";
import {
  getColoredMemoryBar,
  getColoredCPUBar,
  getColoredSparkline,
  getTrendIndicator,
} from "./charts.js";

export interface ProcessHistory {
  pid: number;
  name: string;
  cmd?: string;
  samples: number;
  cpuHistory: number[];
  memoryHistory: number[];
  peakMemory: number;
  peakCPU: number;
}

// ANSI escape codes for cursor control
const ESC = "\x1b";
const CLEAR_SCREEN = `${ESC}[2J`;
const CURSOR_HOME = `${ESC}[H`;
const CLEAR_LINE = `${ESC}[2K`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;

let lastLineCount = 0;

/**
 * Move cursor to home position and prepare for redraw
 */
export function prepareScreen(): void {
  process.stdout.write(HIDE_CURSOR + CURSOR_HOME);
}

/**
 * Clear remaining lines from previous render
 */
export function clearRemainingLines(currentLines: number): void {
  if (currentLines < lastLineCount) {
    for (let i = 0; i < lastLineCount - currentLines; i++) {
      process.stdout.write(CLEAR_LINE + "\n");
    }
    // Move cursor back up
    process.stdout.write(`${ESC}[${lastLineCount - currentLines}A`);
  }
  lastLineCount = currentLines;
}

/**
 * Show cursor on exit
 */
export function showCursor(): void {
  process.stdout.write(SHOW_CURSOR);
}

/**
 * Render the process monitoring table
 */
export function renderTable(
  processes: ProcessInfo[],
  history: Map<number, ProcessHistory>,
  processType: string,
  filterPattern?: string
): void {
  prepareScreen();

  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(pc.bgCyan(pc.black(" Process Monitor ")) + " " + pc.gray(`[${processType}]`));
  if (filterPattern) {
    lines.push(pc.gray(`  Filter: "${filterPattern}"`));
  }
  lines.push("");

  if (processes.length === 0) {
    lines.push(pc.yellow("  No matching processes found."));
    lines.push(pc.gray("  Waiting for processes to start..."));
    lines.push("");
  } else {
    // Find max memory for scaling bars
    const maxMemory = Math.max(...processes.map((p) => p.memoryMB), 100);

    // Table header
    const header =
      pc.bold(
        padRight("PID", 8) +
        padRight("SCRIPT/PROCESS", 45) +
        padRight("CPU", 10) +
        padRight("CPU BAR", 14) +
        padRight("MEMORY", 12) +
        padRight("MEM BAR", 14) +
        "TREND"
      );
    lines.push("  " + header);
    lines.push("  " + pc.gray("─".repeat(115)));

    // Process rows
    for (const proc of processes) {
      const hist = history.get(proc.pid);
      const prevMemory = hist && hist.memoryHistory.length > 1
        ? hist.memoryHistory[hist.memoryHistory.length - 2]
        : proc.memoryMB;

      const memoryColor = getMemoryColor(proc.memoryMB);
      const cpuColor = getCPUColor(proc.cpu);

      // Extract script name from command, fall back to process name
      const scriptName = extractScriptName(proc.cmd);
      const displayName = scriptName
        ? formatScriptName(scriptName, 44)
        : proc.name.substring(0, 44);

      const row =
        padRight(String(proc.pid), 8) +
        padRight(displayName, 45) +
        cpuColor(padRight(formatCPU(proc.cpu), 10)) +
        getColoredCPUBar(proc.cpu, 10) + "  " +
        memoryColor(padRight(formatMemory(proc.memory), 12)) +
        getColoredMemoryBar(proc.memoryMB, maxMemory, 10) + "  " +
        getTrendIndicator(proc.memoryMB, prevMemory);

      lines.push("  " + row);

      // Sparkline row if we have history
      if (hist && hist.memoryHistory.length > 1) {
        const sparkline = getColoredSparkline(hist.memoryHistory, 30);
        lines.push("  " + pc.gray("        ") + sparkline);
      }
    }

    lines.push("");
    lines.push(
      pc.gray(`  ${processes.length} process(es) | Press Ctrl+C to stop`)
    );
  }

  lines.push("");

  // Output all lines
  for (const line of lines) {
    process.stdout.write(CLEAR_LINE + line + "\n");
  }

  clearRemainingLines(lines.length);
}

/**
 * Render the summary table on exit
 */
export function renderSummary(history: Map<number, ProcessHistory>): void {
  showCursor();

  console.log("");
  console.log(pc.bgMagenta(pc.black(" Session Summary ")));
  console.log("");

  if (history.size === 0) {
    console.log(pc.gray("  No processes were monitored."));
    return;
  }

  // Header
  console.log(
    pc.bold(
      "  " +
      padRight("PID", 8) +
      padRight("SCRIPT/PROCESS", 47) +
      padRight("SAMPLES", 10) +
      padRight("AVG CPU", 12) +
      padRight("PEAK CPU", 12) +
      padRight("AVG MEM", 12) +
      padRight("PEAK MEM", 12)
    )
  );
  console.log("  " + pc.gray("─".repeat(112)));

  for (const [pid, hist] of history) {
    const avgCPU =
      hist.cpuHistory.reduce((a, b) => a + b, 0) / hist.cpuHistory.length;
    const avgMemory =
      hist.memoryHistory.reduce((a, b) => a + b, 0) / hist.memoryHistory.length;

    const row =
      padRight(String(pid), 8) +
      padRight(hist.name.substring(0, 46), 47) +
      padRight(String(hist.samples), 10) +
      padRight(formatCPU(avgCPU), 12) +
      padRight(formatCPU(hist.peakCPU), 12) +
      padRight(formatMemory(avgMemory * 1024 * 1024), 12) +
      padRight(formatMemory(hist.peakMemory * 1024 * 1024), 12);

    console.log("  " + row);
  }

  console.log("");
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function getMemoryColor(memoryMB: number): (str: string) => string {
  if (memoryMB < 200) return pc.green;
  if (memoryMB < 500) return pc.yellow;
  return pc.red;
}

function getCPUColor(cpu: number): (str: string) => string {
  if (cpu < 30) return pc.green;
  if (cpu < 70) return pc.yellow;
  return pc.red;
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
 * Render live trace view during tracing
 */
export function renderTraceView(trace: TraceHistoryData, interval: number): void {
  prepareScreen();

  const lines: string[] = [];
  const samples = trace.cpuHistory.length;
  const elapsed = samples > 0 ? (Date.now() - trace.startTime) / 1000 : 0;

  const currentCPU = trace.cpuHistory[samples - 1] ?? 0;
  const currentMem = trace.memoryHistory[samples - 1] ?? 0;
  const avgCPU = samples > 0 ? trace.cpuHistory.reduce((a, b) => a + b, 0) / samples : 0;
  const avgMem = samples > 0 ? trace.memoryHistory.reduce((a, b) => a + b, 0) / samples : 0;

  lines.push("");
  lines.push(pc.bgMagenta(pc.black(" PID Trace ")) + " " + pc.gray(`[${trace.pid}]`));
  lines.push(pc.cyan(`  ${trace.name}`));
  lines.push("");

  // Current stats
  lines.push(pc.bold("  Current"));
  lines.push(`    CPU:    ${getCPUColor(currentCPU)(currentCPU.toFixed(1).padStart(6) + "%")}  ${getColoredCPUBar(currentCPU, 20)}`);
  lines.push(`    Memory: ${getMemoryColor(currentMem)((currentMem.toFixed(1) + " MB").padStart(10))}  ${getColoredMemoryBar(currentMem, Math.max(trace.peakMemory, 100), 20)}`);
  lines.push("");

  // Stats summary
  lines.push(pc.bold("  Statistics"));
  lines.push(`    Samples: ${samples}  |  Elapsed: ${elapsed.toFixed(0)}s  |  Interval: ${interval}ms`);
  lines.push(`    CPU:     avg ${avgCPU.toFixed(1)}%  |  peak ${trace.peakCPU.toFixed(1)}%`);
  lines.push(`    Memory:  avg ${avgMem.toFixed(1)} MB  |  peak ${trace.peakMemory.toFixed(1)} MB`);
  lines.push("");

  // Mini sparklines
  const recentCPU = trace.cpuHistory.slice(-60);
  const recentMem = trace.memoryHistory.slice(-60);

  lines.push(pc.bold("  Recent History") + pc.gray(` (last ${recentCPU.length} samples)`));
  lines.push(`    CPU:    ${getColoredSparkline(recentCPU, 60)}`);
  lines.push(`    Memory: ${getColoredSparkline(recentMem, 60)}`);
  lines.push("");

  lines.push(pc.gray("  Press Ctrl+C to stop and see full graphs"));
  lines.push("");

  for (const line of lines) {
    process.stdout.write(CLEAR_LINE + line + "\n");
  }

  clearRemainingLines(lines.length);
}

/**
 * Render full ASCII graphs on trace exit
 */
export function renderTraceGraphs(trace: TraceHistoryData): void {
  showCursor();

  const samples = trace.cpuHistory.length;
  if (samples === 0) {
    console.log(pc.yellow("  No data collected."));
    return;
  }

  const avgCPU = trace.cpuHistory.reduce((a, b) => a + b, 0) / samples;
  const avgMem = trace.memoryHistory.reduce((a, b) => a + b, 0) / samples;
  const minMem = Math.min(...trace.memoryHistory);
  const maxMem = Math.max(...trace.memoryHistory);
  const minCPU = Math.min(...trace.cpuHistory);
  const maxCPU = Math.max(...trace.cpuHistory);

  console.log("");
  console.log(pc.bgMagenta(pc.black(" Trace Summary ")));
  console.log("");
  console.log(pc.cyan(`  PID: ${trace.pid}`));
  console.log(pc.cyan(`  Process: ${trace.name}`));
  if (trace.cmd) {
    const cmd = trace.cmd.length > 90 ? "..." + trace.cmd.slice(-87) : trace.cmd;
    console.log(pc.gray(`  Command: ${cmd}`));
  }
  console.log("");

  // Statistics table
  console.log(pc.bold("  Statistics"));
  console.log(pc.gray("  " + "─".repeat(50)));
  console.log(`    Total Samples:  ${samples}`);
  console.log(`    Duration:       ${((trace.timestamps[samples - 1] - trace.startTime) / 1000).toFixed(1)}s`);
  console.log("");
  console.log(`    CPU:    min ${minCPU.toFixed(1).padStart(6)}%  avg ${avgCPU.toFixed(1).padStart(6)}%  max ${maxCPU.toFixed(1).padStart(6)}%`);
  console.log(`    Memory: min ${minMem.toFixed(1).padStart(6)} MB  avg ${avgMem.toFixed(1).padStart(6)} MB  max ${maxMem.toFixed(1).padStart(6)} MB`);
  console.log("");

  // ASCII graphs
  const graphWidth = 70;
  const graphHeight = 12;

  // CPU Graph
  console.log(pc.bold("  CPU Usage (%)"));
  console.log(pc.gray("  " + "─".repeat(graphWidth + 10)));
  renderASCIIGraph(trace.cpuHistory, graphWidth, graphHeight, 0, Math.max(maxCPU, 100), "%");

  console.log("");

  // Memory Graph
  console.log(pc.bold("  Memory Usage (MB)"));
  console.log(pc.gray("  " + "─".repeat(graphWidth + 10)));
  renderASCIIGraph(trace.memoryHistory, graphWidth, graphHeight, Math.max(0, minMem - 10), maxMem + 10, " MB");

  console.log("");
}

/**
 * Render an ASCII graph
 */
function renderASCIIGraph(
  data: number[],
  width: number,
  height: number,
  minVal: number,
  maxVal: number,
  unit: string
): void {
  if (data.length === 0) return;

  const range = maxVal - minVal || 1;

  // Downsample data if needed
  let samples: number[];
  if (data.length > width) {
    samples = [];
    const step = data.length / width;
    for (let i = 0; i < width; i++) {
      const start = Math.floor(i * step);
      const end = Math.floor((i + 1) * step);
      const slice = data.slice(start, end);
      samples.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
  } else {
    samples = data;
  }

  // Build the graph
  const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

  for (let row = height - 1; row >= 0; row--) {
    const rowMin = minVal + (range * row) / height;
    const rowMax = minVal + (range * (row + 1)) / height;
    const rowMid = (rowMin + rowMax) / 2;

    // Y-axis label
    const label = row === height - 1 ? maxVal.toFixed(0) : row === 0 ? minVal.toFixed(0) : "";
    process.stdout.write(pc.gray(`  ${label.padStart(6)}${unit.padEnd(3)} │`));

    // Graph row
    for (let col = 0; col < samples.length; col++) {
      const val = samples[col];
      if (val >= rowMax) {
        process.stdout.write(pc.green("█"));
      } else if (val > rowMin) {
        const fraction = (val - rowMin) / (rowMax - rowMin);
        const charIndex = Math.min(Math.floor(fraction * chars.length), chars.length - 1);
        process.stdout.write(pc.green(chars[charIndex]));
      } else {
        process.stdout.write(" ");
      }
    }
    process.stdout.write("\n");
  }

  // X-axis
  process.stdout.write(pc.gray("         └" + "─".repeat(samples.length) + "\n"));
  process.stdout.write(pc.gray(`          0${" ".repeat(samples.length - 10)}${data.length} samples\n`));
}
