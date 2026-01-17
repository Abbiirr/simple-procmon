# Python Process Monitor - Real-time with Historical Summary & Charts
# Press Ctrl+C to stop and see summary

$refreshInterval = 2  # seconds
$history = @{}
$maxBarWidth = 30

function Get-Bar {
    param($value, $max, $width = $maxBarWidth)
    if ($max -eq 0) { $max = 1 }
    $filled = [math]::Min([math]::Round(($value / $max) * $width), $width)
    $empty = $width - $filled
    $bar = "[" + ("#" * $filled) + ("-" * $empty) + "]"
    return $bar
}

function Get-Sparkline {
    param($values)
    $chars = @("_", ".", ":", "-", "=", "+", "*", "#")
    if ($values.Count -eq 0) { return "" }
    $min = ($values | Measure-Object -Minimum).Minimum
    $max = ($values | Measure-Object -Maximum).Maximum
    $range = $max - $min
    if ($range -eq 0) { $range = 1 }

    $spark = ""
    $recentValues = $values | Select-Object -Last 40
    foreach ($v in $recentValues) {
        $idx = [math]::Min([math]::Floor((($v - $min) / $range) * 7), 7)
        $spark += $chars[$idx]
    }
    return $spark
}

function Get-PythonProcesses {
    Get-WmiObject Win32_Process -Filter "name='python.exe'" | ForEach-Object {
        $proc = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
        if ($proc) {
            $cmdLine = $_.CommandLine
            $scriptName = if ($cmdLine -match '\.py["\s]?') {
                ($cmdLine -split '\\|/')[-1] -replace '".*','' -replace '\s+.*',''
            } else { '-' }

            [PSCustomObject]@{
                PID         = $_.ProcessId
                Script      = $scriptName
                'CPU (s)'   = [math]::Round($proc.CPU, 2)
                'Mem (MB)'  = [math]::Round($proc.WorkingSet64 / 1MB, 1)
                'Priv (MB)' = [math]::Round($proc.PrivateMemorySize64 / 1MB, 1)
                CommandLine = $cmdLine
            }
        }
    }
}

function Build-Display {
    param($procs, $elapsed)

    $lines = @()
    $lines += ""
    $lines += "  Python Process Monitor | Running: ${elapsed}s | Ctrl+C to stop"
    $lines += "  " + ("-" * 95)

    if ($procs.Count -gt 0) {
        $maxMem = ($procs | Measure-Object -Property 'Mem (MB)' -Maximum).Maximum
        if ($maxMem -lt 100) { $maxMem = 100 }

        $lines += ""
        $lines += "  PID      Script              CPU (s)   Mem (MB)   Memory Usage"
        $lines += "  -------  ------------------  --------  ---------  --------------------------------"

        foreach ($p in $procs) {
            $bar = Get-Bar -value $p.'Mem (MB)' -max $maxMem
            $scriptName = $p.Script
            if ($scriptName.Length -gt 18) { $scriptName = $scriptName.Substring(0, 18) }
            $line = "  {0,-7}  {1,-18}  {2,8}  {3,9}  {4}" -f $p.PID, $scriptName, $p.'CPU (s)', $p.'Mem (MB)', $bar
            $lines += $line
        }

        $lines += ""
        $lines += "  Commands:"
        foreach ($p in $procs) {
            $cmd = if ($p.CommandLine.Length -gt 85) { '...' + $p.CommandLine.Substring($p.CommandLine.Length - 82) } else { $p.CommandLine }
            $lines += "    $($p.PID): $cmd"
        }
    } else {
        $lines += ""
        $lines += "  No Python processes running."
    }

    return $lines
}

try {
    $startTime = Get-Date
    Clear-Host
    [Console]::CursorVisible = $false

    Write-Host "`n  Python Process Monitor - Press Ctrl+C to stop and see summary" -ForegroundColor Cyan
    Write-Host "  Refreshing every $refreshInterval seconds..." -ForegroundColor DarkGray

    $lastLineCount = 0

    while ($true) {
        $procs = @(Get-PythonProcesses)
        $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds)

        if ($procs.Count -gt 0) {
            $procs | ForEach-Object {
                $procId = $_.PID
                if (-not $history.ContainsKey($procId)) {
                    $history[$procId] = @{
                        Script      = $_.Script
                        CommandLine = $_.CommandLine
                        Samples     = @()
                        StartTime   = Get-Date
                    }
                }
                $history[$procId].Samples += [PSCustomObject]@{
                    Time     = Get-Date
                    CPU      = $_.'CPU (s)'
                    Mem      = $_.'Mem (MB)'
                    Priv     = $_.'Priv (MB)'
                }
            }
        }

        $displayLines = Build-Display -procs $procs -elapsed $elapsed

        [Console]::SetCursorPosition(0, 3)

        $padLine = " " * 100
        for ($i = 0; $i -lt [math]::Max($lastLineCount, $displayLines.Count); $i++) {
            if ($i -lt $displayLines.Count) {
                $line = $displayLines[$i]
                if ($line.Length -lt 100) { $line = $line + (" " * (100 - $line.Length)) }
                Write-Host $line
            } else {
                Write-Host $padLine
            }
        }

        $lastLineCount = $displayLines.Count

        Start-Sleep -Seconds $refreshInterval
    }
}
finally {
    [Console]::CursorVisible = $true

    Clear-Host
    Write-Host ""
    Write-Host ("=" * 100) -ForegroundColor Cyan
    Write-Host "                              HISTORICAL SUMMARY" -ForegroundColor Cyan
    Write-Host ("=" * 100) -ForegroundColor Cyan

    $duration = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
    Write-Host "`n  Monitoring Duration: $duration seconds" -ForegroundColor Gray
    Write-Host "  Processes Tracked: $($history.Count)" -ForegroundColor Gray

    if ($history.Count -gt 0) {
        Write-Host "`n  +-------------------------------------------------------------------------------------------+" -ForegroundColor DarkGray
        Write-Host "  |  PID      Script              Samples   Peak Mem    Avg Mem     Final CPU              |" -ForegroundColor White
        Write-Host "  +-------------------------------------------------------------------------------------------+" -ForegroundColor DarkGray

        $maxPeakMem = 0
        $summaries = @()

        foreach ($entry in $history.GetEnumerator()) {
            $samples = $entry.Value.Samples
            if ($samples.Count -gt 0) {
                $memValues = $samples | ForEach-Object { $_.Mem }
                $peakMem = [math]::Round(($memValues | Measure-Object -Maximum).Maximum, 1)
                if ($peakMem -gt $maxPeakMem) { $maxPeakMem = $peakMem }

                $summaries += [PSCustomObject]@{
                    PID       = $entry.Key
                    Script    = $entry.Value.Script
                    Samples   = $samples.Count
                    PeakMem   = $peakMem
                    AvgMem    = [math]::Round(($memValues | Measure-Object -Average).Average, 1)
                    FinalCPU  = [math]::Round(($samples | Select-Object -Last 1).CPU, 2)
                    MemValues = $memValues
                }
            }
        }

        foreach ($s in $summaries) {
            $scriptName = $s.Script
            if ($scriptName.Length -gt 18) { $scriptName = $scriptName.Substring(0, 18) }
            $line = "  |  {0,-7}  {1,-18}  {2,7}   {3,7} MB   {4,7} MB   {5,8} s              |" -f $s.PID, $scriptName, $s.Samples, $s.PeakMem, $s.AvgMem, $s.FinalCPU
            Write-Host $line -ForegroundColor White
        }

        Write-Host "  +-------------------------------------------------------------------------------------------+" -ForegroundColor DarkGray

        Write-Host "`n  PEAK MEMORY COMPARISON" -ForegroundColor Yellow
        Write-Host "  ----------------------" -ForegroundColor DarkGray
        if ($maxPeakMem -lt 100) { $maxPeakMem = 100 }

        foreach ($s in $summaries) {
            $bar = Get-Bar -value $s.PeakMem -max $maxPeakMem -width 40
            $memColor = if ($s.PeakMem -gt 500) { "Red" } elseif ($s.PeakMem -gt 200) { "Yellow" } else { "Green" }
            $scriptName = $s.Script
            if ($scriptName.Length -gt 15) { $scriptName = $scriptName.Substring(0, 15) }
            Write-Host ("  {0,-7} {1,-15} " -f $s.PID, $scriptName) -NoNewline
            Write-Host $bar -NoNewline -ForegroundColor $memColor
            Write-Host " $($s.PeakMem) MB" -ForegroundColor White
        }

        Write-Host "`n  MEMORY TREND (over time)" -ForegroundColor Yellow
        Write-Host "  ------------------------" -ForegroundColor DarkGray

        foreach ($s in $summaries) {
            $spark = Get-Sparkline -values $s.MemValues
            $scriptName = $s.Script
            if ($scriptName.Length -gt 15) { $scriptName = $scriptName.Substring(0, 15) }
            $minMem = [math]::Round(($s.MemValues | Measure-Object -Minimum).Minimum, 1)
            Write-Host ("  {0,-7} {1,-15} " -f $s.PID, $scriptName) -NoNewline
            Write-Host $spark -NoNewline -ForegroundColor Cyan
            Write-Host " (min: $minMem -> max: $($s.PeakMem) MB)" -ForegroundColor DarkGray
        }

        Write-Host "`n  COMMAND LINES" -ForegroundColor Yellow
        Write-Host "  -------------" -ForegroundColor DarkGray
        foreach ($entry in $history.GetEnumerator()) {
            Write-Host "  PID $($entry.Key): " -NoNewline -ForegroundColor White
            Write-Host $entry.Value.CommandLine -ForegroundColor Gray
        }

    } else {
        Write-Host "`n  No data collected." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host ("=" * 100) -ForegroundColor Cyan
    Write-Host ""
}
