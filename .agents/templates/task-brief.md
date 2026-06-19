# Task Brief Template

## Objective

<!-- 1つの小さな目的を書く。 -->

## Background

<!-- なぜ今この作業をするのか。必要な文脈だけを書く。 -->

## Scope

- In scope:
  -
- Out of scope:
  -

## Target Files

-

## Do Not Touch

- `.env`
- application code outside the approved scope
- tests outside the approved scope
- `package.json`
- `package-lock.json`
- SharePoint drift / registry files unless explicitly approved
- real-vault files unless explicitly approved

## Acceptance Criteria

-

## Human Approval Required For

- production apply
- automatic import
- automatic merge
- package / lockfile / workflow changes
- `.env`, secret, token, authentication changes
- real-vault move / rename / edit
- SharePoint foundation or registry changes
- large-scope changes

## Verification

- `git status --short`
- `git diff --check`
-

## PR Notes

- PR title:
- Summary:
- Safety:
- Tests:
