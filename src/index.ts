#!/usr/bin/env bun
import { Command } from "commander";
import { selectProcess, getProcessNames } from "./prompts.js";
import { startMonitor, startTrace } from "./monitor.js";

const program = new Command();

program
  .name("procmon")
  .description("Cross-platform CLI tool for monitoring processes")
  .version("1.0.0")
  .option("-p, --process <type>", "Process type (python, node, java, etc.)")
  .option("-t, --trace <pid>", "Trace a specific PID with full history and graphs")
  .option("-f, --filter <pattern>", "Filter by script/command pattern")
  .option("-i, --interval <ms>", "Refresh interval in milliseconds", "2000")
  .option("-e, --export", "Export to JSON on exit", false)
  .parse();

const options = program.opts();

async function main(): Promise<void> {
  // Parse interval
  const interval = parseInt(options.interval, 10);
  if (isNaN(interval) || interval < 100) {
    console.error("Error: Interval must be a number >= 100ms");
    process.exit(1);
  }

  // Trace mode - follow a specific PID
  if (options.trace) {
    const pid = parseInt(options.trace, 10);
    if (isNaN(pid)) {
      console.error("Error: --trace requires a valid PID number");
      process.exit(1);
    }

    await startTrace({
      pid,
      interval,
      exportOnExit: options.export,
    });
    return;
  }

  // Normal monitoring mode
  let processType: string;
  let processNames: string[];
  let filterPattern: string | undefined;

  // Check if process type was provided via CLI
  if (options.process) {
    processType = options.process;
    processNames = getProcessNames(options.process);
    filterPattern = options.filter;
  } else {
    // Interactive mode
    const selection = await selectProcess();

    if (!selection) {
      process.exit(0);
    }

    processType = selection.processType;
    processNames = selection.processNames;
    filterPattern = selection.filterPattern;
  }

  // Start monitoring
  await startMonitor({
    processType,
    processNames,
    filterPattern,
    interval,
    exportOnExit: options.export,
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
