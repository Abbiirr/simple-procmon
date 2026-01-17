import pc from "picocolors";

const SPARKLINE_CHARS = " _.:=+*#";
const BAR_FILLED = "#";
const BAR_EMPTY = "-";

/**
 * Generate an ASCII bar chart
 * @param value Current value
 * @param max Maximum value for scaling
 * @param width Width of the bar in characters
 * @returns Formatted bar string like "[####----]"
 */
export function getBar(value: number, max: number, width: number = 10): string {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  const bar = BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(empty);
  return `[${bar}]`;
}

/**
 * Generate a colored bar based on memory thresholds
 * @param memoryMB Memory in megabytes
 * @param max Maximum for scaling
 * @param width Width of the bar
 * @returns Colored bar string
 */
export function getColoredMemoryBar(
  memoryMB: number,
  max: number,
  width: number = 10
): string {
  const bar = getBar(memoryMB, max, width);

  if (memoryMB < 200) {
    return pc.green(bar);
  } else if (memoryMB < 500) {
    return pc.yellow(bar);
  } else {
    return pc.red(bar);
  }
}

/**
 * Generate a colored bar for CPU usage
 * @param cpu CPU percentage
 * @param width Width of the bar
 * @returns Colored bar string
 */
export function getColoredCPUBar(cpu: number, width: number = 10): string {
  const bar = getBar(cpu, 100, width);

  if (cpu < 30) {
    return pc.green(bar);
  } else if (cpu < 70) {
    return pc.yellow(bar);
  } else {
    return pc.red(bar);
  }
}

/**
 * Generate a sparkline from an array of values
 * @param values Array of numeric values
 * @param maxPoints Maximum number of points to display
 * @returns Sparkline string
 */
export function getSparkline(values: number[], maxPoints: number = 20): string {
  if (values.length === 0) return "";

  // Take last N values
  const points = values.slice(-maxPoints);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  return points
    .map((v) => {
      const normalized = (v - min) / range;
      const index = Math.round(normalized * (SPARKLINE_CHARS.length - 1));
      return SPARKLINE_CHARS[index];
    })
    .join("");
}

/**
 * Generate a colored sparkline based on current trend
 * @param values Array of numeric values
 * @param maxPoints Maximum number of points
 * @returns Colored sparkline string
 */
export function getColoredSparkline(
  values: number[],
  maxPoints: number = 20
): string {
  const sparkline = getSparkline(values, maxPoints);

  if (values.length < 2) return sparkline;

  // Compare last value to average to determine trend color
  const last = values[values.length - 1];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  if (last > avg * 1.2) {
    return pc.red(sparkline);
  } else if (last < avg * 0.8) {
    return pc.green(sparkline);
  }
  return pc.gray(sparkline);
}

/**
 * Format a mini trend indicator
 * @param current Current value
 * @param previous Previous value
 * @returns Trend arrow with color
 */
export function getTrendIndicator(current: number, previous: number): string {
  if (current > previous * 1.05) {
    return pc.red("↑");
  } else if (current < previous * 0.95) {
    return pc.green("↓");
  }
  return pc.gray("→");
}
