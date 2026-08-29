$ErrorActionPreference = "Stop"
$repository = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot "verify-support.ps1")

$powershell = (Get-Process -Id $PID).Path
Invoke-NativeCommand -FilePath $powershell -Arguments @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    (Join-Path $PSScriptRoot "tests\verify.tests.ps1")
) -Label "verification script regression tests"
Invoke-NativeCommand -FilePath $powershell -Arguments @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    (Join-Path $PSScriptRoot "tests\compose-config.tests.ps1")
) -Label "compose config contract tests"

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
Invoke-NativeCommand -FilePath $backendPython -Arguments @(
    "-m", "compileall", "-q", (Join-Path $backend "src")
) -Label "backend source compilation"
Invoke-NativeCommand -FilePath $backendPython -Arguments @(
    "-c", "import fastapi"
) -Label "backend dependency probe"

Write-Host "[backend] running tests"
Push-Location $backend
try {
    Invoke-NativeCommand -FilePath $backendPython -Arguments @("-m", "pytest") `
        -Label "backend pytest"
    Invoke-NativeCommand -FilePath $backendPython -Arguments @("-m", "ruff", "check", ".") `
        -Label "backend Ruff"
    Invoke-NativeCommand -FilePath $backendPython -Arguments @("-m", "mypy") `
        -Label "backend mypy"
}
finally {
    Pop-Location
}

$web = Join-Path $repository "apps\web"
if (-not (Test-Path -LiteralPath (Join-Path $web "node_modules"))) {
    throw "Web dependencies are required; run npm install in apps/web."
}
$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if ($null -eq $npmCommand) {
    throw "npm is required for Web verification."
}
$npm = if ($npmCommand.Source) { $npmCommand.Source } else { $npmCommand.Path }
Write-Host "[web] running verify"
Push-Location $web
try {
    Invoke-NativeCommand -FilePath $npm -Arguments @("run", "verify") -Label "web verify"
}
finally {
    Pop-Location
}

$forge = Resolve-ForgeExecutable
Write-Host "[chain] running Foundry checks"
Push-Location (Join-Path $repository "chain")
try {
    Invoke-NativeCommand -FilePath $forge -Arguments @("fmt", "--check") `
        -Label "forge fmt --check"
    Invoke-NativeCommand -FilePath $forge -Arguments @("build") -Label "forge build"
    Invoke-NativeCommand -FilePath $forge -Arguments @("test") -Label "forge test"
}
finally {
    Pop-Location
}

Write-Host "RWA Guard scaffold verification completed."
