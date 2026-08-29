$ErrorActionPreference = "Stop"
$support = Join-Path $PSScriptRoot "..\verify-support.ps1"
. $support

$failures = [System.Collections.Generic.List[string]]::new()

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        $script:failures.Add($Message)
    }
}

try {
    Invoke-NativeCommand -FilePath (Get-Process -Id $PID).Path -Arguments @(
        "-NoProfile",
        "-Command",
        "exit 23"
    ) -Label "intentional failure"
    $failures.Add("Invoke-NativeCommand accepted exit code 23")
}
catch {
    Assert-True ($_.Exception.Message -match "intentional failure.*23") `
        "native failure did not preserve the command label and exit code"
}

Invoke-NativeCommand -FilePath (Get-Process -Id $PID).Path -Arguments @(
    "-NoProfile",
    "-Command",
    "exit 0"
) -Label "intentional success"

$temporaryHome = Join-Path ([System.IO.Path]::GetTempPath()) ("rwa-forge-" + [guid]::NewGuid())
$fallbackDirectory = Join-Path $temporaryHome ".foundry\bin"
New-Item -ItemType Directory -Path $fallbackDirectory -Force | Out-Null
$fallback = Join-Path $fallbackDirectory "forge.exe"
New-Item -ItemType File -Path $fallback -Force | Out-Null
try {
    $resolved = Resolve-ForgeExecutable -HomeDirectory $temporaryHome `
        -CommandLookup { param($Name) $null }
    Assert-True ($resolved -eq $fallback) "Foundry home fallback was not selected"
}
finally {
    Remove-Item -LiteralPath $temporaryHome -Recurse -Force
}

$missingHome = Join-Path ([System.IO.Path]::GetTempPath()) ("rwa-no-forge-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $missingHome -Force | Out-Null
try {
    try {
        Resolve-ForgeExecutable -HomeDirectory $missingHome `
            -CommandLookup { param($Name) $null }
        $failures.Add("missing Foundry was accepted")
    }
    catch {
        Assert-True ($_.Exception.Message -match "Foundry.*required") `
            "missing Foundry did not produce an explicit requirement error"
    }
}
finally {
    Remove-Item -LiteralPath $missingHome -Recurse -Force
}

$repository = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $repository
try {
    & git check-ignore --quiet --no-index "apps/web/src/app/reports/[id]/page.tsx"
    Assert-True ($LASTEXITCODE -eq 1) `
        "Next reports route is still ignored and cannot be added from a clean checkout"

    & git check-ignore --quiet --no-index "reports/generated-report.json"
    Assert-True ($LASTEXITCODE -eq 0) "generated report output is no longer ignored"
}
finally {
    Pop-Location
}

$compose = Get-Content -Raw -LiteralPath (Join-Path $repository "infra\docker-compose.yml")
foreach ($required in @(
    "OPERATOR_TOKEN",
    "OPERATOR_ID",
    "OPERATOR_ACCESS_CODE",
    "BACKEND_OPERATOR_TOKEN",
    "OPERATOR_SESSION_SECRET",
    "TRUSTED_CLIENT_IP_HEADER",
    "WORKER_HEARTBEAT_FRESHNESS_SECONDS",
    "python",
    "rwa_guard.worker"
)) {
    Assert-True ($compose.Contains($required)) "compose is missing required setting: $required"
}

$proxyConfigPath = Join-Path $repository "infra\nginx.conf"
Assert-True (Test-Path -LiteralPath $proxyConfigPath) "reverse proxy config is missing"
if (Test-Path -LiteralPath $proxyConfigPath) {
    $proxyConfig = Get-Content -Raw -LiteralPath $proxyConfigPath
    foreach ($required in @(
        'proxy_set_header X-Real-IP $remote_addr;',
        'proxy_set_header X-Forwarded-For $remote_addr;',
        'proxy_set_header Host $http_host;',
        'proxy_set_header X-Forwarded-Proto $scheme;'
    )) {
        Assert-True ($proxyConfig.Contains($required)) "proxy config is missing: $required"
    }
    Assert-True (-not $proxyConfig.Contains('$proxy_add_x_forwarded_for')) `
        "proxy must not trust an externally supplied forwarding chain"
}

$webBlock = [regex]::Match($compose, '(?ms)^  web:\s*(.*?)(?=^  \w|\z)').Groups[1].Value
$proxyBlock = [regex]::Match($compose, '(?ms)^  proxy:\s*(.*?)(?=^  \w|\z)').Groups[1].Value
$apiBlock = [regex]::Match($compose, '(?ms)^  api:\s*(.*?)(?=^  \w|\z)').Groups[1].Value
$workerBlock = [regex]::Match($compose, '(?ms)^  worker:\s*(.*?)(?=^  \w|\z)').Groups[1].Value
Assert-True (-not $webBlock.Contains("ports:")) "web must be internal-only behind the proxy"
Assert-True ($webBlock.Contains("TRUSTED_CLIENT_IP_HEADER: x-real-ip")) `
    "web must trust only the proxy-overwritten x-real-ip header"
Assert-True ($webBlock.Contains("ALLOW_INSECURE_DEMO_OPERATOR: false")) `
    "production web must disable insecure operator fallback"
Assert-True ($webBlock.Contains('ALLOW_INSECURE_LOCAL_SESSION: ${ALLOW_INSECURE_LOCAL_SESSION:-true}')) `
    "local session exception must be configurable with a local-safe default"
Assert-True ($webBlock.Contains('PUBLIC_WEB_ORIGIN: ${PUBLIC_WEB_ORIGIN:-http://localhost:3000}')) `
    "public Web origin must be configurable with the loopback default"
Assert-True ($webBlock.Contains('NEXT_PUBLIC_API_BASE_URL: "/backend-api"')) `
    "browser API base must be the same-origin proxy path"
Assert-True ($webBlock.Contains("BACKEND_API_BASE_URL: http://api:8000")) `
    "server API base must use the internal API service"
Assert-True ($proxyBlock.Contains("3000:80")) "only the proxy must expose the public web port"
foreach ($block in @($apiBlock, $workerBlock)) {
    Assert-True ($block.Contains("RWA_GUARD_FIXTURE_ROOT: /opt/rwa-guard-fixtures")) `
        "API and worker must share the packaged fixture root"
}
Assert-True ($apiBlock.Contains("context: ..")) "backend image must build from repository root"
Assert-True ($apiBlock.Contains("dockerfile: services/backend/Dockerfile")) `
    "backend root context must select the narrow Dockerfile"

$backendDockerfile = Get-Content -Raw -LiteralPath (
    Join-Path $repository "services\backend\Dockerfile"
)
foreach ($required in @(
    "COPY fixtures/p0-manifest.json",
    "COPY data/synthetic/documents/issuance-terms-01.txt",
    "COPY chain/src/fixtures/VulnerableRwaToken.sol",
    "COPY chain/src/fixtures/VulnerableOracle.sol"
)) {
    Assert-True ($backendDockerfile.Contains($required)) `
        "backend image is missing packaged fixture: $required"
}
$rootDockerignore = Join-Path $repository ".dockerignore"
Assert-True (Test-Path -LiteralPath $rootDockerignore) "root .dockerignore is missing"
if (Test-Path -LiteralPath $rootDockerignore) {
    $dockerignore = Get-Content -Raw -LiteralPath $rootDockerignore
    foreach ($required in @(".git", ".env", "node_modules")) {
        Assert-True ($dockerignore.Contains($required)) `
            "root Docker context does not exclude $required"
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "verify script regression tests passed."
