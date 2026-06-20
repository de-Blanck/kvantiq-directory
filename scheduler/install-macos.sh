#!/usr/bin/env bash
#
# Install the weekly Kvantiq Directory runner as a launchd agent (macOS).
# Works on both Intel and Apple Silicon. Re-run to update.
#
# It schedules `node scripts/scheduled-run.mjs` for Sundays at 03:00 local time.
# launchd runs a missed job at the next wake if the Mac was asleep/off.
#
# Prereqs (see docs/scheduled-runner.md): node, npm, gh (authenticated), the
# `claude` CLI, and CLAUDE_CODE_OAUTH_TOKEN in <repo>/.env.
#
# Usage: scheduler/install-macos.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.kvantiq.directory.weekly"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$REPO_ROOT/scheduled-run-debug.log"

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "error: node not found on PATH. Install Node 22+ first." >&2
  exit 1
fi
if [ ! -f "$REPO_ROOT/.env" ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "warning: no $REPO_ROOT/.env and CLAUDE_CODE_OAUTH_TOKEN unset — the run will fail preflight until you add the token." >&2
fi

mkdir -p "$HOME/Library/LaunchAgents"

# Bake the current PATH into the agent so claude/gh/npm resolve under launchd's
# minimal environment.
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>scripts/scheduled-run.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO_ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$PATH</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>0</integer>
    <key>Hour</key><integer>3</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "Installed launchd agent: $LABEL"
echo "  schedule : Sundays 03:00 local (missed runs fire at next wake)"
echo "  plist    : $PLIST"
echo "  log      : $LOG"
echo
echo "Test it now without waiting for Sunday:"
echo "  launchctl start $LABEL   # runs the job immediately"
echo "To remove: launchctl unload \"$PLIST\" && rm \"$PLIST\""
