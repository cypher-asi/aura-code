#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"

export AURA_STACK_PRESET="${AURA_STACK_PRESET:-hybrid-render}"

exec "$script_dir/status.sh" "$@"
