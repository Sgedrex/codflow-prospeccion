$envFile = Join-Path $PSScriptRoot ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $key, $value = $line -split "=", 2
            [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
        }
    }
}

if (-not $env:GOOGLE_MAPS_API_KEY) {
    Write-Error "GOOGLE_MAPS_API_KEY no esta definida. Pegala en el archivo .env junto a este script."
    exit 1
}

npx -y google-maps-mcp-server
