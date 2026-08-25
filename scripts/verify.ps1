$ErrorActionPreference = "Stop"
$repository = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host "[contracts] parsing JSON files"
Get-ChildItem -LiteralPath (Join-Path $repository "contracts") -Recurse -Filter *.json | ForEach-Object {
    Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json | Out-Null
}
Get-ChildItem -LiteralPath (Join-Path $repository "data\synthetic") -Recurse -Filter *.json | ForEach-Object {
    Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json | Out-Null
}

$backend = Join-Path $repository "services\backend"
$backendPython = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $backendPython)) {
    $backendPython = "python"
}

Write-Host "[backend] compiling Python sources"
& $backendPython -m compileall -q (Join-Path $backend "src")

$fastApiAvailable = & $backendPython -c "import fastapi" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[backend] running tests"
    Push-Location $backend
    try {
        & $backendPython -m pytest
        & $backendPython -m ruff check .
        & $backendPython -m mypy
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Warning "Backend dependencies are not installed; pytest and ruff were skipped."
}

$web = Join-Path $repository "apps\web"
if (Test-Path -LiteralPath (Join-Path $web "node_modules")) {
    Write-Host "[web] running verify"
    Push-Location $web
    try {
        npm run verify
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Warning "Web dependencies are not installed; npm verify was skipped."
}

if (Get-Command forge -ErrorAction SilentlyContinue) {
    Write-Host "[chain] running Foundry checks"
    Push-Location (Join-Path $repository "chain")
    try {
        forge fmt --check
        forge build
        forge test
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Warning "Foundry is not installed; Solidity checks were skipped."
}

Write-Host "RWA Guard scaffold verification completed."
