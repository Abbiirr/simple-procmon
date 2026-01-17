import pc from "picocolors";
import type { ProcessInfo } from "./process.js";
import type { ProcessHistory } from "./display.js";

interface WebServerState {
  processes: ProcessInfo[];
  history: Map<number, ProcessHistory>;
  processType: string;
  filterPattern?: string;
  startTime: number;
}

let state: WebServerState = {
  processes: [],
  history: new Map(),
  processType: "",
  startTime: Date.now(),
};

/**
 * Update web server state with latest process data
 */
export function updateWebState(
  processes: ProcessInfo[],
  history: Map<number, ProcessHistory>,
  processType: string,
  filterPattern?: string
): void {
  state.processes = processes;
  state.history = history;
  state.processType = processType;
  state.filterPattern = filterPattern;
}

/**
 * Set the start time for the web server
 */
export function setWebStartTime(time: number): void {
  state.startTime = time;
}

/**
 * Generate HTML dashboard
 */
function generateHTML(): string {
  const uptime = Math.floor((Date.now() - state.startTime) / 1000);
  const processRows = state.processes
    .map((proc) => {
      const hist = state.history.get(proc.pid);
      const cpuColor = proc.cpu < 30 ? "#22c55e" : proc.cpu < 70 ? "#eab308" : "#ef4444";
      const memColor = proc.memoryMB < 200 ? "#22c55e" : proc.memoryMB < 500 ? "#eab308" : "#ef4444";
      const cpuBar = Math.min(proc.cpu, 100);
      const memBar = Math.min((proc.memoryMB / 1000) * 100, 100);

      return `
        <tr>
          <td>${proc.pid}</td>
          <td class="process-name" title="${proc.cmd || proc.name}">${hist?.name || proc.name}</td>
          <td>
            <div class="bar-container">
              <div class="bar" style="width: ${cpuBar}%; background: ${cpuColor};"></div>
            </div>
            <span style="color: ${cpuColor}">${proc.cpu.toFixed(1)}%</span>
          </td>
          <td>
            <div class="bar-container">
              <div class="bar" style="width: ${memBar}%; background: ${memColor};"></div>
            </div>
            <span style="color: ${memColor}">${proc.memoryMB.toFixed(1)} MB</span>
          </td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="2">
  <title>procmon-cli Web UI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      background: #0f172a;
      color: #e2e8f0;
      padding: 20px;
      min-height: 100vh;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #334155;
    }
    h1 {
      font-size: 1.5rem;
      color: #38bdf8;
    }
    .meta {
      color: #94a3b8;
      font-size: 0.875rem;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: #1e293b;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    .stat-label {
      color: #94a3b8;
      font-size: 0.75rem;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #f8fafc;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #1e293b;
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #334155;
    }
    th {
      background: #0f172a;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
    }
    tr:hover {
      background: #334155;
    }
    .process-name {
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bar-container {
      width: 100px;
      height: 8px;
      background: #334155;
      border-radius: 4px;
      overflow: hidden;
      display: inline-block;
      margin-right: 10px;
      vertical-align: middle;
    }
    .bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .empty {
      text-align: center;
      padding: 40px;
      color: #94a3b8;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #64748b;
      font-size: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>procmon-cli</h1>
    <div class="meta">
      Monitoring: <strong>${state.processType}</strong>
      ${state.filterPattern ? `| Filter: <strong>${state.filterPattern}</strong>` : ""}
    </div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Processes</div>
      <div class="stat-value">${state.processes.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Uptime</div>
      <div class="stat-value">${Math.floor(uptime / 60)}m ${uptime % 60}s</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total CPU</div>
      <div class="stat-value">${state.processes.reduce((a, p) => a + p.cpu, 0).toFixed(1)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Memory</div>
      <div class="stat-value">${state.processes.reduce((a, p) => a + p.memoryMB, 0).toFixed(0)} MB</div>
    </div>
  </div>

  ${
    state.processes.length === 0
      ? '<div class="empty">No matching processes found. Waiting...</div>'
      : `
  <table>
    <thead>
      <tr>
        <th>PID</th>
        <th>Process/Script</th>
        <th>CPU</th>
        <th>Memory</th>
      </tr>
    </thead>
    <tbody>
      ${processRows}
    </tbody>
  </table>
  `
  }

  <div class="footer">
    Auto-refreshes every 2 seconds | Press Ctrl+C in terminal to stop
  </div>
</body>
</html>`;
}

/**
 * Generate JSON API response
 */
function generateJSON(): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    processType: state.processType,
    filterPattern: state.filterPattern,
    uptime: Date.now() - state.startTime,
    processes: state.processes.map((p) => ({
      pid: p.pid,
      name: state.history.get(p.pid)?.name || p.name,
      cmd: p.cmd,
      cpu: Math.round(p.cpu * 100) / 100,
      memoryMB: Math.round(p.memoryMB * 100) / 100,
    })),
  });
}

/**
 * Start the web server
 */
export async function startWebServer(port: number = 3000): Promise<void> {
  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/processes") {
        return new Response(generateJSON(), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(generateHTML(), {
        headers: { "Content-Type": "text/html" },
      });
    },
  });

  console.log(pc.green(`  Web UI started at http://localhost:${port}`));
  console.log(pc.gray(`  API endpoint: http://localhost:${port}/api/processes`));
  console.log("");
}
