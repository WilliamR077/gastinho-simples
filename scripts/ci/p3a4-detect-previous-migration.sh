#!/usr/bin/env bash
set -euo pipefail

target="20260805130000"
migrations_dir="${1:-supabase/migrations}"
mapfile -t versions < <(
  find "$migrations_dir" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' |
    sed -E 's/^([0-9]+)_.*/\1/' |
    sort -u
)

previous=""
for version in "${versions[@]}"; do
  if [[ "$version" == "$target" ]]; then
    break
  fi
  previous="$version"
done

if [[ -z "$previous" ]] || ! printf '%s\n' "${versions[@]}" | grep -qx "$target"; then
  echo "Unable to determine migration immediately before $target" >&2
  exit 1
fi

printf '%s\n' "$previous"
