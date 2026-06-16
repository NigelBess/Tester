---
name: rubric-to-test
description: Convert one or more source files (PDFs and/or markdown/text rubrics, answer keys, study guides, Q&A lists) into a single Tester app test JSON file (format v1). Questions and options may reference images by filename; the user uploads those image files in the app. Trigger when the user asks to "turn these PDFs/rubric into a test", "make a test JSON from these files", "convert these questions into the test format", or similar.
---

# Rubric / PDF / Markdown → Test JSON

Convert free-text questions-and-answers — spread across **one or more** input files
(PDFs and/or markdown/text) — into a **single** JSON file the **Tester** app can upload.
Support three question types: multiple-choice (single answer), multiple-select (one or
more answers), and true/false. Questions and options may also reference an **image by
filename**; the image bytes are NOT embedded — the user uploads the image files in the
app, which matches them to questions by filename.

## Inputs

- **PDF files** — read each one with the Read tool (PDF pages render visually, so you can
  read both text and figures).
- **Markdown / text files** — read as raw text. These often "point at" images using
  markdown image syntax `![caption](path/to/fig1.png)` or by naming a figure.
- There may be several files. **Merge all questions into ONE test**, assigning globally
  unique ids (`q1`, `q2`, … continuing across files — do not restart per file).

## Output format (version 1)

```json
{
  "version": 1,
  "title": "Test title",
  "description": "Optional one-line description",
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "prompt": "Which waveform does this circuit produce?",
      "image": "oscillator.png",
      "options": [
        { "id": "a", "text": "Sine" },
        { "id": "b", "text": "Square", "image": "wave-b.png" }
      ],
      "correct": ["b"],
      "explanation": "The Schmitt-trigger relaxation oscillator outputs a square wave."
    },
    {
      "id": "q2",
      "type": "multiple-select",
      "prompt": "Select all private IPv4 ranges.",
      "options": [
        { "id": "a", "text": "10.0.0.0/8" },
        { "id": "b", "text": "8.8.8.0/24" },
        { "id": "c", "text": "192.168.0.0/16" }
      ],
      "correct": ["a", "c"]
    },
    {
      "id": "q3",
      "type": "true-false",
      "prompt": "UDP guarantees delivery.",
      "correct": false,
      "explanation": "UDP is connectionless and best-effort."
    }
  ]
}
```

## Field rules

| Field | Rule |
|-------|------|
| `version` | Always the number `1`. |
| `title` | Non-empty string. Derive from the source headings/topic. |
| `description` | Optional string. Omit if there is nothing useful to say. |
| `shuffle` | **Optional** boolean. The app shuffles question order and multiple-choice option order on every attempt; defaults to `true`. Set `false` only if order is meaningful (e.g. a sequenced walkthrough). |
| `questions` | Non-empty array; merged from all input files. |
| `question.id` | Unique string **across all merged files**. Use `q1`, `q2`, … |
| `question.type` | One of `"multiple-choice"`, `"multiple-select"`, `"true-false"`. |
| `question.prompt` | Non-empty string — the question text. |
| `question.image` | **Optional.** The **basename** of an image file the user will upload (e.g. `"fig1.png"`). Never a path, URL, or embedded data. |
| `question.options` | Required for choice types; **omit** for `true-false`. ≥ 2 options; each has a unique `id` (`a`, `b`, …) and `text`. |
| `option.image` | **Optional.** Same rule as `question.image` — a bare filename. |
| `question.correct` | Choice types: **array of option ids** (`["b"]`, `["a","c"]`). `true-false`: a **boolean**. |
| `question.explanation` | Optional string; include when the source gives a rationale. |

## Images: how to reference them

- When a question (or an option) depends on a figure/diagram, set its `image` to the
  **basename** of the referenced file. Examples:
  - Markdown `![Figure 1](images/circuit.png)` → `"image": "circuit.png"`.
  - A PDF that says "see Figure 2 (fig2.png)" → `"image": "fig2.png"`.
- If a figure is referenced but has no filename, **invent a stable, descriptive basename**
  (e.g. `"q4-circuit.png"`) and tell the user to save that figure under that exact name.
- Do **not** embed base64, do **not** use absolute paths or URLs — just the filename.

## Choosing the type

- **true/false** — a single statement to judge. Boolean `correct`; no `options`.
- **multiple-choice** — several options, exactly **one** correct (`correct` length 1).
- **multiple-select** — several options, **one or more** correct ("select all that apply",
  or multiple answers marked right).

## Conversion steps

1. Read every input file (PDFs visually; markdown/text as raw text).
2. Identify each distinct question and its solution, across all files.
3. For each: classify the type, write a clean `prompt`.
4. Map any referenced figure to an `image` basename on the question and/or option.
5. For choice types, enumerate options with ids `a`, `b`, … and fill `correct` with ids.
   For true/false, set the boolean `correct` and omit `options`.
6. Copy any rationale into `explanation`.
7. Assign sequential unique ids `q1`, `q2`, … across the whole merged set; give a `title`.
8. Save as a single `*.test.json` file.

## Validation checklist (the app enforces these — verify before handing over)

- `version` is exactly `1`; `title` non-empty; `questions` non-empty.
- Every `question.id` is **unique across the merged output**; every `prompt` non-empty.
- `type` is one of the three allowed values.
- Choice questions: `options` has ≥ 2 entries with **unique** option ids; `correct` is a
  non-empty array of ids that all exist in `options`.
- `multiple-choice`: `correct` has **exactly one** id.
- `true-false`: `correct` is a boolean and there is **no** `options` field.
- `explanation`, when present, is a string.
- Every `image` (on questions and options), when present, is a **non-empty bare
  filename** (no path/URL/data).

## Hand-off note (always do this)

After writing the JSON, list the **exact set of image filenames** referenced (the union
of all `image` values). Tell the user:

> Upload these images in the app (open the test card → **Upload images**): `oscillator.png`, `wave-b.png`

so the figures render. The app matches uploaded files to questions by filename and shows
a placeholder for any not yet uploaded.

## Worked multi-file example

**Inputs:**

`networking.pdf` (contains):
```
1. Which OSI layer does TCP operate at? (a) Application (b) Transport (c) Network
   Answer: Transport. TCP is a Layer-4 protocol.
2. UDP guarantees delivery. (T/F) — False.
```

`circuits.md` (contains):
```
3. Which waveform does this circuit produce? ![oscillator](figs/oscillator.png)
   (a) Sine  (b) Square ![square](figs/wave-b.png)
   Answer: Square.
```

**Output (`combined.test.json`):**

```json
{
  "version": 1,
  "title": "Combined Quiz",
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "prompt": "Which OSI layer does TCP operate at?",
      "options": [
        { "id": "a", "text": "Application" },
        { "id": "b", "text": "Transport" },
        { "id": "c", "text": "Network" }
      ],
      "correct": ["b"],
      "explanation": "TCP is a Layer-4 (Transport) protocol."
    },
    {
      "id": "q2",
      "type": "true-false",
      "prompt": "UDP guarantees delivery.",
      "correct": false
    },
    {
      "id": "q3",
      "type": "multiple-choice",
      "prompt": "Which waveform does this circuit produce?",
      "image": "oscillator.png",
      "options": [
        { "id": "a", "text": "Sine" },
        { "id": "b", "text": "Square", "image": "wave-b.png" }
      ],
      "correct": ["b"]
    }
  ]
}
```

> Upload these images in the app: `oscillator.png`, `wave-b.png`

Save the result as `*.test.json` (e.g. `combined.test.json`), then upload it via the
**Upload test JSON** button in the Tester app and use **Upload images** on the test card
to provide the referenced image files.
