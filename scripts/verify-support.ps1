function Invoke-NativeCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [Parameter(Mandatory = $true)][string]$Label
    )

    & $FilePath @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Label failed with exit code $exitCode."
    }
}

function Resolve-ForgeExecutable {
    [CmdletBinding()]
    param(
        [string]$HomeDirectory = $HOME,
        [scriptblock]$CommandLookup = { param($Name) Get-Command $Name -ErrorAction SilentlyContinue }
    )

    $command = & $CommandLookup "forge"
    if ($null -ne $command) {
        if ($command -is [string]) {
            return $command
        }
        if ($command.Source) {
            return $command.Source
        }
        if ($command.Path) {
            return $command.Path
        }
    }

    $names = if ($IsWindows -or $env:OS -eq "Windows_NT") {
        @("forge.exe", "forge")
    }
    else {
        @("forge", "forge.exe")
    }
    foreach ($name in $names) {
        $candidate = Join-Path $HomeDirectory (".foundry\bin\" + $name)
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return $candidate
        }
    }

    throw "Foundry is required. Install forge on PATH or at `$HOME/.foundry/bin/forge.exe."
}
