#!/bin/bash
# Sends a bell + OSC 777 notification to the parent Ghostty terminal.
# Walks up the process tree to find the TTY since hooks have no controlling terminal.

MSG="${1:-Notification}"

# Walk up process tree to find an ancestor with a real TTY
PID=$$
TTY=""
while [ "$PID" != "1" ] && [ -n "$PID" ]; do
  T=$(ps -o tty= -p "$PID" 2>/dev/null | tr -d ' ')
  if [ -n "$T" ] && [ "$T" != "??" ] && [ -e "/dev/$T" ]; then
    TTY="/dev/$T"
    break
  fi
  PID=$(ps -o ppid= -p "$PID" 2>/dev/null | tr -d ' ')
done

if [ -z "$TTY" ]; then
  exit 0
fi

# Send OSC 777 desktop notification + bell to the Ghostty terminal
printf '\033]777;notify;Claude Code;%s\007' "$MSG" > "$TTY"
printf '\a' > "$TTY"

exit 0