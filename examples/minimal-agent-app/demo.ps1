# minimal-agent-app demo — cstl init → validate-rules → list tree
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$Workspace = Join-Path $ScriptDir "_demo-workspace"

function Resolve-Cstl {
    $built = Join-Path $RepoRoot "packages\cli\bin\cstl.js"
    if (Test-Path $built) {
        $dist = Join-Path $RepoRoot "packages\cli\dist\cli\index.js"
        if (-not (Test-Path $dist)) {
            Write-Host "Building CLI from monorepo..."
            Push-Location $RepoRoot
            pnpm build
            Pop-Location
        }
        return $built
    }
    $global = Get-Command cstl -ErrorAction SilentlyContinue
    if ($global) {
        return $global.Source
    }
    Write-Error "cstl not found. Install: npm install -g @blxzer/cursor-trellis`nOr run from cursor-trellis repo after pnpm build."
}

$Cstl = Resolve-Cstl
Write-Host "Using CLI: $Cstl"

if (Test-Path $Workspace) {
    Remove-Item -Recurse -Force $Workspace
}
New-Item -ItemType Directory -Path $Workspace | Out-Null
Set-Location $Workspace

Write-Host ""
Write-Host "==> cstl init --cursor -y"
node $Cstl init --cursor -y

Write-Host ""
Write-Host "==> cstl validate-rules"
node $Cstl validate-rules

Write-Host ""
Write-Host "==> Generated layout ($Workspace)"
Get-ChildItem -Force | ForEach-Object { $_.Name }
Write-Host ""
Write-Host ".trellis/"
Get-ChildItem .trellis -ErrorAction SilentlyContinue | ForEach-Object { "  $($_.Name)" }
Write-Host ""
Write-Host ".cursor/"
Get-ChildItem .cursor -ErrorAction SilentlyContinue | ForEach-Object { "  $($_.Name)" }

Write-Host ""
Write-Host "Done. Open $Workspace in Cursor to continue with /cstl-continue."
