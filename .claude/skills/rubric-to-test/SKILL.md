---
name: rubric-to-test
description: Convert a free-text rubric, answer key, study guide, or Q&A list into a Tester app test JSON file (format v1). Trigger when the user asks to "turn this rubric into a test", "make a test JSON", "convert these questions/answers into the test format", or similar.
---

# Rubric → Test JSON

Convert free-text questions-and-answers into a JSON file the **Tester** app can upload.
Support three question types: multiple-choice (single answer), multiple-select (one or
more answers), and true/false. An optional per-question `explanation` may be attached.

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
      "prompt": "Which layer does TCP operate at?",
      "options": [
        { "id": "a", "text": "Application" },
        { "id": "b", "text": "Transport" },
        { "id": "c", "text": "Network" }
      ],
      "correct": ["b"],
      "explanation": "TCP is a Transport-layer protocol."
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
| `title` | Non-empty string. Derive from the rubric heading or topic. |
| `description` | Optional string. Omit the field if there is nothing useful to say. |
| `questions` | Non-empty array. |
| `question.id` | Unique string within the test. Use `q1`, `q2`, … |
| `question.type` | One of `"multiple-choice"`, `"multiple-select"`, `"true-false"`. |
| `question.prompt` | Non-empty string — the question text. |
| `question.options` | Required for `multiple-choice`/`multiple-select`; **omit entirely** for `true-false`. At least 2 options; each has a unique `id` (`a`, `b`, `c`, …) and a `text`. |
| `question.correct` | For choice types: an **array of option ids** (`["b"]`, `["a","c"]`). For `true-false`: a **boolean** (`true`/`false`), not an array. |
| `question.explanation` | Optional string. Include only when the rubric gives a rationale for the answer. |

## Choosing the type

- **true/false** — the question is a single statement to judge as true or false. Use a
  boolean `correct`; do **not** add an `options` array.
- **multiple-choice** — several options, exactly **one** correct. `correct` has length 1.
- **multiple-select** — several options, **one or more** correct ("select all that apply",
  or the rubric marks multiple answers right). `correct` may have length ≥ 1.

When unsure between single and multi: if the rubric lists more than one correct option,
it is `multiple-select`.

## Conversion steps

1. Read the whole rubric; identify each distinct question and its solution.
2. For each question: classify the type, write a clean `prompt`.
3. For choice types, enumerate the options with stable ids `a`, `b`, `c`, … and map the
   marked solution(s) into `correct` (array of those ids).
4. For true/false, set `correct` to the boolean and omit `options`.
5. If the rubric explains *why* an answer is right, copy that into `explanation`.
6. Assign sequential `q1`, `q2`, … ids. Give the test a `title`.

## Validation checklist (the app enforces these — verify before handing over)

- `version` is exactly `1`; `title` non-empty; `questions` non-empty.
- Every `question.id` is unique; every `prompt` non-empty.
- `type` is one of the three allowed values.
- Choice questions: `options` has ≥ 2 entries with **unique** option ids; `correct` is a
  non-empty array of ids that all exist in `options`.
- `multiple-choice`: `correct` has **exactly one** id.
- `true-false`: `correct` is a boolean and there is **no** `options` field.
- `explanation`, when present, is a string.

## Worked example

**Input rubric:**

```
1. What is the capital of France? (a) Berlin (b) Paris (c) Rome — Answer: Paris.
   Paris has been the capital since 987 AD.
2. Which of these are prime? 2, 4, 5, 9 — Answers: 2 and 5.
3. The Earth is flat. (T/F) — False.
```

**Output (`france-quiz.test.json`):**

```json
{
  "version": 1,
  "title": "Mixed Quiz",
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "prompt": "What is the capital of France?",
      "options": [
        { "id": "a", "text": "Berlin" },
        { "id": "b", "text": "Paris" },
        { "id": "c", "text": "Rome" }
      ],
      "correct": ["b"],
      "explanation": "Paris has been the capital of France since 987 AD."
    },
    {
      "id": "q2",
      "type": "multiple-select",
      "prompt": "Which of these numbers are prime?",
      "options": [
        { "id": "a", "text": "2" },
        { "id": "b", "text": "4" },
        { "id": "c", "text": "5" },
        { "id": "d", "text": "9" }
      ],
      "correct": ["a", "c"]
    },
    {
      "id": "q3",
      "type": "true-false",
      "prompt": "The Earth is flat.",
      "correct": false
    }
  ]
}
```

Save the result as `*.test.json` (e.g. `france-quiz.test.json`). It is then ready to
upload via the **Upload test JSON** button in the Tester app.
