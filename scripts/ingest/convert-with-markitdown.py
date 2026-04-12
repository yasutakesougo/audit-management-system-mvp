import os
import sys
import argparse
from datetime import datetime
from markitdown import MarkItDown
from pathlib import Path

def get_metadata_header(source_path, doc_type, domain):
    now = datetime.now().strftime("%Y-%m-%d")
    return f"""---
source_file: {os.path.basename(source_path)}
converted_at: {now}
converter: markitdown
document_type: {doc_type}
domain: {domain}
status: ingested
---

"""

def process_file(source_path, target_dir, doc_type, domain):
    md = MarkItDown()
    try:
        print(f"Converting: {source_path}")
        result = md.convert(source_path)
        
        # Create target filename
        base_name = os.path.splitext(os.path.basename(source_path))[0]
        target_path = os.path.join(target_dir, f"{base_name}.md")
        
        # Add metadata header
        header = get_metadata_header(source_path, doc_type, domain)
        full_content = header + result.text_content
        
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(full_content)
            
        print(f"Saved to: {target_path}")
        return True
    except Exception as e:
        print(f"Error converting {source_path}: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Convert documents to Markdown using MarkItDown")
    parser.add_argument("--source", required=True, help="Path to source file or directory")
    parser.add_argument("--type", default="generic", help="Document type (official_form, audit_manual, etc.)")
    parser.add_argument("--domain", default="disability_welfare", help="Domain (disability_welfare, etc.)")
    parser.add_argument("--output-dir", help="Explicit output directory (default based on type)")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without performing them")
    
    args = parser.parse_args()
    
    source_path = Path(args.source)
    
    # Determine output directory
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        # Default mapping based on type
        type_subdirs = {
            "official_form": "official_forms",
            "audit_manual": "audit_manuals",
            "meeting_note": "meeting_notes"
        }
        subdir = type_subdirs.get(args.type, "others")
        output_dir = Path("knowledge/ingested") / subdir
    
    print(f"--- Ingestion {'(DRY RUN)' if args.dry_run else ''} ---")
    print(f"Target Directory: {output_dir}")
    
    if not args.dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)
    
    files_to_process = []
    if source_path.is_file():
        files_to_process.append(source_path)
    elif source_path.is_dir():
        for file in source_path.iterdir():
            if file.suffix.lower() in [".xlsx", ".docx", ".pptx", ".pdf", ".jpg", ".png"]:
                files_to_process.append(file)
    else:
        print(f"Error: Source path {source_path} not found.")
        sys.exit(1)
        
    for file in files_to_process:
        if args.dry_run:
            print(f"[SKIPPED] {file} -> {output_dir}")
        else:
            process_file(str(file), str(output_dir), args.type, args.domain)

if __name__ == "__main__":
    main()
