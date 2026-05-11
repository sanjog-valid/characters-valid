# Valid Character Library PRD

## Purpose

Valid.co editors create realistic AI character base images for ads, but those reusable characters are not centralized or searchable enough. This product becomes the internal source of truth for character images, automatic visual understanding, and semantic search.

## Users

- Editors uploading new character base images.
- Editors searching for reusable characters before creating new ones.
- Producers or leads reviewing reusable character coverage.

## Product Principles

- The editor should do the least possible work during upload.
- No editor-provided metadata is required during upload.
- Client assignment is paused for now to reduce intake resistance. Client names can still be maintained centrally if the workflow returns later.
- Manual tags are intentionally excluded for now.
- Search quality is the product: results must match how editors describe characters in real work.
- Anyone with the internal app link can use the library for now.
- Server-side credentials must remain private.

## Core Workflows

### Batch Upload

1. Editor selects or drops one or many character images.
2. The queue shows each image, status, and remove controls.
3. Editor uploads.
4. The system stores images privately, analyzes each image, creates structured attributes, generates embeddings, and marks the image ready.

### Search

1. Editor enters a natural query, for example `50 year old man black shirt`.
2. Editor can filter by processing status.
3. The system returns the closest semantic matches first.
4. Editor opens a character detail drawer to inspect attributes, source filename, and download/copy the image reference.

### Browse

1. Editor can browse all ready characters.
2. Character cards show the actual image, status, and AI-generated visual chips.
3. Processing and failed states are visible without blocking the rest of the library.

## AI Metadata

The AI pipeline generates internal metadata from the image:

- Short summary
- Apparent age range
- Gender presentation
- Wardrobe
- Dominant colors
- Expression
- Pose
- Shot type
- Background
- Style and realism cues
- Searchable phrases
- Quality notes

The system does not attempt to identify a real person.

## Search Strategy

Search combines:

- Vector similarity over generated character descriptions.
- Status filters.
- Text fallback over generated metadata when embeddings are unavailable.
- Detail-page similarity for discovering related characters.

## Non-Goals For This Stage

- Editor-authored manual tags.
- Editor-facing client creation.
- Required client assignment during upload.
- Login or Google domain enforcement for this stage.
- Public asset sharing.
- External client access.
- Complex approval workflows.

## Success Criteria

- Editors can upload a batch in under a minute excluding AI processing time.
- New images become searchable without manual tagging.
- Queries based on age, clothing, gender presentation, and role cues return useful results.
- Anyone with the internal link can search and upload without a login step.
