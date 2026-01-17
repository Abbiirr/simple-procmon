import psList from "ps-list";
import pidusage from "pidusage";
import { execSync } from "child_process";

const isWindows = process.platform === "win32";

// Cache for Windows command lines (to avoid calling wmic too often)
let cmdLineCache: Map<number, string> = new Map();
let lastCmdLineFetch = 0;
const CMD_LINE_CACHE_TTL = 5000; // 5 seconds

/**
 * Get command lines for processes on Windows using WMIC
 */
function getWindowsCommandLines(pids: number[]): Map<number, string> {
  const now = Date.now();

  // Return cache if still fresh
  if (now - lastCmdLineFetch < CMD_LINE_CACHE_TTL && cmdLineCache.size > 0) {
    return cmdLineCache;
  }

  try {
    const output = execSync('wmic process get ProcessId,CommandLine /format:csv', {
      encoding: 'utf-8',
      timeout: 5000,
      windowsHide: true,
    });

    const newCache = new Map<number, string>();
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('Node,')) continue;

      // CSV format: Node,CommandLine,ProcessId
      const lastComma = trimmed.lastIndexOf(',');
      if (lastComma === -1) continue;

      const pidStr = trimmed.slice(lastComma + 1).trim();
      const pid = parseInt(pidStr, 10);
      if (isNaN(pid)) continue;

      // Get command line (everything between first comma and last comma)
      const firstComma = trimmed.indexOf(',');
      if (firstComma === -1 || firstComma >= lastComma) continue;

      const cmdLine = trimmed.slice(firstComma + 1, lastComma).trim();
      if (cmdLine) {
        newCache.set(pid, cmdLine);
      }
    }

    cmdLineCache = newCache;
    lastCmdLineFetch = now;
    return cmdLineCache;
  } catch {
    return cmdLineCache; // Return old cache on error
  }
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd?: string;
  cpu: number;
  memory: number;
  memoryMB: number;
}

export interface ProcessStats {
  pid: number;
  cpu: number;
  memory: number;
  elapsed: number;
  timestamp: number;
}

export async function getProcesses(
  processNames: string[],
  filterPattern?: string
): Promise<ProcessInfo[]> {
  try {
    const processes = await psList();

    // Filter by process name
    const filtered = processes.filter((proc) => {
      const procName = proc.name.toLowerCase();
      const matches = processNames.some((name) =>
        procName === name.toLowerCase() ||
        procName.startsWith(name.toLowerCase())
      );

      if (!matches) return false;

      // Apply command filter if specified
      if (filterPattern && proc.cmd) {
        return proc.cmd.toLowerCase().includes(filterPattern.toLowerCase());
      }

      return true;
    });

    if (filtered.length === 0) {
      return [];
    }

    // Get CPU/memory stats for filtered processes
    const pids = filtered.map((p) => p.pid);
    const stats = await getProcessStats(pids);

    // On Windows, get command lines via WMIC since ps-list doesn't provide them
    let windowsCmdLines: Map<number, string> | null = null;
    if (isWindows) {
      windowsCmdLines = getWindowsCommandLines(pids);
    }

    return filtered.map((proc) => {
      const stat = stats[proc.pid];
      // Use Windows command line if available, otherwise fall back to ps-list cmd
      const cmd = (isWindows && windowsCmdLines?.get(proc.pid)) || proc.cmd;

      // Apply filter using the actual command line
      if (filterPattern && cmd) {
        if (!cmd.toLowerCase().includes(filterPattern.toLowerCase())) {
          return null;
        }
      }

      return {
        pid: proc.pid,
        name: proc.name,
        cmd,
        cpu: stat?.cpu ?? 0,
        memory: stat?.memory ?? 0,
        memoryMB: (stat?.memory ?? 0) / (1024 * 1024),
      };
    }).filter((p): p is ProcessInfo => p !== null);
  } catch (error) {
    console.error("Error getting processes:", error);
    return [];
  }
}

export async function getProcessStats(
  pids: number[]
): Promise<Record<number, ProcessStats>> {
  try {
    if (pids.length === 0) return {};
    const stats = await pidusage(pids);
    return stats as Record<number, ProcessStats>;
  } catch (error) {
    // Some processes might have exited
    return {};
  }
}

/**
 * Get command line for a specific PID (uses WMIC on Windows)
 */
export function getProcessCommandLine(pid: number): string | undefined {
  if (!isWindows) {
    return undefined; // On non-Windows, ps-list provides cmd
  }

  const cmdLines = getWindowsCommandLines([pid]);
  return cmdLines.get(pid);
}

export function formatCommand(cmd: string | undefined, maxLength: number = 50): string {
  if (!cmd) return "-";

  // Truncate and add ellipsis if too long
  if (cmd.length > maxLength) {
    return cmd.substring(0, maxLength - 3) + "...";
  }

  return cmd;
}

/**
 * Extract script/file path from a command line
 * Looks for common script extensions like .py, .js, .ts, .rb, .php, etc.
 */
export function extractScriptName(cmd: string | undefined): string | undefined {
  if (!cmd) return undefined;

  const extensions = 'py|pyw|js|ts|mjs|cjs|jsx|tsx|rb|php|pl|sh|ps1|bat|cmd';

  // Common script extensions to look for
  const scriptPatterns = [
    // Handle quoted paths (Windows or Unix)
    new RegExp(`"([^"]+\\.(?:${extensions}))"`, 'i'),
    new RegExp(`'([^']+\\.(?:${extensions}))'`, 'i'),
    // Handle Windows paths with drive letters (C:\path\to\script.py)
    new RegExp(`([A-Za-z]:[\\\\\/][^\\s"']+\\.(?:${extensions}))`, 'i'),
    // Handle Unix-style paths (/path/to/script.py)
    new RegExp(`(\\/[^\\s"']+\\.(?:${extensions}))`, 'i'),
    // Handle relative paths or just filenames
    new RegExp(`([^\\s"'\\\\\/]+\\.(?:${extensions}))(?:\\s|$|")`, 'i'),
  ];

  for (const pattern of scriptPatterns) {
    const match = cmd.match(pattern);
    if (match && match[1]) {
      // Clean up any trailing quotes
      return match[1].replace(/["']+$/, '');
    }
  }

  return undefined;
}

/**
 * Format script name, truncating from start if too long
 */
export function formatScriptName(scriptPath: string | undefined, maxLength: number = 40): string {
  if (!scriptPath) return "";

  if (scriptPath.length <= maxLength) {
    return scriptPath;
  }

  // Truncate from start, keeping the end (most relevant part)
  return "..." + scriptPath.slice(-(maxLength - 3));
}

export function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  }
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function formatCPU(cpu: number): string {
  return `${cpu.toFixed(1)}%`;
}
