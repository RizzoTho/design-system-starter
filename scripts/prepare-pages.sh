#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_dir="$repo_root/_site"

rm -rf "$site_dir"
mkdir -p "$site_dir/js"

cp "$repo_root/index.html" "$repo_root/styles.css" "$site_dir/"
cp "$repo_root"/js/*.js "$site_dir/js/"

printf 'Prepared GitHub Pages artifact at %s\n' "$site_dir"
