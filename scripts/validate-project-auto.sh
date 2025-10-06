#!/bin/bash
# Validate project-auto.yml workflow configuration
# This script checks if the auto-integration workflow is properly configured

set -e

WORKFLOW_FILE=".github/workflows/project-auto.yml"
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "Validating project auto-integration workflow..."

# Check if workflow file exists
if [ ! -f "$WORKFLOW_FILE" ]; then
  echo -e "${RED}✗ Workflow file not found: $WORKFLOW_FILE${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Workflow file exists${NC}"

# Check for required triggers
if grep -q "types:.*\[.*opened.*reopened.*edited.*labeled.*\]" "$WORKFLOW_FILE"; then
  echo -e "${GREEN}✓ Workflow has required triggers (opened, reopened, edited, labeled)${NC}"
else
  echo -e "${RED}✗ Workflow missing required triggers${NC}"
  exit 1
fi

# Check for Backlog label condition
if grep -q "Backlog" "$WORKFLOW_FILE"; then
  echo -e "${GREEN}✓ Workflow checks for 'Backlog' label${NC}"
else
  echo -e "${RED}✗ Workflow missing 'Backlog' label check${NC}"
  exit 1
fi

# Check for project URL
if grep -q "project-url:" "$WORKFLOW_FILE"; then
  echo -e "${GREEN}✓ Workflow has project URL configured${NC}"
else
  echo -e "${RED}✗ Workflow missing project URL${NC}"
  exit 1
fi

# Check for required permissions
if grep -q "issues: write" "$WORKFLOW_FILE" && \
   grep -q "repository-projects: write" "$WORKFLOW_FILE"; then
  echo -e "${GREEN}✓ Workflow has required permissions${NC}"
else
  echo -e "${RED}✗ Workflow missing required permissions${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}All checks passed!${NC}"
echo "The project auto-integration workflow is properly configured."
