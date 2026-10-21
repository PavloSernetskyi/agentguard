$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    python scripts/package_backend.py
    if ($LASTEXITCODE -ne 0) { throw "Backend packaging failed" }
    Push-Location store
    $previousAuthMode = $env:VITE_AUTH_MODE
    try {
        $env:VITE_AUTH_MODE = "cognito"
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
    } finally {
        $env:VITE_AUTH_MODE = $previousAuthMode
        Pop-Location
    }
    $artifactTarget = [IO.Path]::GetFullPath((Join-Path $projectRoot "artifacts/store"))
    $expectedRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot "artifacts")) + [IO.Path]::DirectorySeparatorChar
    if (-not $artifactTarget.StartsWith($expectedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw "Invalid artifact target" }
    if (Test-Path -LiteralPath $artifactTarget) { Remove-Item -LiteralPath $artifactTarget -Recurse -Force }
    Copy-Item -LiteralPath (Join-Path $projectRoot "store/dist") -Destination $artifactTarget -Recurse
    Write-Host "Cloud artifacts prepared. No AWS resources changed."
} finally { Pop-Location }
