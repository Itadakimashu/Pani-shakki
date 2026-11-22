#!/usr/bin/env bash
# Copy the shared classifier rules + test cases from the frontend (source of truth) to the backend,
# and regenerate the demo seed data for both sides.
set -euo pipefail
cd "$(dirname "$0")/.."
cp frontend/src/lib/classifier/rules.json backend/core/classifier/rules.json
cp frontend/src/lib/classifier/cases.json backend/core/tests/classifier_cases.json
python3 scripts/generate_seed.py
echo "shared files synced"
