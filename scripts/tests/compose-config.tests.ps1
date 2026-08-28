$ErrorActionPreference = "Stop"

$repository = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$composeFile = Join-Path $repository "infra\docker-compose.yml"
$managedVariables = @(
    "POSTGRES_PASSWORD",
    "OPERATOR_TOKEN",
    "OPERATOR_ID",
    "OPERATOR_ACCESS_CODE",
    "OPERATOR_SESSION_SECRET",
    "PUBLIC_WEB_ORIGIN",
    "ALLOW_INSECURE_LOCAL_SESSION"
)
$savedVariables = @{}
$failures = [System.Collections.Generic.List[string]]::new()
foreach ($name in $managedVariables) {
    $savedVariables[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

function Set-ComposeRequiredEnvironment {
    $env:POSTGRES_PASSWORD = "compose-test-postgres"
    $env:OPERATOR_TOKEN = "compose-test-operator-token"
    $env:OPERATOR_ID = "compose-test-operator"
    $env:OPERATOR_ACCESS_CODE = "Compose-Test-Access-Code-2026!"
    $env:OPERATOR_SESSION_SECRET = "compose-test-session-secret-32-bytes"
}

function Get-ComposeConfig {
    $output = & docker compose -f $composeFile config --format json
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose config failed with exit code $LASTEXITCODE"
    }
    return $output | ConvertFrom-Json
}

function Assert-Equal {
    param(
        [object]$Actual,
        [object]$Expected,
        [string]$Message
    )
    if ($Actual -ne $Expected) {
        $script:failures.Add("$Message (expected '$Expected', got '$Actual')")
    }
}

try {
    Set-ComposeRequiredEnvironment
    Remove-Item Env:PUBLIC_WEB_ORIGIN -ErrorAction SilentlyContinue
    Remove-Item Env:ALLOW_INSECURE_LOCAL_SESSION -ErrorAction SilentlyContinue

    $local = Get-ComposeConfig
    Assert-Equal $local.services.web.environment.PUBLIC_WEB_ORIGIN `
        "http://localhost:3000" "local Web origin default changed"
    Assert-Equal $local.services.web.environment.ALLOW_INSECURE_LOCAL_SESSION `
        "true" "local insecure session default changed"

    $env:PUBLIC_WEB_ORIGIN = "https://guard.example"
    $env:ALLOW_INSECURE_LOCAL_SESSION = "false"

    $https = Get-ComposeConfig
    Assert-Equal $https.services.web.environment.PUBLIC_WEB_ORIGIN `
        "https://guard.example" "HTTPS Web origin was not propagated"
    Assert-Equal $https.services.web.environment.ALLOW_INSECURE_LOCAL_SESSION `
        "false" "HTTPS secure-session flag was not propagated"
    Assert-Equal $https.services.api.environment.PUBLIC_WEB_ORIGIN `
        "https://guard.example" "HTTPS API CORS origin was not propagated"
    Assert-Equal $https.services.web.environment.NEXT_PUBLIC_API_BASE_URL `
        "/backend-api" "browser API base must remain same-origin"
    Assert-Equal $https.services.web.environment.BACKEND_API_BASE_URL `
        "http://api:8000" "server API base must remain internal"
}
finally {
    foreach ($name in $managedVariables) {
        $value = $savedVariables[$name]
        if ($null -eq $value) {
            [Environment]::SetEnvironmentVariable($name, $null, "Process")
        }
        else {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Host "FAIL: $_" -ForegroundColor Red }
    exit 1
}

Write-Host "compose config contract tests passed."
