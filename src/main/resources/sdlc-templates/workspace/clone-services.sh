#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
while read -r folder url rest; do
  folder=$(printf '%s' "$folder" | tr -d '\r')
  url=$(printf '%s' "$url" | tr -d '\r')
  case "$folder" in ''|'#'*) continue ;; esac
  if [ -d "$folder/.git" ]; then
    echo "already cloned: $folder"
  elif [ -z "$url" ]; then
    echo "no git URL for $folder in services.txt, skipped"
  else
    git clone "$url" "$folder"
  fi
done < services.txt
