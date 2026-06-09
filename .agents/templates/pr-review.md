# PR Review Template

## Review Target

- Branch:
- PR title:
- Changed files:

## Scope Check

- [ ] The PR has one clear purpose.
- [ ] The changed files match the approved scope.
- [ ] No unrelated formatting or refactor is included.
- [ ] `.env` is not staged.
- [ ] application code / tests / package files are untouched unless explicitly approved.
- [ ] real-vault files are untouched unless explicitly approved.
- [ ] SharePoint drift / registry files are untouched unless explicitly approved.

## Findings

### High

| File | Line | Issue | Suggested fix |
|---|---:|---|---|

### Medium

| File | Line | Issue | Suggested fix |
|---|---:|---|---|

### Low

| File | Line | Issue | Suggested fix |
|---|---:|---|---|

## Safety Review

- [ ] No direct push to main.
- [ ] No unapproved production apply.
- [ ] No unapproved automatic import.
- [ ] No unapproved automatic merge.
- [ ] No unapproved data cleanup.
- [ ] No AI diagnosis, classification, or evaluation of children or service users.
- [ ] Failed CI or tests are not ignored.

## Tests / Verification

- [ ] `git diff --check`
- [ ] `git status --short`
- [ ] Targeted test or docs check:

## Verdict

- [ ] Approve
- [ ] Request changes
- [ ] Comment only

## Notes

-
