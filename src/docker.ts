import { execSync } from "child_process";
import pc from "picocolors";

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  pid: number;
}

// Cache for Docker container info
let containerCache: Map<number, DockerContainer> = new Map();
let lastFetch = 0;
const CACHE_TTL = 5000; // 5 seconds

/**
 * Check if Docker is available
 */
export function isDockerAvailable(): boolean {
  try {
    execSync("docker --version", { stdio: "ignore", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of running Docker containers with their PIDs
 */
export function getDockerContainers(): DockerContainer[] {
  const now = Date.now();

  // Return cached data if fresh
  if (now - lastFetch < CACHE_TTL && containerCache.size > 0) {
    return Array.from(containerCache.values());
  }

  try {
    // Get container IDs and names
    const output = execSync(
      'docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}"',
      {
        encoding: "utf-8",
        timeout: 5000,
        windowsHide: true,
      }
    );

    const containers: DockerContainer[] = [];
    const lines = output.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      const [id, name, image, status] = line.split("|");
      if (!id) continue;

      // Get the PID of the container's main process
      try {
        const pidOutput = execSync(`docker inspect --format "{{.State.Pid}}" ${id}`, {
          encoding: "utf-8",
          timeout: 3000,
          windowsHide: true,
        });

        const pid = parseInt(pidOutput.trim(), 10);
        if (pid && pid > 0) {
          containers.push({
            id: id.substring(0, 12),
            name,
            image,
            status,
            pid,
          });
        }
      } catch {
        // Skip containers we can't get PID for
      }
    }

    // Update cache
    containerCache = new Map(containers.map((c) => [c.pid, c]));
    lastFetch = now;

    return containers;
  } catch (error) {
    console.error(pc.yellow("  Warning: Could not fetch Docker containers"));
    return [];
  }
}

/**
 * Get Docker container info by PID
 */
export function getContainerByPid(pid: number): DockerContainer | undefined {
  // Refresh cache if stale
  if (Date.now() - lastFetch > CACHE_TTL) {
    getDockerContainers();
  }
  return containerCache.get(pid);
}

/**
 * Get all PIDs that belong to Docker containers
 */
export function getDockerPids(): number[] {
  const containers = getDockerContainers();
  return containers.map((c) => c.pid);
}

/**
 * Format container name for display
 */
export function formatContainerName(container: DockerContainer, maxLen: number = 30): string {
  const prefix = `[${container.id.substring(0, 8)}] `;
  const name = container.name;

  if (prefix.length + name.length <= maxLen) {
    return prefix + name;
  }

  return prefix + name.substring(0, maxLen - prefix.length - 3) + "...";
}

/**
 * Get container processes with their child processes
 * This finds all processes that are children of the container's main PID
 */
export async function getContainerProcessPids(containerId: string): Promise<number[]> {
  try {
    // Get the top-level processes in the container
    const output = execSync(`docker top ${containerId} -o pid`, {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });

    const lines = output.trim().split("\n").slice(1); // Skip header
    const pids: number[] = [];

    for (const line of lines) {
      const pid = parseInt(line.trim(), 10);
      if (pid && pid > 0) {
        pids.push(pid);
      }
    }

    return pids;
  } catch {
    return [];
  }
}

/**
 * Display Docker containers status
 */
export function displayDockerStatus(): void {
  if (!isDockerAvailable()) {
    console.log(pc.yellow("  Docker is not available or not running"));
    return;
  }

  const containers = getDockerContainers();

  if (containers.length === 0) {
    console.log(pc.yellow("  No running Docker containers found"));
    return;
  }

  console.log(pc.gray(`  Found ${containers.length} running container(s)`));
}
