import pc from "picocolors";

// Unicode block characters for smooth bars
const BLOCK_CHARS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
const FULL_BLOCK = "█";
const EMPTY_BLOCK = "░";

// Sparkline characters (vertical bars)
const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/**
 * Generate a smooth Unicode bar chart
 * @param value Current value
 * @param max Maximum value for scaling
 * @param width Width of the bar in characters
 * @returns Formatted bar string with Unicode blocks
 */
export function getBar(value: number, max: number, width: number = 10): string {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const totalUnits = ratio * width;
  const fullBlocks = Math.floor(totalUnits);
  const remainder = totalUnits - fullBlocks;
  const partialIndex = Math.round(remainder * (BLOCK_CHARS.length - 1));
  const emptyBlocks = width - fullBlocks - (partialIndex > 0 ? 1 : 0);

  let bar = FULL_BLOCK.repeat(fullBlocks);
  if (partialIndex > 0 && fullBlocks < width) {
    bar += BLOCK_CHARS[partialIndex];
  }
  bar += EMPTY_BLOCK.repeat(Math.max(0, emptyBlocks));

  return bar;
}

/**
 * Generate a gradient colored bar based on value thresholds
 * Green → Yellow → Red gradient
 */
function getGradientBar(
  value: number,
  max: number,
  width: number,
  lowThreshold: number,
  highThreshold: number
): string {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const totalUnits = ratio * width;
  const fullBlocks = Math.floor(totalUnits);
  const remainder = totalUnits - fullBlocks;
  const partialIndex = Math.round(remainder * (BLOCK_CHARS.length - 1));
  const emptyBlocks = width - fullBlocks - (partialIndex > 0 ? 1 : 0);

  let result = "";

  // Add full blocks with gradient color
  for (let i = 0; i < fullBlocks; i++) {
    const blockValue = ((i + 1) / width) * max;
    result += colorByThreshold(FULL_BLOCK, blockValue, lowThreshold, highThreshold);
  }

  // Add partial block
  if (partialIndex > 0 && fullBlocks < width) {
    const blockValue = ((fullBlocks + 1) / width) * max;
    result += colorByThreshold(BLOCK_CHARS[partialIndex], blockValue, lowThreshold, highThreshold);
  }

  // Add empty blocks
  result += pc.dim(EMPTY_BLOCK.repeat(Math.max(0, emptyBlocks)));

  return result;
}

/**
 * Color a character based on threshold values
 */
function colorByThreshold(char: string, value: number, low: number, high: number): string {
  if (value < low) {
    return pc.green(char);
  } else if (value < high) {
    return pc.yellow(char);
  } else {
    return pc.red(char);
  }
}

/**
 * Generate a colored bar based on memory thresholds
 * Uses gradient coloring for visual appeal
 */
export function getColoredMemoryBar(
  memoryMB: number,
  max: number,
  width: number = 10
): string {
  return getGradientBar(memoryMB, max, width, 200, 500);
}

/**
 * Generate a colored bar for CPU usage
 * Uses gradient coloring for visual appeal
 */
export function getColoredCPUBar(cpu: number, width: number = 10): string {
  return getGradientBar(cpu, 100, width, 30, 70);
}

/**
 * Generate a sparkline from an array of values using Unicode blocks
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
      const index = Math.min(
        Math.round(normalized * (SPARK_CHARS.length - 1)),
        SPARK_CHARS.length - 1
      );
      return SPARK_CHARS[index];
    })
    .join("");
}

/**
 * Generate a colored sparkline with gradient based on values
 */
export function getColoredSparkline(
  values: number[],
  maxPoints: number = 20
): string {
  if (values.length === 0) return "";

  const points = values.slice(-maxPoints);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const avg = points.reduce((a, b) => a + b, 0) / points.length;

  return points
    .map((v) => {
      const normalized = (v - min) / range;
      const index = Math.min(
        Math.round(normalized * (SPARK_CHARS.length - 1)),
        SPARK_CHARS.length - 1
      );
      const char = SPARK_CHARS[index];

      // Color based on whether value is above or below average
      if (v > avg * 1.15) {
        return pc.red(char);
      } else if (v < avg * 0.85) {
        return pc.green(char);
      } else {
        return pc.cyan(char);
      }
    })
    .join("");
}

/**
 * Generate a mini bar for inline display
 */
export function getMiniBar(value: number, max: number, width: number = 5): string {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const filled = Math.round(ratio * width);

  let color: (s: string) => string;
  const percent = (value / max) * 100;

  if (percent < 30) {
    color = pc.green;
  } else if (percent < 70) {
    color = pc.yellow;
  } else {
    color = pc.red;
  }

  return color(FULL_BLOCK.repeat(filled)) + pc.dim(EMPTY_BLOCK.repeat(width - filled));
}

/**
 * Format a trend indicator with arrow
 */
export function getTrendIndicator(current: number, previous: number): string {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

  if (change > 5) {
    return pc.red("▲");
  } else if (change < -5) {
    return pc.green("▼");
  } else {
    return pc.dim("●");
  }
}

/**
 * Generate a percentage bar with label
 */
export function getPercentageBar(
  value: number,
  max: number,
  width: number = 10,
  showPercent: boolean = true
): string {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const bar = getGradientBar(value, max, width, max * 0.3, max * 0.7);

  if (showPercent) {
    return `${bar} ${percent.toFixed(0).padStart(3)}%`;
  }
  return bar;
}

/**
 * Generate a horizontal gauge with markers
 */
export function getGauge(value: number, max: number, width: number = 20): string {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const position = Math.round(ratio * (width - 1));

  let gauge = "";
  for (let i = 0; i < width; i++) {
    if (i === position) {
      // Pointer
      const percent = ratio * 100;
      if (percent < 30) {
        gauge += pc.green("◆");
      } else if (percent < 70) {
        gauge += pc.yellow("◆");
      } else {
        gauge += pc.red("◆");
      }
    } else if (i < position) {
      // Filled part
      const blockPercent = (i / width) * 100;
      if (blockPercent < 30) {
        gauge += pc.green("─");
      } else if (blockPercent < 70) {
        gauge += pc.yellow("─");
      } else {
        gauge += pc.red("─");
      }
    } else {
      // Empty part
      gauge += pc.dim("─");
    }
  }

  return `[${gauge}]`;
}
