import * as p from "@clack/prompts";
import pc from "picocolors";

export interface ProcessSelection {
  processType: string;
  processNames: string[];
  filterPattern?: string;
  dockerMode?: boolean;
}

const PROCESS_PRESETS: Record<string, string[]> = {
  python: ["python", "python.exe", "python3", "python3.exe", "pythonw", "pythonw.exe"],
  node: ["node", "node.exe", "nodejs", "nodejs.exe"],
  java: ["java", "java.exe", "javaw", "javaw.exe"],
  go: ["go", "go.exe"],
  rust: ["rustc", "rustc.exe", "cargo", "cargo.exe"],
  ruby: ["ruby", "ruby.exe", "rubyw", "rubyw.exe"],
  php: ["php", "php.exe", "php-cgi", "php-cgi.exe"],
  bun: ["bun", "bun.exe"],
  deno: ["deno", "deno.exe"],
  // Docker - monitors all processes (filtering done in monitor.ts with --docker flag)
  docker: ["*"],
};

export async function selectProcess(): Promise<ProcessSelection | null> {
  p.intro(pc.bgCyan(pc.black(" Process Monitor ")));

  const processType = await p.select({
    message: "What would you like to monitor?",
    options: [
      { value: "python", label: "Python processes", hint: "python, python3" },
      { value: "node", label: "Node.js processes", hint: "node" },
      { value: "java", label: "Java processes", hint: "java, javaw" },
      { value: "go", label: "Go processes", hint: "go" },
      { value: "rust", label: "Rust processes", hint: "rustc, cargo" },
      { value: "ruby", label: "Ruby processes", hint: "ruby" },
      { value: "php", label: "PHP processes", hint: "php" },
      { value: "bun", label: "Bun processes", hint: "bun" },
      { value: "deno", label: "Deno processes", hint: "deno" },
      { value: "docker", label: "Docker containers", hint: "requires Docker" },
      { value: "custom", label: "Custom (enter process name)" },
    ],
  });

  if (p.isCancel(processType)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  let processNames: string[];
  let selectedType = processType as string;
  let dockerMode = false;

  if (processType === "docker") {
    // Docker mode - we'll monitor all processes and filter by container PIDs
    dockerMode = true;
    processNames = []; // Empty - will get all processes
  } else if (processType === "custom") {
    const customName = await p.text({
      message: "Enter process name to monitor:",
      placeholder: "e.g., nginx, postgres, redis",
      validate: (value) => {
        if (!value.trim()) return "Process name is required";
        return undefined;
      },
    });

    if (p.isCancel(customName)) {
      p.cancel("Operation cancelled.");
      return null;
    }

    selectedType = customName as string;
    const name = (customName as string).toLowerCase();
    processNames = [name, `${name}.exe`];
  } else {
    processNames = PROCESS_PRESETS[processType as string] || [];
  }

  const addFilter = await p.confirm({
    message: "Add a filter pattern for script/command?",
    initialValue: false,
  });

  if (p.isCancel(addFilter)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  let filterPattern: string | undefined;

  if (addFilter) {
    const filter = await p.text({
      message: "Enter filter pattern:",
      placeholder: "e.g., server, test, app.py",
    });

    if (p.isCancel(filter)) {
      p.cancel("Operation cancelled.");
      return null;
    }

    filterPattern = filter as string;
  }

  // Clear screen after prompts
  process.stdout.write("\x1b[2J\x1b[H");

  return {
    processType: selectedType,
    processNames,
    filterPattern,
    dockerMode,
  };
}

export function getProcessNames(processType: string): string[] {
  const type = processType.toLowerCase();
  if (PROCESS_PRESETS[type]) {
    return PROCESS_PRESETS[type];
  }
  return [type, `${type}.exe`];
}
