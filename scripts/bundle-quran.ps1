param(
  [string]$Source = '..\quran-source-temp\mushafs\hafs\kfqc\svg'
)

$ErrorActionPreference = 'Stop'
$sourceDir = (Resolve-Path -LiteralPath $Source).Path
$outDir = Join-Path $PSScriptRoot '..\assets\quran'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$pages = @(Get-ChildItem -LiteralPath $sourceDir -File | Where-Object { $_.Name -match '^\d{3}\.svg$' } | Sort-Object Name)
if ($pages.Count -ne 604) { throw "Expected 604 canonical Mushaf pages, found $($pages.Count)" }
for ($page = 1; $page -le 604; $page++) {
  if ($pages[$page - 1].Name -ne ('{0:D3}.svg' -f $page)) { throw "Missing page $page" }
}

for ($start = 1; $start -le 604; $start += 20) {
  $end = [Math]::Min($start + 19, 604)
  $archive = Join-Path $outDir ('pages-{0:D3}-{1:D3}.zip' -f $start, $end)
  $selected = @($pages[($start - 1)..($end - 1)] | ForEach-Object { $_.FullName })
  Compress-Archive -LiteralPath $selected -DestinationPath $archive -CompressionLevel Optimal -Force
  Write-Output "Bundled pages $start-$end"
}
