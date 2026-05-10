#!/usr/bin/env bash
# Dispatch "Perf — Lighthouse remote" via GitHub REST (workflow_dispatch on main).
# Requires: Node (JSON body), curl, GITHUB_TOKEN with workflow access.
#
#   GITHUB_TOKEN=ghp_... ./scripts/dispatch-perf-lighthouse-remote.sh 'https://….vercel.app'
#
# Optional: GITHUB_REPOSITORY=owner/name (default entrecode/pizza-districts),
#           GITHUB_REF_NAME=branch (default main).

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-entrecode/pizza-districts}"
REF="${GITHUB_REF_NAME:-main}"

usage() {
  echo "Usage: GITHUB_TOKEN=<pat> ${0##*/} <preview_base_url_no_trailing_slash>" >&2
  echo "Classic PAT: scope 'workflow'. See .github/workflows/perf-lighthouse-remote.yml." >&2
  exit 1
}

if [[ -z "${GITHUB_TOKEN:-}" ]] || [[ $# -lt 1 ]]; then
  usage
fi

BASE="${1%/}"
API="https://api.github.com/repos/${REPO}/actions/workflows/perf-lighthouse-remote.yml/dispatches"

BODY="$(node -e 'const url=process.argv[1], ref=process.argv[2]; console.log(JSON.stringify({ref,inputs:{perf_preview_url:url}}))' "$BASE" "$REF")"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
code="$(curl -sS -o "$tmp" -w '%{http_code}' -L -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -d "$BODY" \
  "$API")"

if [[ "$code" != "204" ]]; then
  echo "GitHub API HTTP ${code}" >&2
  cat "$tmp" >&2
  case "$code" in
    401) echo "Hint: invalid or expired token." >&2 ;;
    403)
      echo "Hint: classic PAT needs 'workflow' scope (or fine-grained: Actions: write on this repo)." >&2
      ;;
    404)
      echo "Hint: workflow file missing on ref '${REF}' or repo '${REPO}' wrong — use default branch that contains perf-lighthouse-remote.yml." >&2
      ;;
    422)
      echo "Hint: check workflow inputs / branch name; body was: ${BODY}" >&2
      ;;
  esac
  exit 1
fi

echo "Dispatched (HTTP ${code}). https://github.com/${REPO}/actions/workflows/perf-lighthouse-remote.yml"
