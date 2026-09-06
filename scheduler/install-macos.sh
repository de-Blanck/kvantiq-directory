#!/usr/bin/env bash
#
# Install the Kvantiq Directory launchd agents (macOS).
# Works on both Intel and Apple Silicon. Re-run to update.
#
# Two agents:
#   com.kvantiq.directory.weekly     scripts/scheduled-run.mjs   Sundays 03:00
#   com.kvantiq.directory.automerge  scripts/auto-merge.mjs      every 2 hours
#
# The second one exists because GitHub Actions cannot run on this repo, so no
# status check gates a pull request. It runs the same gate a person would run
# and merges only what is provably safe — see scripts/auto-merge.mjs for the
# eligibility rules. Pause both by creating <repo>/.automation-paused.
#
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
# Two separate streams. The runner appends its own narrative to
# scheduled-run-debug.log; launchd captures raw child-process output (npm ci,
# the sweep, the build) here. Pointing both at one file doubled every log line
# and made the tail quoted into a failure issue half as useful.
LOG="$REPO_ROOT/scheduled-run-launchd.log"

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

# ── Auto-merge agent ─────────────────────────────────────────────────────────
MERGE_LABEL="com.kvantiq.directory.automerge"
MERGE_PLIST="$HOME/Library/LaunchAgents/$MERGE_LABEL.plist"
MERGE_LOG="$REPO_ROOT/auto-merge-launchd.log"

cat > "$MERGE_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$MERGE_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>scripts/auto-merge.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO_ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$PATH</string>
  </dict>
  <key>StartInterval</key>
  <integer>7200</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$MERGE_LOG</string>
  <key>StandardErrorPath</key>
  <string>$MERGE_LOG</string>
</dict>
</plist>
EOF

launchctl unload "$MERGE_PLIST" 2>/dev/null || true
launchctl load "$MERGE_PLIST"

echo "Installed $MERGE_LABEL — every 2 hours, logging to $MERGE_LOG"
echo "  dry run:  node scripts/auto-merge.mjs --dry-run"
echo "  pause:    echo 'reason' > $REPO_ROOT/.automation-paused"
