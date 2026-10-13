#!/bin/sh
# Build the Chrome Web Store upload: only the files the extension loads.
#
# Included: manifest.json, LICENSE, top-level *.js / *.html / *.css,
# icons/*.png, and every file under any other top-level folder (js/, src/,
# lib/, _locales/, ...), except the folders and files listed below.
set -e
cd "$(dirname "$0")/.."

[ -f manifest.json ] || { echo "manifest.json not found" >&2; exit 1; }
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -n 1)
[ -n "$version" ] || { echo "could not read version from manifest.json" >&2; exit 1; }

out="dist/ai-label-filter-for-youtube-$version.zip"
list=$(mktemp)
trap 'rm -f "$list"' EXIT

{
  echo manifest.json
  [ -f LICENSE ] && echo LICENSE
  for f in *.js *.html *.css; do
    [ -f "$f" ] || continue
    case "$f" in
      *.test.js|*.spec.js|*.config.js) continue ;;
    esac
    echo "$f"
  done
  for f in icons/*.png; do
    [ -f "$f" ] && echo "$f"
  done
  # Other top-level folders. Hidden ones (.git, .github, .claude) never match */.
  for d in */; do
    d=${d%/}
    [ -d "$d" ] || continue
    case "$d" in
      icons|test|tests|__tests__|fixtures|docs|store|dist|scripts|node_modules|coverage) continue ;;
    esac
    find "$d" -type f \
      ! -name '.*' ! -name '*.md' \
      ! -name '*.test.js' ! -name '*.spec.js' \
      ! -path '*/test/*' ! -path '*/tests/*' ! -path '*/__tests__/*' \
      ! -path '*/fixtures/*' ! -path '*/.*/*'
  done
} | LC_ALL=C sort -u > "$list"

# Every file the manifest points to must be in the zip.
missing=0
for f in $(grep -oE '"[^"]+\.(js|css|html|png)"' manifest.json | tr -d '"'); do
  grep -qxF "$f" "$list" || { echo "manifest file not packaged: $f" >&2; missing=1; }
done
[ "$missing" -eq 0 ] || exit 1

mkdir -p dist
rm -f "$out"
zip -q -X "$out" -@ < "$list"
echo "$out"
