# Studio — installation en une commande (Windows). Usage (PowerShell) :
#   powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
function Step($t) { Write-Host "`n▶ $t" -ForegroundColor Magenta }
function Need($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") }

Step "Dépendances système (Node 20+, ffmpeg, Python 3)"
$missing = @(@{ cmd = "node"; id = "OpenJS.NodeJS.LTS" }, @{ cmd = "ffmpeg"; id = "Gyan.FFmpeg" }, @{ cmd = "python"; id = "Python.Python.3.13" }) | Where-Object { -not (Need $_.cmd) }
if ($missing) {
  if (-not (Need "winget")) { throw "winget est introuvable : installe « App Installer » depuis le Microsoft Store, puis relance install.ps1." }
  foreach ($m in $missing) { winget install --id $m.id -e --accept-source-agreements --accept-package-agreements }
  Refresh-Path
}
node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 20 ? 1 : 0)'
if ($LASTEXITCODE) { throw "Node 20+ requis : winget upgrade OpenJS.NodeJS.LTS" }

Step "Modules Node (Remotion, Express…)"
npm install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE) { throw "npm install a échoué" }

Step "Environnement Python (génération de la musique)"
if (-not (Test-Path .venv\Scripts\python.exe)) { python -m venv .venv }
.venv\Scripts\python.exe -m pip install -q --upgrade pip numpy scipy
if ($LASTEXITCODE) { throw "pip install a échoué" }

Step "OCR et voix Windows (lecture des slides TikTok, Shorts narrés)"
$voices = powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\win.ps1 voices | ConvertFrom-Json
Write-Host ("Voix installées : " + (($voices | ForEach-Object { "$($_.name) ($($_.lang))" }) -join ", "))
if (-not ($voices | Where-Object { $_.lang -like "fr*" })) {
  Write-Host "ℹ️  Aucune voix française : Paramètres → Heure et langue → Voix → Ajouter des voix → Français, pour les Shorts narrés FR." -ForegroundColor Yellow
}

New-Item -ItemType Directory -Force data, out | Out-Null
if (-not (Test-Path content\profile.json)) { Copy-Item content\profile.example.json content\profile.json }
if (-not (Test-Path content\external.json)) { Set-Content content\external.json '{ "videos": [] }' -Encoding UTF8 }

if (-not (Need "claude")) { Write-Host "ℹ️  Facultatif : installe Claude Code (claude.com/claude-code) pour les légendes TikTok automatiques." }

$port = if ($env:PORT) { $env:PORT } else { 4321 }
Step "C'est installé ! Lancement de Studio → http://localhost:$port (le guide s'ouvre)"
node server/index.mjs
