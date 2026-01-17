# procmon-cli

A cross-platform CLI tool for monitoring processes with real-time updates, charts, and JSON export.

## Features

- Interactive process type selection UI
- Real-time CPU and memory monitoring
- Color-coded usage indicators (green/yellow/red)
- ASCII bar charts and sparkline trends
- Historical summaries on exit
- JSON export functionality
- Cross-platform support (Windows, macOS, Linux)

## Installation

```bash
# Using bun
bun add -g procmon-cli

# Using npm
npm install -g procmon-cli
```

## Usage

### Interactive Mode

Simply run `procmon` to get an interactive selection menu:

```bash
procmon
```

```
┌  Process Monitor
│
◆  What would you like to monitor?
│  ● Python processes
│  ○ Node.js processes
│  ○ Java processes
│  ○ Go processes
│  ○ Rust processes
│  ○ Custom (enter process name)
└
```

### Command Line Options

```
procmon [options]

Options:
  -p, --process <type>    Process type (python, node, java, etc.)
  -f, --filter <pattern>  Filter by script/command pattern
  -i, --interval <ms>     Refresh interval (default: 2000)
  -e, --export            Export to JSON on exit
  -h, --help              Show help
  -V, --version           Show version
```

### Examples

```bash
# Monitor Python processes
procmon -p python

# Monitor Node.js processes running "server"
procmon -p node --filter "server"

# Monitor with faster refresh and export
procmon -p java -i 1000 --export

# Monitor a custom process
procmon -p nginx
```

## Display

The monitor shows a real-time table with:

| Column | Description |
|--------|-------------|
| PID | Process ID |
| NAME | Process name |
| CPU | CPU usage percentage |
| CPU BAR | Visual CPU bar chart |
| MEMORY | Memory usage |
| MEM BAR | Visual memory bar chart |
| TREND | Memory trend indicator (↑↓→) |

Color coding:
- **Green**: Low usage (CPU < 30%, Memory < 200MB)
- **Yellow**: Medium usage (CPU 30-70%, Memory 200-500MB)
- **Red**: High usage (CPU > 70%, Memory > 500MB)

## JSON Export

When using `--export`, a JSON file is created on exit with the format:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "processType": "python",
  "filterPattern": null,
  "duration": 60000,
  "processes": [
    {
      "pid": 12345,
      "name": "python",
      "cmd": "python app.py",
      "samples": 30,
      "avgCPU": 15.5,
      "peakCPU": 45.2,
      "avgMemoryMB": 150.3,
      "peakMemoryMB": 210.5,
      "cpuHistory": [...],
      "memoryHistory": [...]
    }
  ]
}
```

## Development

```bash
# Clone and install dependencies
git clone <repo>
cd procmon
bun install

# Run in development
bun run src/index.ts

# Run with options
bun run src/index.ts -p node --filter "test"
```

## License

MIT
