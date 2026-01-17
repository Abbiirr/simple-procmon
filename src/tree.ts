import pc from "picocolors";
import psList from "ps-list";
import type { ProcessInfo } from "./process.js";
import { extractScriptName, formatScriptName } from "./process.js";

export interface ProcessTreeNode {
  pid: number;
  ppid: number;
  name: string;
  cmd?: string;
  displayName: string;
  cpu: number;
  memoryMB: number;
  children: ProcessTreeNode[];
  depth: number;
}

/**
 * Build a process tree from a flat list of processes
 */
export function buildProcessTree(
  processes: ProcessInfo[],
  allProcesses: psList.ProcessDescriptor[]
): ProcessTreeNode[] {
  // Create a map of PID -> process info
  const processMap = new Map<number, ProcessInfo>();
  for (const proc of processes) {
    processMap.set(proc.pid, proc);
  }

  // Create a map of PID -> all processes (for parent lookup)
  const allProcessMap = new Map<number, psList.ProcessDescriptor>();
  for (const proc of allProcesses) {
    allProcessMap.set(proc.pid, proc);
  }

  // Build tree nodes
  const nodes = new Map<number, ProcessTreeNode>();
  const roots: ProcessTreeNode[] = [];

  for (const proc of processes) {
    const scriptName = extractScriptName(proc.cmd);
    const displayName = scriptName
      ? formatScriptName(scriptName, 55)
      : proc.name;

    const node: ProcessTreeNode = {
      pid: proc.pid,
      ppid: allProcessMap.get(proc.pid)?.ppid ?? 0,
      name: proc.name,
      cmd: proc.cmd,
      displayName,
      cpu: proc.cpu,
      memoryMB: proc.memoryMB,
      children: [],
      depth: 0,
    };
    nodes.set(proc.pid, node);
  }

  // Link children to parents
  for (const node of nodes.values()) {
    const parent = nodes.get(node.ppid);
    if (parent) {
      parent.children.push(node);
      node.depth = parent.depth + 1;
    } else {
      // No parent in our filtered set - this is a root
      roots.push(node);
    }
  }

  // Sort children by CPU usage (descending)
  const sortChildren = (node: ProcessTreeNode) => {
    node.children.sort((a, b) => b.cpu - a.cpu);
    for (const child of node.children) {
      sortChildren(child);
    }
  };

  for (const root of roots) {
    sortChildren(root);
  }

  // Sort roots by CPU usage
  roots.sort((a, b) => b.cpu - a.cpu);

  return roots;
}

/**
 * Flatten tree into displayable rows with proper indentation
 */
export function flattenTree(roots: ProcessTreeNode[]): ProcessTreeNode[] {
  const result: ProcessTreeNode[] = [];

  const traverse = (node: ProcessTreeNode, depth: number) => {
    node.depth = depth;
    result.push(node);
    for (const child of node.children) {
      traverse(child, depth + 1);
    }
  };

  for (const root of roots) {
    traverse(root, 0);
  }

  return result;
}

/**
 * Get tree prefix characters for a node
 */
export function getTreePrefix(node: ProcessTreeNode, isLast: boolean): string {
  if (node.depth === 0) return "";

  const prefix = "  ".repeat(node.depth - 1);
  const connector = isLast ? "└─ " : "├─ ";

  return pc.gray(prefix + connector);
}

/**
 * Render the process tree view
 */
export function renderTreeView(
  roots: ProcessTreeNode[],
  processType: string,
  filterPattern?: string
): void {
  const CURSOR_HOME = "\x1b[H";
  const CLEAR_LINE = "\x1b[2K";
  const HIDE_CURSOR = "\x1b[?25l";

  process.stdout.write(HIDE_CURSOR + CURSOR_HOME);

  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(pc.bgCyan(pc.black(" Process Tree ")) + " " + pc.gray(`[${processType}]`));
  if (filterPattern) {
    lines.push(pc.gray(`  Filter: "${filterPattern}"`));
  }
  lines.push("");

  if (roots.length === 0) {
    lines.push(pc.yellow("  No matching processes found."));
    lines.push(pc.gray("  Waiting for processes to start..."));
    lines.push("");
  } else {
    // Header row
    lines.push(
      "  " +
      pc.bold(
        padRight("TREE", 65) +
        padRight("PID", 10) +
        padRight("CPU", 12) +
        padRight("MEMORY", 12)
      )
    );
    lines.push("  " + pc.gray("─".repeat(99)));

    // Flatten and render
    const flat = flattenTree(roots);

    for (let i = 0; i < flat.length; i++) {
      const node = flat[i];

      // Determine if this is the last sibling
      const isLast = isLastSibling(node, flat, i);

      const prefix = getTreePrefix(node, isLast);
      const nameWithPrefix = prefix + node.displayName;
      const truncatedName = nameWithPrefix.substring(0, 64);

      const cpuColor = node.cpu < 30 ? pc.green : node.cpu < 70 ? pc.yellow : pc.red;
      const memColor = node.memoryMB < 200 ? pc.green : node.memoryMB < 500 ? pc.yellow : pc.red;

      lines.push(
        "  " +
        padRight(truncatedName, 65) +
        padRight(String(node.pid), 10) +
        cpuColor(padRight(node.cpu.toFixed(1) + "%", 12)) +
        memColor(padRight(node.memoryMB.toFixed(1) + " MB", 12))
      );
    }

    lines.push("");

    // Summary
    const totalCPU = flat.reduce((a, n) => a + n.cpu, 0);
    const totalMem = flat.reduce((a, n) => a + n.memoryMB, 0);
    lines.push(
      pc.gray(
        `  ${flat.length} process(es) | ` +
        `Total CPU: ${totalCPU.toFixed(1)}% | ` +
        `Total Memory: ${totalMem.toFixed(0)} MB | ` +
        `Press Ctrl+C to stop`
      )
    );
  }

  lines.push("");

  // Output
  for (const line of lines) {
    process.stdout.write(CLEAR_LINE + line + "\n");
  }
}

/**
 * Check if a node is the last sibling at its depth
 */
function isLastSibling(
  node: ProcessTreeNode,
  flat: ProcessTreeNode[],
  index: number
): boolean {
  for (let i = index + 1; i < flat.length; i++) {
    if (flat[i].depth < node.depth) return true;
    if (flat[i].depth === node.depth) return false;
  }
  return true;
}

function padRight(str: string, len: number): string {
  // Handle ANSI codes when padding
  const visibleLength = str.replace(/\x1b\[[0-9;]*m/g, "").length;
  const padding = Math.max(0, len - visibleLength);
  return str + " ".repeat(padding);
}
