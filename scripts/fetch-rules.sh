#!/usr/bin/env bash
# Fetch .cursorrules for popular repos and save to .cursorrules-<owner>-<repo>
# Usage: ./scripts/fetch-rules.sh [base_url]

BASE="${1:-https://cafe-cursor-sepia.vercel.app}"
REPOS=("shadcn-ui/ui" "vercel/next.js" "tailwindlabs/tailwindcss" "supabase/supabase" "trpc/trpc")
OUT_DIR="${OUT_DIR:-.}"

for repo in "${REPOS[@]}"; do
  safe="${repo//\//-}"
  out="$OUT_DIR/.cursorrules-$safe"
  echo "→ $repo → $out"
  curl -sL "$BASE/api/raw?repo=$repo" -o "$out" && echo "  OK ($(wc -c < "$out") bytes)" || echo "  FAIL"
done
echo "Done."
