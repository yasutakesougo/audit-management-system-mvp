## Summary

* add per-run ingest reports in JSON and Markdown under `knowledge/ingested/_reports/`
* expand Markdown frontmatter with source traceability and review metadata
* add incremental processing with mtime-based skip and `--force` override
* tighten source file filtering and remove unused ingest dependency

## What changed

### Ingest reporting

* generate a unique `run_id` for each execution
* write machine-readable `report.json`
* write human-readable `report.md`
* include totals for processed / skipped / succeeded / failed and success rate
* record per-file status, duration, error, and skipped reason

### Frontmatter expansion

Added metadata fields to generated Markdown:

* `source_path`
* `source_modified_at`
* `run_id`
* `ingest_version`
* `review_status`
* `tags`

Existing fields such as `source_file`, `converted_at`, `converter`, `document_type`, `domain`, and `status` are preserved.

### Incremental batch behavior

* skip reconversion when target exists and source mtime is not newer
* allow forced reconversion via `--force`
* keep fail-soft behavior so one file failure does not stop the whole run

### Filtering and dependency cleanup

* explicitly support `.xlsx`, `.docx`, `.pptx`, `.pdf`, `.jpg`, `.jpeg`, `.png`
* exclude temporary and system files such as `~$*`, hidden files, `.DS_Store`, and `Thumbs.db`
* remove unused `python-dotenv` from `requirements.txt`

## Validation

Validated locally with real execution, not only dry-run.

### Import / runtime contract

* install: `pip install markitdown`
* import: `from markitdown import MarkItDown`
* runtime requirement: Python 3.10+

### Execution checks

* single-file conversion generated Markdown successfully
* frontmatter output contains the new traceability fields
* `_reports/<run_id>.json` and `.md` were generated successfully
* second run skipped unchanged file as expected
* `--force` triggered reconversion as expected

## Notes

* this remains a local/CLI-based Phase 2 ingest improvement
* SharePoint-triggered automation, Power Automate integration, and ingest UI are still out of scope
* original documents remain the source of truth
* converted Markdown remains an AI-readable secondary asset and may still require light post-editing for complex layout files

## Follow-ups

* add source hash tracking for stricter change detection
* add conversion quality scoring / review priority hints
* evaluate SharePoint-connected ingestion in a later phase
