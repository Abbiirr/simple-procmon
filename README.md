# procmon-cli

A **developer-focused** CLI tool for monitoring processes with real-time updates, script name extraction, and Unicode charts.

> **Not another system monitor.** While tools like btop and Glances show everything, procmon-cli answers one question: *"What scripts are running and which ones are eating my resources?"*

## Table of Contents

- [Why procmon-cli?](#why-procmon-cli)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Command Line Options](#command-line-options)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Technical Deep Dive](#technical-deep-dive)
- [Development](#development)
- [Roadmap](#roadmap)

---

## Why procmon-cli?

| Feature | btop | bottom | Glances | **procmon-cli** |
|---------|------|--------|---------|-----------------|
| Script name extraction (`app.py` not `python.exe`) | No | No | No | **Yes** |
| Interactive language presets | No | No | Regex only | **Yes** |
| Single-PID tracing with graphs | No | No | No | **Yes** |
| Simple CSV/JSON export | No | No | Complex | **Yes** |
| Zero-config "just works" | Mostly | Mostly | No | **Yes** |

### The Killer Feature: Script Name Extraction

```
# Other tools show:
PID     NAME
1234    python.exe
5678    node.exe

# procmon-cli shows:
PID     SCRIPT/PROCESS
1234    K:\projects\myapp\server.py
5678    /home/user/api/index.js
```

---

## Installation

```bash
# Using bun (recommended)
bun add -g procmon-cli

# Using npm
npm install -g procmon-cli
```

---

## Quick Start

```bash
# Interactive mode - select what to monitor
procmon

# Monitor Python processes
procmon -p python

# Monitor Node.js with filter
procmon -p node --filter "server"

# Trace a specific PID
procmon --trace 12345

# Export data on exit
procmon -p java --export

# Web UI dashboard
procmon -p python --web

# Process tree view
procmon -p node --tree

# Alerting
procmon -p java --alert-cpu 80 --alert-memory 500

# Docker containers only
procmon --docker
```

---

## Features

### Interactive Process Selection

No regex knowledge required. Just select and go:

```
┌  Process Monitor
│
◆  What would you like to monitor?
│  ● Python processes (python, python3)
│  ○ Node.js processes (node)
│  ○ Java processes (java, javaw)
│  ○ Docker containers
│  ○ Custom (enter process name)
└
```

### Real-time Monitoring with Unicode Charts

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PID     SCRIPT/PROCESS                    CPU              MEMORY    HISTORY │
├──────────────────────────────────────────────────────────────────────────────┤
│ 12345   K:\projects\api\server.py         5.2% ███░░░░░░░  150 MB ██░░░░░░░░ │
│ ············································································ │
│░23456   K:\projects\worker.py            45.8% █████░░░░░  680 MB ████████░░ │
└──────────────────────────────────────────────────────────────────────────────┘
  2 processes  │  CPU: 51.0%  │  Memory: 830 MB  │  Press Ctrl+C to stop
```

- **Gradient colored bars**: Green → Yellow → Red based on thresholds
- **Unicode block characters**: `█▉▊▋▌▍▎▏░` for smooth progress bars
- **Sparkline history**: `▁▂▃▄▅▆▇█` showing memory trends
- **Box-drawn tables**: `┌─┬─┐│├─┤└─┴─┘` for clean borders
- **Row separators**: Dotted lines and alternating markers for readability

### PID Tracing Mode

```bash
procmon --trace 12345
```

Deep-dive into a specific process with:
- Real-time CPU/memory display
- Full ASCII graphs on exit
- Statistics (min/avg/max/current)
- CSV export for external analysis

### Web UI Dashboard

```bash
procmon -p python --web        # http://localhost:3000
procmon -p node --web 8080     # http://localhost:8080
```

Features:
- Real-time process table with colored bars
- Auto-refresh every 2 seconds
- JSON API at `/api/processes`
- Aggregate statistics
- Dark theme UI

### Process Tree View

```bash
procmon -p python --tree
```

```
TREE                                              PID       CPU         MEMORY
─────────────────────────────────────────────────────────────────────────────
main_app.py                                       12345     15.2%       256.3 MB
├─ worker_1.py                                    12346     8.1%        128.5 MB
├─ worker_2.py                                    12347     12.4%       192.1 MB
└─ scheduler.py                                   12348     2.3%        64.2 MB
```

### Alerting

```bash
procmon -p node --alert-cpu 80 --alert-memory 500
```

- Terminal bell notification (`\x07`)
- Colored alert messages with timestamps
- 30-second cooldown per process/type to avoid spam
- Summary of all alerts on exit

### Docker Container Monitoring

```bash
procmon --docker
```

Automatically detects running Docker containers and monitors their main processes.

### Export Functionality

```bash
procmon -p python --export
# Creates: procmon-2024-01-15T10-30-00.json
```

---

## Command Line Options

```
procmon [options]

Options:
  -p, --process <type>      Process type (python, node, java, go, rust, etc.)
  -f, --filter <pattern>    Filter by script/command pattern
  -t, --trace <pid>         Trace a specific PID with detailed graphs
  -i, --interval <ms>       Refresh interval in milliseconds (default: 2000)
  -e, --export              Export to JSON on exit
  -w, --web [port]          Start web UI dashboard (default port: 3000)
  --tree                    Show process tree view with parent/child relationships
  --alert-cpu <percent>     Alert when CPU exceeds threshold (e.g., 80)
  --alert-memory <mb>       Alert when memory exceeds threshold in MB (e.g., 500)
  --docker                  Monitor only Docker container processes
  -h, --help                Show help
  -V, --version             Show version
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLI Entry                                   │
│                            (index.ts)                                    │
│                                 │                                        │
│              ┌──────────────────┼──────────────────┐                    │
│              ▼                  ▼                  ▼                    │
│    ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐           │
│    │  Interactive    │ │   Monitor     │ │     Trace       │           │
│    │   Prompts       │ │    Loop       │ │     Mode        │           │
│    │  (prompts.ts)   │ │ (monitor.ts)  │ │  (monitor.ts)   │           │
│    └────────┬────────┘ └───────┬───────┘ └────────┬────────┘           │
│             │                  │                  │                     │
│             └──────────────────┼──────────────────┘                     │
│                                ▼                                        │
│    ┌─────────────────────────────────────────────────────────┐         │
│    │                   Process Detection                      │         │
│    │                    (process.ts)                          │         │
│    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │         │
│    │  │   ps-list   │  │  pidusage   │  │  WMIC (Windows) │  │         │
│    │  │ (enumerate) │  │ (CPU/mem)   │  │ (command lines) │  │         │
│    │  └─────────────┘  └─────────────┘  └─────────────────┘  │         │
│    └─────────────────────────────────────────────────────────┘         │
│                                │                                        │
│         ┌──────────────────────┼──────────────────────┐                │
│         ▼                      ▼                      ▼                │
│  ┌─────────────┐      ┌───────────────┐      ┌─────────────┐          │
│  │   Display   │      │    Charts     │      │   Export    │          │
│  │ (display.ts)│      │  (charts.ts)  │      │ (export.ts) │          │
│  └─────────────┘      └───────────────┘      └─────────────┘          │
│         │                      │                                        │
│         ▼                      ▼                                        │
│  ┌─────────────┐      ┌───────────────┐                                │
│  │   Terminal  │      │    Web UI     │                                │
│  │   Output    │      │   (web.ts)    │                                │
│  └─────────────┘      └───────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. Process Discovery

**Cross-platform process enumeration** using `ps-list`:

```typescript
import psList from "ps-list";
const processes = await psList();
// Returns: [{ pid, name, ppid, cmd }, ...]
```

**Windows command line extraction** using WMIC:

On Windows, `ps-list` doesn't always provide command line arguments. We use WMIC to get full command lines:

```typescript
const output = execSync('wmic process get ProcessId,CommandLine /format:csv');
// Parses CSV to extract command lines with full paths
```

The command line cache has a 5-second TTL to avoid excessive WMIC calls.

### 2. Script Name Extraction

The **killer feature** - extracting meaningful script names from command lines:

```typescript
// Input: "C:\Python39\python.exe" K:\projects\app\main.py --port 8080
// Output: K:\projects\app\main.py
```

**Algorithm:**

1. Parse command line respecting quoted strings
2. Look for files with script extensions (`.py`, `.js`, `.ts`, etc.)
3. Prefer full paths over filenames
4. **Venv inference**: If script is relative but Python is in `.venv/Scripts/`, infer project path:
   ```
   Executable: K:\projects\myapp\.venv\Scripts\python.exe
   Script: main.py
   Result: K:\projects\myapp\main.py
   ```

### 3. CPU/Memory Monitoring

Using `pidusage` for real-time stats:

```typescript
import pidusage from "pidusage";
const stats = await pidusage([pid1, pid2, ...]);
// Returns: { [pid]: { cpu, memory, elapsed } }
```

- **CPU**: Percentage of CPU time used
- **Memory**: Resident set size in bytes
- **Polling**: Configurable interval (default 2000ms)

### 4. Terminal Rendering

**Cursor control** using ANSI escape codes:

```typescript
const CURSOR_HOME = "\x1b[H";      // Move to top-left
const CLEAR_LINE = "\x1b[2K";      // Clear current line
const HIDE_CURSOR = "\x1b[?25l";   // Hide cursor during render
const SHOW_CURSOR = "\x1b[?25h";   // Show cursor on exit
```

**Render loop:**
1. Move cursor to home position
2. Clear and redraw each line
3. Track line count to clear leftover lines from previous render

### 5. Unicode Charts

**Progress bars** with smooth gradients:

```typescript
const BLOCK_CHARS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
// Allows 9 levels of fill per character cell
// Combined with color gradients: green → yellow → red
```

**Sparklines** for history:

```typescript
const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
// 8 levels of height, colored by value relative to average
```

### 6. Web UI

Built-in HTTP server using Bun's native `Bun.serve()`:

```typescript
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    if (url.pathname === "/api/processes") {
      return new Response(JSON.stringify(data));
    }
    return new Response(generateHTML());
  },
});
```

- Auto-refresh via `<meta http-equiv="refresh" content="2">`
- JSON API for external integrations
- Self-contained (no external CSS/JS)

### 7. Alerting System

**Threshold checking** with cooldown:

```typescript
const ALERT_COOLDOWN = 30000; // 30 seconds
const activeAlerts = new Map<string, number>(); // alertKey → lastAlertTime

// Only alert if cooldown expired
if (now - lastAlert > ALERT_COOLDOWN) {
  displayAlert(alert);
  activeAlerts.set(alertKey, now);
}
```

**Notification**: Terminal bell (`\x07`) + colored console output.

### 8. Docker Integration

**Container discovery** using Docker CLI:

```typescript
execSync('docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}"');
execSync(`docker inspect --format "{{.State.Pid}}" ${containerId}`);
```

Maps container PIDs to filter process list.

---

## Project Structure

```
procmon/
├── src/
│   ├── index.ts      # CLI entry point, argument parsing
│   ├── prompts.ts    # Interactive selection UI (@clack/prompts)
│   ├── process.ts    # Process detection, script extraction
│   ├── monitor.ts    # Main monitoring loop, trace mode
│   ├── display.ts    # Terminal rendering, tables, summaries
│   ├── charts.ts     # Unicode bars, sparklines, gauges
│   ├── export.ts     # JSON/CSV export functionality
│   ├── web.ts        # Web UI server and HTML generation
│   ├── alerts.ts     # Threshold alerting system
│   ├── docker.ts     # Docker container detection
│   └── tree.ts       # Process tree building and rendering
├── package.json
├── tsconfig.json
└── README.md
```

### File Responsibilities

| File | Purpose | Key Exports |
|------|---------|-------------|
| `index.ts` | CLI entry, Commander.js setup | `main()` |
| `prompts.ts` | Interactive menus | `selectProcess()`, `getProcessNames()` |
| `process.ts` | Process enumeration | `getProcesses()`, `extractScriptName()` |
| `monitor.ts` | Monitoring loop | `startMonitor()`, `startTrace()` |
| `display.ts` | Terminal UI | `renderTable()`, `renderSummary()` |
| `charts.ts` | Visualizations | `getColoredCPUBar()`, `getColoredSparkline()` |
| `export.ts` | Data export | `exportToJSON()`, `exportTraceToCSV()` |
| `web.ts` | Web dashboard | `startWebServer()`, `updateWebState()` |
| `alerts.ts` | Alerting | `checkAlerts()`, `displayAlerts()` |
| `docker.ts` | Docker support | `getDockerContainers()`, `isDockerAvailable()` |
| `tree.ts` | Tree view | `buildProcessTree()`, `renderTreeView()` |

---

## Technical Deep Dive

### Process Name Presets

Built-in presets for common runtimes:

```typescript
const PROCESS_PRESETS = {
  python: ["python", "python.exe", "python3", "python3.exe", "pythonw"],
  node: ["node", "node.exe", "nodejs"],
  java: ["java", "java.exe", "javaw", "javaw.exe"],
  go: ["go", "go.exe"],
  rust: ["rustc", "cargo"],
  // ... more
};
```

### Script Extension Support

Recognized extensions for extraction:

```
.py, .pyw           # Python
.js, .ts, .mjs      # JavaScript/TypeScript
.jsx, .tsx          # React
.rb                 # Ruby
.php                # PHP
.pl                 # Perl
.sh, .ps1           # Shell scripts
.bat, .cmd          # Windows batch
```

### Memory Tracking

History is bounded to prevent memory growth:

```typescript
const maxHistory = 100;
if (hist.cpuHistory.length > maxHistory) {
  hist.cpuHistory = hist.cpuHistory.slice(-maxHistory);
}
```

### Color Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| CPU | < 30% | 30-70% | > 70% |
| Memory | < 200 MB | 200-500 MB | > 500 MB |

### Export Formats

**JSON** (full history):
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "processType": "python",
  "duration": 60000,
  "processes": [{
    "pid": 12345,
    "avgCPU": 15.5,
    "peakCPU": 45.2,
    "cpuHistory": [12.1, 14.3, ...],
    "memoryHistory": [150.2, 152.1, ...]
  }]
}
```

**CSV** (trace mode):
```csv
timestamp,elapsed_ms,cpu_percent,memory_mb
1705312200000,0,12.5,150.3
1705312202000,2000,14.2,151.1
```

---

## Development

```bash
# Clone the repo
git clone https://github.com/Abbiirr/simple-procmon.git
cd simple-procmon

# Install dependencies
bun install

# Run in development
bun run src/index.ts

# Run with options
bun run src/index.ts -p node --filter "test"

# Type checking
bun run tsc --noEmit
```

### Tech Stack

| Component | Library |
|-----------|---------|
| Runtime | [Bun](https://bun.sh) (Node.js compatible) |
| CLI parsing | [Commander.js](https://github.com/tj/commander.js) |
| Interactive UI | [@clack/prompts](https://github.com/natemoo-re/clack) |
| Process list | [ps-list](https://github.com/sindresorhus/ps-list) |
| CPU/Memory | [pidusage](https://github.com/soyuka/pidusage) |
| Colors | [picocolors](https://github.com/alexeyraspopov/picocolors) |

---

## Roadmap

- [x] Core monitoring with script extraction
- [x] Interactive process type selection
- [x] Unicode charts with gradient colors
- [x] PID tracing with full graphs
- [x] JSON/CSV export
- [x] Web UI dashboard (`--web`)
- [x] Process tree view (`--tree`)
- [x] Alerting (`--alert-cpu`, `--alert-memory`)
- [x] Docker container filtering (`--docker`)
- [ ] Integration with btop/btm as "full dashboard" viewer
- [ ] Prometheus metrics endpoint (`/metrics`)
- [ ] Configuration file support (`.procmonrc`)
- [ ] Process grouping by project/directory

---

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT

---

**procmon-cli** — *A developer's process debugger, not a system monitor.*
