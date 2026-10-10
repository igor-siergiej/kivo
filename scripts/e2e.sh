#!/usr/bin/env bash
# Runs tests/e2e; translates `--grep <pattern>` (kanban-cli) to bun's `-t <pattern>`.
args=()
while [ $# -gt 0 ]; do
  if [ "$1" = "--grep" ]; then args+=("-t" "$2"); shift 2; else args+=("$1"); shift; fi
done
exec bun test ./tests/e2e/auth.e2e.ts "${args[@]}"
