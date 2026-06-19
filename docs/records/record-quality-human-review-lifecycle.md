# Record Quality Human Review Lifecycle

## Purpose

This document defines the lifecycle for Record Quality review metadata before any SharePoint write path, UI, workflow, or AI connection is added.

Record Quality review data is not the original support record. It is review metadata used to help a human reviewer decide whether category suggestions, missing information hints, and notes are useful.

## Invariants

- The original support record remains the source of truth.
- `sourceOfTruth` remains `original_record`.
- `outputKind` remains `review_metadata`.
- `requiresHumanReview` remains `true`.
- The original support record `body` and `content` must not be stored in review persistence payloads.
- Review metadata must not overwrite, replace, delete, or automatically update the original support record.
- Any AI output introduced later is only a review suggestion until a human reviewer accepts, revises, or discards it.

## Lifecycle

### 1. Draft

`draft` is the initial state for review metadata.

It may contain:

- suggested categories
- missing information hints
- reviewer notes
- reviewer metadata
- a reference to the original support record by ID

It must not contain:

- original support record body text
- original support record content text
- an instruction to mutate the original support record
- a final support policy decision

### 2. Accepted

`accepted` means a human reviewer has approved the review metadata as useful.

Accepted metadata can be used as supporting context for later review, monitoring preparation, or quality analysis. It still does not become the original support record, and it must not automatically write back to the original record.

### 3. Revised

`revised` means a human reviewer changed the review metadata.

Revision can adjust category suggestions, missing information hints, or notes. Revision must stay within review metadata and must not rewrite the original support record body or content.

### 4. Discarded

`discarded` means a human reviewer rejected the review metadata.

Discarded metadata can remain as review history, but it must not be used as accepted context and must not update the original support record.

## AI Boundary

If AI is connected later, its output must enter this lifecycle as review metadata only.

AI may suggest:

- candidate categories
- missing information hints
- review notes

AI must not:

- diagnose users
- judge behavior
- determine support policy
- overwrite original records
- publish or share unreviewed metadata

Human review is required before any AI-generated suggestion is used outside the review queue.

## Persistence Boundary

Persistence payloads may store review metadata such as:

- review record ID
- source support record ID
- status
- reviewer metadata
- suggested categories
- missing information hints
- reviewer notes
- timestamps

Persistence payloads must not store the original support record body or content. The link back to the source support record must be by reference, not by copying the record text.

## Out of Scope

This lifecycle does not define:

- SharePoint adapter behavior
- Graph or `spFetch` behavior
- UI behavior
- workflow integration
- AI model integration
- automatic original record updates
