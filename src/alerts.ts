import pc from "picocolors";
import type { ProcessInfo } from "./process.js";

export interface AlertConfig {
  cpuThreshold?: number; // Percentage (0-100)
  memoryThreshold?: number; // MB
}

export interface Alert {
  timestamp: number;
  pid: number;
  name: string;
  type: "cpu" | "memory";
  value: number;
  threshold: number;
}

// Track which PIDs have active alerts to avoid spamming
const activeAlerts: Map<string, number> = new Map();
const ALERT_COOLDOWN = 30000; // 30 seconds between repeated alerts for same process/type

// Store alert history
const alertHistory: Alert[] = [];

/**
 * Check processes against thresholds and trigger alerts
 */
export function checkAlerts(
  processes: ProcessInfo[],
  config: AlertConfig,
  processNames: Map<number, string>
): Alert[] {
  const newAlerts: Alert[] = [];
  const now = Date.now();

  for (const proc of processes) {
    const displayName = processNames.get(proc.pid) || proc.name;

    // Check CPU threshold
    if (config.cpuThreshold !== undefined && proc.cpu > config.cpuThreshold) {
      const alertKey = `cpu-${proc.pid}`;
      const lastAlert = activeAlerts.get(alertKey);

      if (!lastAlert || now - lastAlert > ALERT_COOLDOWN) {
        const alert: Alert = {
          timestamp: now,
          pid: proc.pid,
          name: displayName,
          type: "cpu",
          value: proc.cpu,
          threshold: config.cpuThreshold,
        };
        newAlerts.push(alert);
        alertHistory.push(alert);
        activeAlerts.set(alertKey, now);
      }
    }

    // Check memory threshold
    if (config.memoryThreshold !== undefined && proc.memoryMB > config.memoryThreshold) {
      const alertKey = `memory-${proc.pid}`;
      const lastAlert = activeAlerts.get(alertKey);

      if (!lastAlert || now - lastAlert > ALERT_COOLDOWN) {
        const alert: Alert = {
          timestamp: now,
          pid: proc.pid,
          name: displayName,
          type: "memory",
          value: proc.memoryMB,
          threshold: config.memoryThreshold,
        };
        newAlerts.push(alert);
        alertHistory.push(alert);
        activeAlerts.set(alertKey, now);
      }
    }
  }

  return newAlerts;
}

/**
 * Format and display alerts
 */
export function displayAlerts(alerts: Alert[]): void {
  for (const alert of alerts) {
    const time = new Date(alert.timestamp).toLocaleTimeString();
    const icon = alert.type === "cpu" ? "CPU" : "MEM";
    const color = pc.bgRed(pc.white(` ALERT `));
    const value =
      alert.type === "cpu"
        ? `${alert.value.toFixed(1)}%`
        : `${alert.value.toFixed(1)} MB`;
    const threshold =
      alert.type === "cpu"
        ? `${alert.threshold}%`
        : `${alert.threshold} MB`;

    // Bell character for terminal notification
    process.stdout.write("\x07");

    console.log(
      `\n${color} ${pc.gray(time)} ${pc.yellow(icon)} ${pc.white(alert.name)} ` +
      `(PID ${alert.pid}) exceeded threshold: ${pc.red(value)} > ${pc.gray(threshold)}`
    );
  }
}

/**
 * Get alert history
 */
export function getAlertHistory(): Alert[] {
  return alertHistory;
}

/**
 * Clear alert history
 */
export function clearAlertHistory(): void {
  alertHistory.length = 0;
  activeAlerts.clear();
}

/**
 * Render alerts summary on exit
 */
export function renderAlertsSummary(): void {
  if (alertHistory.length === 0) {
    return;
  }

  console.log("");
  console.log(pc.bgRed(pc.white(" Alerts Summary ")));
  console.log("");

  // Group by process
  const byProcess = new Map<number, Alert[]>();
  for (const alert of alertHistory) {
    const existing = byProcess.get(alert.pid) || [];
    existing.push(alert);
    byProcess.set(alert.pid, existing);
  }

  console.log(
    pc.bold(
      "  " +
      padRight("PID", 8) +
      padRight("PROCESS", 35) +
      padRight("CPU ALERTS", 12) +
      padRight("MEM ALERTS", 12)
    )
  );
  console.log("  " + pc.gray("─".repeat(67)));

  for (const [pid, alerts] of byProcess) {
    const cpuAlerts = alerts.filter((a) => a.type === "cpu").length;
    const memAlerts = alerts.filter((a) => a.type === "memory").length;
    const name = alerts[0].name.substring(0, 34);

    console.log(
      "  " +
      padRight(String(pid), 8) +
      padRight(name, 35) +
      (cpuAlerts > 0 ? pc.red(padRight(String(cpuAlerts), 12)) : padRight("0", 12)) +
      (memAlerts > 0 ? pc.red(padRight(String(memAlerts), 12)) : padRight("0", 12))
    );
  }

  console.log("");
  console.log(pc.gray(`  Total alerts: ${alertHistory.length}`));
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}
