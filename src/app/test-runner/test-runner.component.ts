import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AnswerValue,
  AttemptResult,
  Question,
  QuestionResult,
  SavedAttempt,
  StoredTest,
} from '../models/test.model';
import { TestStorageService } from '../services/test-storage.service';
import { ImageStoreService } from '../services/image-store.service';
import { prepareQuestion, shuffled } from '../shared/shuffle';

@Component({
  selector: 'app-test-runner',
  templateUrl: './test-runner.component.html',
  styleUrls: ['./test-runner.component.scss'],
})
export class TestRunnerComponent implements OnInit {
  test?: StoredTest;
  notFound = false;

  phase: 'resume-prompt' | 'taking' | 'results' = 'taking';

  /** The subset of questions being asked in the current attempt. */
  activeQuestions: Question[] = [];
  answers: Record<string, AnswerValue> = {};

  result?: AttemptResult;

  /** A saved in-progress attempt awaiting the user's resume/start-fresh choice. */
  private pendingAttempt?: SavedAttempt;
  /** When the pending attempt was last saved (for the resume prompt). */
  savedAt?: number;
  /** When the current attempt was last auto-saved (drives the "Saved" indicator). */
  lastSaved?: number;

  /** When on, each answer is graded live as it's picked (without revealing the answer). */
  instantFeedback = false;

  /** Resolved image-name -> objectUrl map for the loaded test. */
  imageUrls = new Map<string, string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storage: TestStorageService,
    private images: ImageStoreService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.test = this.storage.getTest(id);
    if (!this.test) {
      this.notFound = true;
      return;
    }
    const names = this.storage.referencedImageNames(this.test);
    if (names.length) {
      this.images
        .resolveUrls(this.test.id, names)
        .then((map) => (this.imageUrls = map));
    }

    // Offer to resume a saved attempt if one exists and still matches this test.
    const saved = this.storage.getAttempt(this.test.id);
    if (saved && this.attemptMatchesTest(saved, this.test)) {
      this.pendingAttempt = saved;
      this.savedAt = saved.savedAt;
      this.phase = 'resume-prompt';
      return;
    }
    this.startAttempt(this.test.questions);
  }

  /** A saved attempt is usable only if its questions still match the test. */
  private attemptMatchesTest(saved: SavedAttempt, test: StoredTest): boolean {
    const savedIds = new Set(saved.questions.map((q) => q.id));
    const testIds = new Set(test.questions.map((q) => q.id));
    if (savedIds.size !== testIds.size) {
      return false;
    }
    for (const id of testIds) {
      if (!savedIds.has(id)) {
        return false;
      }
    }
    return true;
  }

  resumeAttempt(): void {
    if (!this.pendingAttempt) {
      return;
    }
    this.activeQuestions = this.pendingAttempt.questions;
    this.answers = this.pendingAttempt.answers;
    this.instantFeedback = this.pendingAttempt.instantFeedback ?? false;
    this.lastSaved = this.pendingAttempt.savedAt;
    this.pendingAttempt = undefined;
    this.result = undefined;
    this.phase = 'taking';
    window.scrollTo({ top: 0 });
  }

  startFresh(): void {
    if (!this.test) {
      return;
    }
    this.storage.clearAttempt(this.test.id);
    this.pendingAttempt = undefined;
    this.startAttempt(this.test.questions);
  }

  private startAttempt(questions: Question[]): void {
    // Shuffle (unless the test opts out with "shuffle": false). We shuffle on
    // copies so the stored test is never mutated; option order is randomised on
    // a copied options array, leaving option ids — which scoring relies on —
    // untouched. Each attempt (including retakes) re-shuffles.
    const shuffle = this.test?.shuffle !== false;
    const prepared = questions.map((q) => prepareQuestion(q, shuffle));
    this.activeQuestions = shuffle ? shuffled(prepared) : prepared;

    this.answers = {};
    for (const q of this.activeQuestions) {
      this.answers[q.id] = q.type === 'true-false' ? null : [];
    }
    this.lastSaved = undefined;
    this.instantFeedback = false;
    this.result = undefined;
    this.phase = 'taking';
    window.scrollTo({ top: 0 });
  }

  setAnswer(questionId: string, value: AnswerValue): void {
    this.answers[questionId] = value;
    this.autoSave();
  }

  /** Toggle live grading; persist so it survives save/resume. */
  setInstantFeedback(on: boolean): void {
    this.instantFeedback = on;
    this.autoSave();
  }

  /** Whether the current answer to `q` is correct (for live feedback). */
  liveCorrect(q: Question): boolean {
    return this.storage.isAnswerCorrect(q, this.answers[q.id]);
  }

  /** Persist the current in-progress attempt so it can be resumed later. */
  private autoSave(): void {
    if (!this.test || this.phase !== 'taking') {
      return;
    }
    const savedAt = Date.now();
    this.storage.saveAttempt({
      testId: this.test.id,
      questions: this.activeQuestions,
      answers: this.answers,
      instantFeedback: this.instantFeedback,
      savedAt,
    });
    this.lastSaved = savedAt;
  }

  saveAndExit(): void {
    this.autoSave();
    this.goHome();
  }

  get answeredCount(): number {
    return this.activeQuestions.filter((q) => this.isAnswered(q)).length;
  }

  isAnswered(q: Question): boolean {
    const a = this.answers[q.id];
    if (q.type === 'true-false') {
      return typeof a === 'boolean';
    }
    return Array.isArray(a) && a.length > 0;
  }

  /** Number of answered questions that are currently correct (for instant feedback). */
  get liveCorrectCount(): number {
    return this.activeQuestions.filter(
      (q) => this.isAnswered(q) && this.liveCorrect(q)
    ).length;
  }

  /** Percent correct among answered questions so far. */
  get livePercent(): number {
    return this.answeredCount
      ? Math.round((this.liveCorrectCount / this.answeredCount) * 100)
      : 0;
  }

  get allAnswered(): boolean {
    return this.answeredCount === this.activeQuestions.length;
  }

  submit(): void {
    if (!this.test) {
      return;
    }
    const results: QuestionResult[] = this.activeQuestions.map((q) => {
      const answer = this.answers[q.id];
      return {
        question: q,
        answer,
        correct: this.storage.isAnswerCorrect(q, answer),
      };
    });

    const scoreCorrect = results.filter((r) => r.correct).length;
    const scoreTotal = results.length;

    const outcomes: Record<string, boolean> = {};
    results.forEach((r) => (outcomes[r.question.id] = r.correct));
    this.storage.recordResult(this.test.id, outcomes);
    // The attempt is finished; the in-progress save is no longer needed.
    this.storage.clearAttempt(this.test.id);

    this.result = {
      testId: this.test.id,
      results,
      scoreCorrect,
      scoreTotal,
      percent: Math.round((scoreCorrect / scoreTotal) * 100),
    };
    this.phase = 'results';
    window.scrollTo({ top: 0 });
  }

  retakeFull(): void {
    if (this.test) {
      this.startAttempt(this.test.questions);
    }
  }

  retakeWrong(): void {
    if (!this.result) {
      return;
    }
    const wrong = this.result.results
      .filter((r) => !r.correct)
      .map((r) => r.question);
    this.startAttempt(wrong);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
