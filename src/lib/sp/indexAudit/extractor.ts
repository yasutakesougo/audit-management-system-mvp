export type ODataCandidateReason = 
  | 'filter' 
  | 'orderby' 
  | 'startswith' 
  | 'contains' 
  | 'comparison';

export type ODataIndexCandidate = {
  field: string;
  reason: ODataCandidateReason;
};

// Simplified Regex patterns focusing on the 70% use cases
// Comparisons: matches "Status eq 'Open'", captures "Status"
const COMPARISON_REGEX = /\b([a-zA-Z0-9_]+)\s+(eq|ne|gt|ge|lt|le)\s+/g;

// startswith: matches "startswith(Title, 'A')", captures "Title"
const STARTSWITH_REGEX = /\bstartswith\s*\(\s*([a-zA-Z0-9_]+)\s*,/g;

// contains: matches "contains(Title, 'A')", captures "Title"
const CONTAINS_REGEX = /\bcontains\s*\(\s*([a-zA-Z0-9_]+)\s*,/g;

// substringof: Microsoft OData usually allows "substringof('A', Title)", captures "Title"
const SUBSTRINGOF_REGEX = /\bsubstringof\s*\(\s*[^,]+,\s*([a-zA-Z0-9_]+)\s*\)/g;

export function extractODataIndexCandidates(input: {
  url?: string;
  filter?: string;
  orderby?: string;
}): ODataIndexCandidate[] {
  const candidates: ODataIndexCandidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (field: string, reason: ODataCandidateReason) => {
    if (!field || seen.has(field)) return;
    // OData functions or structural words shouldn't be captured, but our regex limits that.
    seen.add(field);
    candidates.push({ field, reason });
  };

  if (input.filter) {
    const f = input.filter;
    let match;

    // comparisons
    const compRegex = new RegExp(COMPARISON_REGEX);
    while ((match = compRegex.exec(f)) !== null) {
      addCandidate(match[1], 'comparison');
    }

    // startswith
    const startsRegex = new RegExp(STARTSWITH_REGEX);
    while ((match = startsRegex.exec(f)) !== null) {
      addCandidate(match[1], 'startswith');
    }

    // contains
    const contRegex = new RegExp(CONTAINS_REGEX);
    while ((match = contRegex.exec(f)) !== null) {
      addCandidate(match[1], 'contains');
    }

    // substringof
    const subRegex = new RegExp(SUBSTRINGOF_REGEX);
    while ((match = subRegex.exec(f)) !== null) {
      addCandidate(match[1], 'contains');
    }
  }

  if (input.orderby) {
    const parts = input.orderby.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // First token is the field: "Modified desc" -> "Modified"
      const field = trimmed.split(/\s+/)[0];
      if (field) {
        addCandidate(field, 'orderby');
      }
    }
  }

  return candidates;
}
