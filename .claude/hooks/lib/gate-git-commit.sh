#!/bin/bash
# Shared gate for PreToolUse hooks: return early unless the Bash call is a commit.
#
# PreToolUse fires for every Bash call, so each hook has to filter for itself.
# The tool input arrives as JSON on stdin, with the command at
# `.tool_input.command`. Source this as the first thing a hook does:
#
#   source "$(dirname "$0")/lib/gate-git-commit.sh"

# Fast path: the payload doesn't mention a commit anywhere, so no parsing needed
# and we don't pay for a node startup on every unrelated Bash call.
_gate_input=$(cat)
case "$_gate_input" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

# The substring can come from anywhere in the payload (a grep pattern, a commit
# message being read back), so pull out the actual command before deciding.
if _gate_command=$(printf '%s' "$_gate_input" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try {
      process.stdout.write(JSON.parse(s).tool_input?.command ?? "");
    } catch {
      process.exit(1);
    }
  });
'); then
  case "$_gate_command" in
    *"git commit"*) ;;
    *) exit 0 ;;
  esac
else
  # Fail closed. If we cannot tell what the command was, run the checks rather
  # than silently waving a commit through — a broken gate that blocks is
  # recoverable, one that opens is not.
  echo "⚠️  Could not parse hook input; running checks anyway." >&2
fi
