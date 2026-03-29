#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/common.sh"

stack_load_env
stack_validate_modes

printf '%-10s %-10s %-10s %s\n' "service" "mode" "runtime" "status"
while IFS= read -r service; do
  [[ -n "$service" ]] || continue
  mode="local"
  runtime="-"
  if [[ "$service" == "harness" ]]; then
    runtime="$AURA_STACK_HARNESS_RUNTIME"
  fi
  status="stopped"
  if curl -fsS "$(stack_service_health_url "$service")" >/dev/null 2>&1; then
    status="ready"
  elif pid="$(stack_service_pid "$service" 2>/dev/null)" && stack_pid_is_running "$pid"; then
    status="starting"
  fi
  printf '%-10s %-10s %-10s %s\n' "$service" "$mode" "$runtime" "$status"
done < <(stack_host_managed_services)

printf '\n%-10s %-10s %-10s %s\n' "docker" "mode" "runtime" "status"
while IFS= read -r service; do
  [[ -n "$service" ]] || continue
  status="stopped"
  if docker compose -f "$AURA_STACK_DOCKER_COMPOSE_FILE" ps --status running "$service" 2>/dev/null | tail -n +2 | grep -q .; then
    status="running"
  fi
  printf '%-10s %-10s %-10s %s\n' "$service" "local" "docker" "$status"
done < <(stack_docker_services)
