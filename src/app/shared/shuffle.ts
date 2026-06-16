import { Question } from '../models/test.model';

/** Fisher–Yates shuffle returning a new array (input is not mutated). */
export function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Copy a question, shuffling its options (choice types only) when enabled.
 * Option ids — which scoring relies on — are left untouched.
 */
export function prepareQuestion(q: Question, shuffle: boolean): Question {
  if (q.type === 'true-false') {
    return q;
  }
  return { ...q, options: shuffle ? shuffled(q.options) : q.options };
}
