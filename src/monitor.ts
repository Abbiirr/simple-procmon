import { getProcesses, extractScriptName, formatScriptName, getProcessStats, getProcessCommandLine } from "./process.js";
import { renderTable, renderSummary, showCursor, renderTraceView, renderTraceGraphs, type ProcessHistory } from "./display.js";
import { exportToJSON, exportTraceToCSV, formatDuration } from "./export.js";
import { startWebServer, updateWebState, setWebStartTime } from "./web.js";
import { checkAlerts, displayAlerts, renderAlertsSummary, type AlertConfig } from "./alerts.js";
import { buildProcessTree, renderTreeView } from "./tree.js";
import { isDockerAvailable, getDockerContainers, displayDockerStatus } from "./docker.js";
import pc from "picocolors";
import psList from "ps-list";

export interface MonitorOptions {
  processType: string;
  processNames: string[];
  filterPattern?: string;
  interval: number;
  exportOnExit: boolean;
  webPort?: number;
  treeView?: boolean;
  alertCpu?: number;
  alertMemory?: number;
  dockerOnly?: boolean;
}

export interface TraceOptions {
  pid: number;
  interval: number;
  exportOnExit: boolean;
}

export interface TraceHistory {
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

let isRunning = false;
let history: Map<number, ProcessHistory> = new Map();
let startTime: number;

/**
 * Start the monitoring loop
 */
export async function startMonitor(options: MonitorOptions): Promise<void> {
  const {
    processType,
    processNames,
    filterPattern,
    interval,
    exportOnExit,
    webPort,
    treeView,
    alertCpu,
    alertMemory,
    dockerOnly,
  } = options;

  isRunning = true;
  startTime = Date.now();
  history = new Map();

  // Docker mode setup
  let dockerPids: number[] = [];
  if (dockerOnly) {
    if (!isDockerAvailable()) {
      console.error(pc.red("  Error: Docker is not available or not running"));
      process.exit(1);
    }
    displayDockerStatus();
  }

  // Alert configuration
  const alertConfig: AlertConfig = {};
  if (alertCpu !== undefined) {
    alertConfig.cpuThreshold = alertCpu;
    console.log(pc.yellow(`  Alert: CPU threshold set to ${alertCpu}%`));
  }
  if (alertMemory !== undefined) {
    alertConfig.memoryThreshold = alertMemory;
    console.log(pc.yellow(`  Alert: Memory threshold set to ${alertMemory} MB`));
  }

  // Start web server if requested
  if (webPort) {
    await startWebServer(webPort);
    setWebStartTime(startTime);
  }

  // Setup signal handlers
  const cleanup = () => {
    isRunning = false;
    showCursor();

    console.log("");
    console.log(
      pc.gray(`  Monitored for ${formatDuration(Date.now() - startTime)}`)
    );

    renderSummary(history);

    // Show alerts summary if alerts were configured
    if (alertCpu !== undefined || alertMemory !== undefined) {
      renderAlertsSummary();
    }

    if (exportOnExit) {
      exportToJSON(history, processType, filterPattern, startTime);
    }

    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Initial render
  console.log(pc.gray("  Starting monitor..."));

  // Main loop
  while (isRunning) {
    try {
      // Get all processes for tree view
      const allProcesses = treeView ? await psList() : [];

      // Get filtered processes
      let processes = await getProcesses(processNames, filterPattern);

      // Docker filtering
      if (dockerOnly) {
        const containers = getDockerContainers();
        dockerPids = containers.map((c) => c.pid);
        processes = processes.filter((p) => dockerPids.includes(p.pid));
      }

      // Update history
      for (const proc of processes) {
        let hist = history.get(proc.pid);

        if (!hist) {
          // Use script name if available, otherwise process name
          const scriptName = extractScriptName(proc.cmd);
          const displayName = scriptName
            ? formatScriptName(scriptName, 59)
            : proc.name;

          hist = {
            pid: proc.pid,
            name: displayName,
            cmd: proc.cmd,
            samples: 0,
            cpuHistory: [],
            memoryHistory: [],
            peakMemory: 0,
            peakCPU: 0,
          };
          history.set(proc.pid, hist);
        }

        hist.samples++;
        hist.cpuHistory.push(proc.cpu);
        hist.memoryHistory.push(proc.memoryMB);
        hist.peakMemory = Math.max(hist.peakMemory, proc.memoryMB);
        hist.peakCPU = Math.max(hist.peakCPU, proc.cpu);

        // Keep history bounded to prevent memory growth
        const maxHistory = 100;
        if (hist.cpuHistory.length > maxHistory) {
          hist.cpuHistory = hist.cpuHistory.slice(-maxHistory);
        }
        if (hist.memoryHistory.length > maxHistory) {
          hist.memoryHistory = hist.memoryHistory.slice(-maxHistory);
        }
      }

      // Check alerts
      if (alertCpu !== undefined || alertMemory !== undefined) {
        const processNameMap = new Map<number, string>();
        for (const [pid, hist] of history) {
          processNameMap.set(pid, hist.name);
        }
        const alerts = checkAlerts(processes, alertConfig, processNameMap);
        if (alerts.length > 0) {
          displayAlerts(alerts);
        }
      }

      // Update web state if web server is running
      if (webPort) {
        updateWebState(processes, history, processType, filterPattern);
      }

      // Render the display (tree view or table view)
      if (treeView) {
        const tree = buildProcessTree(processes, allProcesses);
        renderTreeView(tree, processType, filterPattern);
      } else {
        renderTable(processes, history, processType, filterPattern);
      }

      // Wait for next interval
      await sleep(interval);
    } catch (error) {
      console.error(pc.red(`Error: ${error}`));
      await sleep(interval);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stop the monitor
 */
export function stopMonitor(): void {
  isRunning = false;
}

/**
 * Get current history
 */
export function getHistory(): Map<number, ProcessHistory> {
  return history;
}

/**
 * Start tracing a specific PID
 */
export async function startTrace(options: TraceOptions): Promise<void> {
  const { pid, interval, exportOnExit } = options;

  isRunning = true;
  const traceStartTime = Date.now();

  // Get initial process info
  const processes = await psList();
  const proc = processes.find((p) => p.pid === pid);

  if (!proc) {
    console.error(pc.red(`  Error: Process with PID ${pid} not found`));
    process.exit(1);
  }

  // Get command line (use WMIC on Windows since ps-list doesn't provide it)
  const cmdLine = proc.cmd || getProcessCommandLine(pid);

  // Extract script name - use longer display for trace mode
  const scriptName = extractScriptName(cmdLine);
  const displayName = scriptName
    ? formatScriptName(scriptName, 80)
    : proc.name;

  const traceHistory: TraceHistory = {
    pid,
    name: displayName,
    cmd: cmdLine,
    startTime: traceStartTime,
    timestamps: [],
    cpuHistory: [],
    memoryHistory: [],
    peakCPU: 0,
    peakMemory: 0,
  };

  // Setup signal handlers
  const cleanup = () => {
    isRunning = false;
    showCursor();

    console.log("");
    console.log(
      pc.gray(`  Traced PID ${pid} for ${formatDuration(Date.now() - traceStartTime)}`)
    );

    // Render full graphs
    renderTraceGraphs(traceHistory);

    if (exportOnExit) {
      exportTraceToCSV(traceHistory);
    }

    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  console.log(pc.gray(`  Tracing PID ${pid}: ${displayName}`));
  console.log(pc.gray(`  Press Ctrl+C to stop and see full graphs\n`));

  // Main loop
  while (isRunning) {
    try {
      const stats = await getProcessStats([pid]);
      const stat = stats[pid];

      if (!stat) {
        // Process may have exited
        console.log(pc.yellow(`\n  Process ${pid} has exited.`));
        cleanup();
        return;
      }

      const now = Date.now();
      const cpu = stat.cpu ?? 0;
      const memoryMB = (stat.memory ?? 0) / (1024 * 1024);

      // Store in history (no truncation for trace mode)
      traceHistory.timestamps.push(now);
      traceHistory.cpuHistory.push(cpu);
      traceHistory.memoryHistory.push(memoryMB);
      traceHistory.peakCPU = Math.max(traceHistory.peakCPU, cpu);
      traceHistory.peakMemory = Math.max(traceHistory.peakMemory, memoryMB);

      // Render live view
      renderTraceView(traceHistory, interval);

      await sleep(interval);
    } catch (error) {
      console.error(pc.red(`Error: ${error}`));
      await sleep(interval);
    }
  }
}
