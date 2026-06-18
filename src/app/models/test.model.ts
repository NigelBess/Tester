// Data model for the test-taking app.
// JSON test files conform to `TestFile` (the on-disk/upload shape).
// `StoredTest` adds an app-assigned id + createdAt once imported.

export type QuestionType = 'multiple-choice' | 'multiple-select' | 'true-false';

export interface TestOption {
  id: string;
  text: string;
  /** Optional image reference (basename of a user-uploaded file, e.g. "wave-a.png"). */
  image?: string;
}

export interface ChoiceQuestion {
  id: string;
  type: 'multiple-choice' | 'multiple-select';
  prompt: string;
  /** Optional image reference (basename of a user-uploaded file). */
  image?: string;
  options: TestOption[];
  /** Array of correct option ids. Exactly one for multiple-choice. */
  correct: string[];
  explanation?: string;
}

export interface BooleanQuestion {
  id: string;
  type: 'true-false';
  prompt: string;
  /** Optional image reference (basename of a user-uploaded file). */
  image?: string;
  correct: boolean;
  explanation?: string;
}

export type Question = ChoiceQuestion | BooleanQuestion;

/** The shape of an uploaded JSON test file (format v1). */
export interface TestFile {
  version: number;
  title: string;
  description?: string;
  /** Shuffle question + option order each attempt. Defaults to true when omitted. */
  shuffle?: boolean;
  questions: Question[];
}

/** A test once imported into the app. */
export interface StoredTest extends TestFile {
  id: string;
  createdAt: number;
}

// --- Runtime / attempt types ---

/** A user's answer to a single question during an attempt. */
export type AnswerValue = string[] | boolean | null;

export interface QuestionResult {
  question: Question;
  answer: AnswerValue;
  correct: boolean;
}

export interface AttemptResult {
  testId: string;
  results: QuestionResult[];
  scoreCorrect: number;
  scoreTotal: number;
  percent: number;
}

/** A full-test attempt persisted mid-way so it can be resumed later. */
export interface SavedAttempt {
  testId: string;
  /** The prepared (shuffled) questions for this attempt, frozen so resume keeps order. */
  questions: Question[];
  /** questionId -> current answer. */
  answers: Record<string, AnswerValue>;
  savedAt: number;
}

// --- Stats ---

export interface QuestionStat {
  correct: number;
  wrong: number;
}

/** Map of questionId -> cumulative stats, keyed per test. */
export type TestStats = Record<string, QuestionStat>;

/**
 * Map of questionId -> recent answer outcomes (true = correct), most recent
 * last, capped to a small rolling window. Keyed per test. Powers practice-mode
 * weighting ("the last 6 times you answered this question").
 */
export type TestHistory = Record<string, boolean[]>;
