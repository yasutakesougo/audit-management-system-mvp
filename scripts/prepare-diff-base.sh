#!/usr/bin/env bash
set -euo pipefail

# Fetch the latest main to ensure origin/main is available locally.
git fetch --depth=1 origin main

# Prepare directories.
rm -rf tmp/base
mkdir -p tmp/base/openapi tmp/base/schemas

# OpenAPI base (fallback to current file if main does not have it yet).
OPENAPI_FILE="profile-hub.v1.yaml"
if git cat-file -e "origin/main:contracts/openapi/${OPENAPI_FILE}" >/dev/null 2>&1; then
  git show "origin/main:contracts/openapi/${OPENAPI_FILE}" > "tmp/base/openapi/${OPENAPI_FILE}"
elif [ -f "contracts/openapi/${OPENAPI_FILE}" ]; then
  cp "contracts/openapi/${OPENAPI_FILE}" "tmp/base/openapi/${OPENAPI_FILE}"
else
  echo "[prepare-diff-base] contracts/openapi/${OPENAPI_FILE} not found in repo; skipping OpenAPI diff base."
fi

# JSON Schemas – iterate every schema file in the repository.
for schema_path in contracts/schemas/*.json; do
  [ -e "$schema_path" ] || continue
  schema_file=$(basename "$schema_path")
  if git cat-file -e "origin/main:contracts/schemas/${schema_file}" >/dev/null 2>&1; then
    git show "origin/main:contracts/schemas/${schema_file}" > "tmp/base/schemas/${schema_file}"
  else
    # base file missing => treat as new schema
    :
  fi
done
