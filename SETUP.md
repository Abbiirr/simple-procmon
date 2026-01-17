# Setup Steps

## 1. Install Dependencies
```bash
cd K:\projects\temp\procmon
bun install
```

## 2. Test Interactive Mode
```bash
bun run src/index.ts
```

## 3. Test Direct Mode (monitor node processes)
```bash
bun run src/index.ts -p node
```

## 4. Test with Filter
```bash
bun run src/index.ts -p node --filter "server"
```

## 5. Test with Export
```bash
bun run src/index.ts -p node --export
```
Press Ctrl+C to stop - should show summary and create JSON file.

## 6. Test Help
```bash
bun run src/index.ts --help
```

## Project Files Created
- `package.json` - Project config with dependencies
- `tsconfig.json` - TypeScript config for Bun
- `src/index.ts` - CLI entry point
- `src/prompts.ts` - Interactive selection UI (@clack/prompts)
- `src/process.ts` - Cross-platform process detection (ps-list, pidusage)
- `src/display.ts` - Terminal UI rendering
- `src/charts.ts` - Bar charts & sparklines
- `src/export.ts` - JSON export functionality
- `src/monitor.ts` - Main monitoring loop
- `README.md` - Documentation
