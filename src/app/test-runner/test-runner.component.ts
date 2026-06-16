import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AnswerValue,
  AttemptResult,
  Question,
  QuestionResult,
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

  phase: 'taking' | 'results' = 'taking';

  /** The subset of questions being asked in the current attempt. */
  activeQuestions: Question[] = [];
  answers: Record<string, AnswerValue> = {};

  result?: AttemptResult;

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
    this.result = undefined;
    this.phase = 'taking';
    window.scrollTo({ top: 0 });
  }

  setAnswer(questionId: string, value: AnswerValue): void {
    this.answers[questionId] = value;
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
