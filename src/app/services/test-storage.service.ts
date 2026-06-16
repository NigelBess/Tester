import { Injectable } from '@angular/core';
import {
  AnswerValue,
  Question,
  QuestionType,
  StoredTest,
  TestFile,
  TestStats,
} from '../models/test.model';

/** A non-empty image reference is required when the field is present. */
function validateImageField(value: unknown, where: string): void {
  if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
    throw new Error(`${where}: "image" must be a non-empty string when present.`);
  }
}

const TESTS_KEY = 'tester.tests';
const STATS_KEY = 'tester.stats';

const VALID_TYPES: QuestionType[] = [
  'multiple-choice',
  'multiple-select',
  'true-false',
];

/**
 * Single source of truth for tests + cumulative question stats, backed by
 * localStorage. No backend.
 */
@Injectable({ providedIn: 'root' })
export class TestStorageService {
  // --- Tests ---

  listTests(): StoredTest[] {
    return this.readJson<StoredTest[]>(TESTS_KEY, []);
  }

  getTest(id: string): StoredTest | undefined {
    return this.listTests().find((t) => t.id === id);
  }

  /**
   * Validate a raw JSON string, import it as a new test, and persist it.
   * Throws an Error with a human-readable message on invalid input.
   */
  addTest(rawJson: string): StoredTest {
    const file = this.validateTestJson(rawJson);
    const stored: StoredTest = {
      ...file,
      id: this.uuid(),
      createdAt: Date.now(),
    };
    const tests = this.listTests();
    tests.push(stored);
    this.writeJson(TESTS_KEY, tests);
    return stored;
  }

  deleteTest(id: string): void {
    const tests = this.listTests().filter((t) => t.id !== id);
    this.writeJson(TESTS_KEY, tests);
    const allStats = this.readJson<Record<string, TestStats>>(STATS_KEY, {});
    delete allStats[id];
    this.writeJson(STATS_KEY, allStats);
  }

  // --- Stats ---

  getStats(testId: string): TestStats {
    const allStats = this.readJson<Record<string, TestStats>>(STATS_KEY, {});
    return allStats[testId] ?? {};
  }

  /**
   * Record an attempt's per-question outcome into cumulative stats.
   * `outcomes` maps questionId -> wasCorrect.
   */
  recordResult(testId: string, outcomes: Record<string, boolean>): void {
    const allStats = this.readJson<Record<string, TestStats>>(STATS_KEY, {});
    const testStats: TestStats = allStats[testId] ?? {};
    for (const [questionId, wasCorrect] of Object.entries(outcomes)) {
      const stat = testStats[questionId] ?? { correct: 0, wrong: 0 };
      if (wasCorrect) {
        stat.correct += 1;
      } else {
        stat.wrong += 1;
      }
      testStats[questionId] = stat;
    }
    allStats[testId] = testStats;
    this.writeJson(STATS_KEY, allStats);
  }

  // --- Validation ---

  /** Parse + validate a JSON test file. Returns a TestFile or throws. */
  validateTestJson(rawJson: string): TestFile {
    let data: unknown;
    try {
      data = JSON.parse(rawJson);
    } catch (e) {
      throw new Error('File is not valid JSON.');
    }

    if (typeof data !== 'object' || data === null) {
      throw new Error('Test file must be a JSON object.');
    }
    const obj = data as Record<string, unknown>;

    if (obj['version'] !== 1) {
      throw new Error('Unsupported "version" — expected 1.');
    }
    if (typeof obj['title'] !== 'string' || !obj['title'].trim()) {
      throw new Error('Test must have a non-empty "title".');
    }
    if (!Array.isArray(obj['questions']) || obj['questions'].length === 0) {
      throw new Error('Test must have a non-empty "questions" array.');
    }

    const seenIds = new Set<string>();
    obj['questions'].forEach((q, i) =>
      this.validateQuestion(q, i, seenIds)
    );

    return obj as unknown as TestFile;
  }

  private validateQuestion(
    raw: unknown,
    index: number,
    seenIds: Set<string>
  ): void {
    const where = `Question ${index + 1}`;
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`${where}: must be an object.`);
    }
    const q = raw as Record<string, unknown>;

    if (typeof q['id'] !== 'string' || !q['id'].trim()) {
      throw new Error(`${where}: missing string "id".`);
    }
    if (seenIds.has(q['id'])) {
      throw new Error(`${where}: duplicate id "${q['id']}".`);
    }
    seenIds.add(q['id']);

    if (typeof q['prompt'] !== 'string' || !q['prompt'].trim()) {
      throw new Error(`${where}: missing string "prompt".`);
    }

    const type = q['type'];
    if (typeof type !== 'string' || !VALID_TYPES.includes(type as QuestionType)) {
      throw new Error(
        `${where}: "type" must be one of ${VALID_TYPES.join(', ')}.`
      );
    }

    if (q['explanation'] !== undefined && typeof q['explanation'] !== 'string') {
      throw new Error(`${where}: "explanation" must be a string when present.`);
    }

    validateImageField(q['image'], where);

    if (type === 'true-false') {
      if (typeof q['correct'] !== 'boolean') {
        throw new Error(`${where}: true-false "correct" must be a boolean.`);
      }
      return;
    }

    // multiple-choice / multiple-select
    if (!Array.isArray(q['options']) || q['options'].length < 2) {
      throw new Error(`${where}: needs an "options" array with at least 2 items.`);
    }
    const optionIds = new Set<string>();
    q['options'].forEach((opt, j) => {
      if (typeof opt !== 'object' || opt === null) {
        throw new Error(`${where}, option ${j + 1}: must be an object.`);
      }
      const o = opt as Record<string, unknown>;
      if (typeof o['id'] !== 'string' || !o['id'].trim()) {
        throw new Error(`${where}, option ${j + 1}: missing string "id".`);
      }
      if (optionIds.has(o['id'])) {
        throw new Error(`${where}: duplicate option id "${o['id']}".`);
      }
      optionIds.add(o['id']);
      if (typeof o['text'] !== 'string') {
        throw new Error(`${where}, option ${j + 1}: missing string "text".`);
      }
      validateImageField(o['image'], `${where}, option ${j + 1}`);
    });

    if (
      !Array.isArray(q['correct']) ||
      q['correct'].some((c) => typeof c !== 'string')
    ) {
      throw new Error(`${where}: "correct" must be an array of option ids.`);
    }
    const correct = q['correct'] as string[];
    if (correct.length === 0) {
      throw new Error(`${where}: "correct" must list at least one option id.`);
    }
    if (type === 'multiple-choice' && correct.length !== 1) {
      throw new Error(
        `${where}: multiple-choice must have exactly one correct option.`
      );
    }
    correct.forEach((c) => {
      if (!optionIds.has(c)) {
        throw new Error(`${where}: correct id "${c}" is not a defined option.`);
      }
    });
  }

  // --- Images ---

  /** Unique set of image names referenced by a test's questions and options. */
  referencedImageNames(test: TestFile): string[] {
    const names = new Set<string>();
    for (const q of test.questions) {
      if (q.image) {
        names.add(q.image);
      }
      if (q.type !== 'true-false') {
        for (const opt of q.options) {
          if (opt.image) {
            names.add(opt.image);
          }
        }
      }
    }
    return Array.from(names);
  }

  // --- Scoring helper (shared by the runner) ---

  /** Returns true if `answer` exactly matches the question's solution. */
  isAnswerCorrect(question: Question, answer: AnswerValue): boolean {
    if (question.type === 'true-false') {
      return typeof answer === 'boolean' && answer === question.correct;
    }
    if (!Array.isArray(answer)) {
      return false;
    }
    const chosen = new Set(answer);
    const correct = new Set(question.correct);
    if (chosen.size !== correct.size) {
      return false;
    }
    for (const id of correct) {
      if (!chosen.has(id)) {
        return false;
      }
    }
    return true;
  }

  // --- Internals ---

  private readJson<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  private uuid(): string {
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) {
      return c.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
}
