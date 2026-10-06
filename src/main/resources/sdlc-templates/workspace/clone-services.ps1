Set-Location -Path $PSScriptRoot
Get-Content -Path (Join-Path $PSScriptRoot 'services.txt') | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line -split '\s+'
    $folder = $parts[0]
    $url = if ($parts.Count -gt 1) { $parts[1] } else { '' }
    if (Test-Path -Path (Join-Path $folder '.git')) {
        Write-Host "already cloned: $folder"
    } elseif (-not $url) {
        Write-Host "no git URL for $folder in services.txt, skipped"
    } else {
        git clone $url $folder
    }
}
