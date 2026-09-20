#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

usage() {
  cat <<'EOF'
Usage: ./run.sh [test|scrape|init-db|clean|all]

  all      Create venv, install deps, init DB, run tests, scrape (default)
  test     Create venv if needed, install deps, run unit tests
  scrape   Create venv if needed, install deps, init DB, run scraper
  init-db  Create venv if needed, install deps, initialize SQLite
  clean    Create venv if needed, install deps, run the cleaning pipeline
EOF
}

require_python() {
  local version
  if command -v python3.12 >/dev/null 2>&1; then
    PYTHON_BIN="python3.12"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "Python 3.12+ is required." >&2
    exit 1
  fi
  version="$("$PYTHON_BIN" -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
  "$PYTHON_BIN" - <<'PY'
import sys
if sys.version_info < (3, 12):
    raise SystemExit(f"Python 3.12+ is required, found {sys.version.split()[0]}")
PY
  echo "Using $PYTHON_BIN ($version)"
}

setup_venv() {
  require_python
  if [[ ! -d .venv ]]; then
    "$PYTHON_BIN" -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  python -m pip install --upgrade pip
  python -m pip install -e ".[dev]"
  if [[ ! -f config.yaml ]]; then
    cp config.example.yaml config.yaml
  fi
}

run_init_db() {
  python -m dailyvoice_scraper.cli init-db
}

run_tests() {
  python -m pytest --cov=dailyvoice_scraper
}

run_scrape() {
  python -m dailyvoice_scraper.cli scrape --max-pages 1 --max-articles 5
}

run_clean() {
  python -m dailyvoice_scraper.cli init-db
  python -m dailyvoice_scraper.cli clean
}

command="${1:-all}"
case "$command" in
  -h|--help)
    usage
    ;;
  test)
    setup_venv
    run_tests
    ;;
  init-db)
    setup_venv
    run_init_db
    ;;
  scrape)
    setup_venv
    run_init_db
    run_scrape
    ;;
  clean)
    setup_venv
    run_clean
    ;;
  all)
    setup_venv
    run_init_db
    run_tests
    run_scrape
    ;;
  *)
    usage
    exit 2
    ;;
esac
