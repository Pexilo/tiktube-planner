#!/bin/bash
# Installe l'icône de barre des menus "Studio YouTube" + démarrage automatique à l'ouverture de session.
# Désinstaller : bash scripts/install-menubar.sh --uninstall
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
APP="$HOME/Applications/Studio YouTube.app"
LABEL="local.studio.app"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ "$1" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  pkill -f "Studio YouTube.app/Contents/MacOS/StudioYouTube" 2>/dev/null || true
  rm -rf "$APP" "$PLIST"
  echo "✅ Désinstallé."
  exit 0
fi

NODE="$(command -v node)"
BUILD="$(mktemp -d)"
sed -e "s#__ROOT__#$ROOT#" -e "s#__NODE__#$NODE#" menubar/StudioYouTube.swift > "$BUILD/main.swift"
swiftc -O -swift-version 5 -o "$BUILD/StudioYouTube" "$BUILD/main.swift"

pkill -f "Studio YouTube.app/Contents/MacOS/StudioYouTube" 2>/dev/null || true
mkdir -p "$APP/Contents/MacOS"
cp "$BUILD/StudioYouTube" "$APP/Contents/MacOS/StudioYouTube"
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Studio YouTube</string>
  <key>CFBundleIdentifier</key><string>$LABEL</string>
  <key>CFBundleExecutable</key><string>StudioYouTube</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
</dict></plist>
EOF
codesign --force --sign - "$APP" >/dev/null 2>&1 || true

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$APP/Contents/MacOS/StudioYouTube</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>LimitLoadToSessionType</key><string>Aqua</string>
</dict></plist>
EOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
rm -rf "$BUILD"
echo "✅ Icône installée dans la barre des menus (▶). Elle se lance à chaque ouverture de session."
