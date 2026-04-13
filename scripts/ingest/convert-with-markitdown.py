import os
import sys
import argparse
import json
import time
from datetime import datetime
from markitdown import MarkItDown
from pathlib import Path

VERSION = "v0.2"

def generate_run_id():
    """Generate a unique run ID based on current timestamp."""
    return f"ingest-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

def get_tags_for_type(doc_type):
    """Determine tags based on document type."""
    type_tags = {
        "official_form": ["official"],
        "audit_manual": ["audit"],
        "meeting_note": ["meeting"]
    }
    return type_tags.get(doc_type, [])

def get_metadata_header(source_path, doc_type, domain, run_id, repo_root):
    """Generate expanded frontmatter for Markdown output."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    source_stats = os.stat(source_path)
    source_mtime = datetime.fromtimestamp(source_stats.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
    
    # Calculate relative path from repo root
    try:
        rel_source_path = os.path.relpath(source_path, repo_root)
    except ValueError:
        rel_source_path = source_path
        
    tags = get_tags_for_type(doc_type)
    tags_yaml = json.dumps(tags) # Simple array format for YAML

    return f"""---
source_file: {os.path.basename(source_path)}
source_path: {rel_source_path}
source_modified_at: "{source_mtime}"
converted_at: "{now}"
converter: markitdown
ingest_version: {VERSION}
run_id: {run_id}
document_type: {doc_type}
domain: {domain}
review_status: pending
status: ingested
tags: {tags_yaml}
---

"""

def is_supported_source(file_path):
    """Check if the file is a supported document type and not a system/temp file."""
    path = Path(file_path)
    # Supported extensions
    supported_extensions = {".xlsx", ".docx", ".pptx", ".pdf", ".jpg", ".jpeg", ".png"}
    if path.suffix.lower() not in supported_extensions:
        return False
    
    # Exclude system/temp files
    name = path.name
    if name.startswith("~$") or name.startswith(".") or name == "Thumbs.db" or name == "Desktop.ini":
        return False
        
    return True

def should_process_file(source_path, target_path, force=False):
    """Determine if a file needs conversion based on mtime or force flag."""
    if force or not os.path.exists(target_path):
        return True, None
        
    source_mtime = os.path.getmtime(source_path)
    target_mtime = os.path.getmtime(target_path)
    
    if source_mtime > target_mtime:
        return True, None
        
    return False, "Source not modified since last conversion"

def collect_source_files(source_path):
    """Collect all valid source files from a file or directory."""
    source = Path(source_path)
    files = []
    
    if source.is_file():
        if is_supported_source(source):
            files.append(source)
    elif source.is_dir():
        for item in source.rglob("*"): # Recursive scan
            if item.is_file() and is_supported_source(item):
                files.append(item)
    
    return files

def process_file(source_path, target_dir, doc_type, domain, run_id, repo_root, force=False):
    """Process a single file: convert to MD if needed."""
    start_time = time.time()
    md = MarkItDown()
    
    # Create target filenames
    base_name = os.path.splitext(os.path.basename(source_path))[0]
    target_path = os.path.join(target_dir, f"{base_name}.md")
    
    # Check if we should skip
    should_run, reason = should_process_file(source_path, target_path, force)
    if not should_run:
        return {
            "source": str(source_path),
            "target": target_path,
            "document_type": doc_type,
            "status": "skipped",
            "skipped_reason": reason,
            "duration_ms": int((time.time() - start_time) * 1000)
        }

    try:
        print(f"Converting: {source_path}")
        result = md.convert(str(source_path))
        
        # Add metadata header
        header = get_metadata_header(source_path, doc_type, domain, run_id, repo_root)
        full_content = header + result.text_content
        
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(full_content)
            
        return {
            "source": str(source_path),
            "target": target_path,
            "document_type": doc_type,
            "status": "success",
            "duration_ms": int((time.time() - start_time) * 1000)
        }
    except Exception as e:
        error_msg = str(e)
        print(f"Error {source_path}: {error_msg}")
        return {
            "source": str(source_path),
            "target": target_path,
            "document_type": doc_type,
            "status": "failed",
            "error": error_msg,
            "duration_ms": int((time.time() - start_time) * 1000)
        }

def write_reports(summary, output_dir, run_id):
    """Save JSON and Markdown reports."""
    reports_dir = Path(output_dir).parent / "_reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    json_path = reports_dir / f"{run_id}.json"
    md_path = reports_dir / f"{run_id}.md"
    
    # Write JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    # Write Markdown
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Ingest Run Report: {run_id}\n\n")
        f.write(f"- **Started At**: {summary['started_at']}\n")
        f.write(f"- **Finished At**: {summary['finished_at']}\n")
        f.write(f"- **Duration**: {summary['duration_ms']} ms\n\n")
        
        f.write("## Summary\n\n")
        f.write("| Metric | Value |\n")
        f.write("| :--- | :--- |\n")
        f.write(f"| Total | {summary['total']} |\n")
        f.write(f"| Processed | {summary['processed']} |\n")
        f.write(f"| Succeeded | {summary['succeeded']} |\n")
        f.write(f"| Failed | {summary['failed']} |\n")
        f.write(f"| Skipped | {summary['skipped']} |\n")
        f.write(f"| Success Rate | {summary['success_rate']:.1f}% |\n\n")
        
        if summary['failed'] > 0:
            f.write("## ❌ Failures\n\n")
            for item in [i for i in summary['items'] if i['status'] == 'failed']:
                f.write(f"- **Source**: `{os.path.basename(item['source'])}`\n")
                f.write(f"  - Error: {item.get('error')}\n")
            f.write("\n")
            
        f.write("## ✅ Successes\n\n")
        for item in [i for i in summary['items'] if i['status'] == 'success']:
            f.write(f"- `{os.path.basename(item['source'])}` -> `{os.path.basename(item['target'])}` ({item['duration_ms']}ms)\n")
        f.write("\n")
        
        if summary['skipped'] > 0:
            f.write("## ⏭️ Skipped\n\n")
            for item in [i for i in summary['items'] if i['status'] == 'skipped']:
                f.write(f"- `{os.path.basename(item['source'])}` ({item.get('skipped_reason')})\n")

    print(f"\nReports saved to:")
    print(f"- {json_path}")
    print(f"- {md_path}")

def main():
    parser = argparse.ArgumentParser(description=f"Convert documents to Markdown (Version {VERSION})")
    parser.add_argument("--source", required=True, help="Path to source file or directory")
    parser.add_argument("--type", default="generic", help="Document type (official_form, audit_manual, meeting_note, etc.)")
    parser.add_argument("--domain", default="disability_welfare", help="Domain context")
    parser.add_argument("--output-dir", help="Explicit output directory")
    parser.add_argument("--force", action="store_true", help="Force re-conversion even if mtime matches")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without performing them")
    
    args = parser.parse_args()
    
    run_id = generate_run_id()
    started_at_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    start_time = time.time()
    repo_root = str(Path(__file__).parents[2])
    
    # Determine output directory
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        type_subdirs = {
            "official_form": "official_forms",
            "audit_manual": "audit_manuals",
            "meeting_note": "meeting_notes"
        }
        subdir = type_subdirs.get(args.type, "others")
        output_dir = Path("knowledge/ingested") / subdir
    
    print(f"--- Ingestion Pilot {VERSION} {'(DRY RUN)' if args.dry_run else ''} ---")
    print(f"Run ID: {run_id}")
    print(f"Target Directory: {output_dir}\n")
    
    if not args.dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)
    
    files_to_process = collect_source_files(args.source)
    if not files_to_process:
        print(f"No supported files found in: {args.source}")
        sys.exit(0)
        
    results = []
    for file in files_to_process:
        if args.dry_run:
            print(f"[DRY-RUN] Would process: {file}")
            continue
        
        result = process_file(file, str(output_dir), args.type, args.domain, run_id, repo_root, args.force)
        results.append(result)

    if args.dry_run:
        return

    # Aggregate summary
    total = len(files_to_process)
    succeeded = len([r for r in results if r['status'] == 'success'])
    failed = len([r for r in results if r['status'] == 'failed'])
    skipped = len([r for r in results if r['status'] == 'skipped'])
    processed = succeeded + failed
    
    finished_at_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    duration_ms = int((time.time() - start_time) * 1000)
    success_rate = (succeeded / processed * 100) if processed > 0 else 100.0 if skipped == total else 0.0

    summary = {
        "run_id": run_id,
        "started_at": started_at_str,
        "finished_at": finished_at_str,
        "duration_ms": duration_ms,
        "total": total,
        "processed": processed,
        "skipped": skipped,
        "succeeded": succeeded,
        "failed": failed,
        "success_rate": success_rate,
        "items": results
    }

    # Save reports
    write_reports(summary, str(output_dir), run_id)
    
    print(f"\n--- Ingestion Completed ---")
    print(f"Total: {total}, Success: {succeeded}, Failed: {failed}, Skipped: {skipped}")

if __name__ == "__main__":
    main()
