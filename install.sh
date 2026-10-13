#!/bin/bash
# Studio — installation en une commande (macOS). Usage : ./install.sh
set -e
cd "$(dirname "$0")"
say_step() { printf "\n\033[1;35m▶ %s\033[0m\n" "$1"; }
need() { command -v "$1" >/dev/null 2>&1; }
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

[ "$(uname)" = "Darwin" ] || { echo "Studio fonctionne sur macOS (OCR, voix, barre des menus)."; exit 1; }

say_step "Dépendances système (Node 20+, ffmpeg, Python 3)"
if ! need node || ! need ffmpeg || ! need python3; then
  need brew || { echo "Installe d'abord Homebrew : https://brew.sh — puis relance ./install.sh"; exit 1; }
  need node || brew install node
  need ffmpeg || brew install ffmpeg
  need python3 || brew install python
fi
node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 20 ? 1 : 0)' || { echo "Node 20+ requis : brew upgrade node"; exit 1; }

say_step "Modules Node (Remotion, Express…)"
npm install --no-audit --no-fund --loglevel=error

say_step "Environnement Python (génération de la musique)"
if [ ! -x .venv/bin/python ]; then
  PY=$(command -v python3.13 || command -v python3.12 || command -v python3.11 || command -v python3)
  "$PY" -m venv .venv
fi
.venv/bin/pip install -q --upgrade pip numpy scipy

say_step "OCR macOS (lecture des slides TikTok)"
if [ ! -x tools/ocr ]; then
  if need swiftc; then swiftc -O -o tools/ocr tools/ocr.swift && echo "OK"; else echo "swiftc absent (xcode-select --install) : l'import intelligent TikTok sera limité."; fi
fi

mkdir -p data out
[ -f content/profile.json ] || cp content/profile.example.json content/profile.json
[ -f content/external.json ] || echo '{ "videos": [] }' > content/external.json

need claude || echo "ℹ️  Facultatif : installe Claude Code (claude.com/claude-code) pour les légendes TikTok automatiques."

say_step "C'est installé ! Lancement de Studio → http://localhost:${PORT:-4321} (le guide s'ouvre)"
exec node server/index.mjs
