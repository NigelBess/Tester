import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AnswerValue, Question, StoredTest } from '../models/test.model';
import { TestStorageService } from '../services/test-storage.service';
import { ImageStoreService } from '../services/image-store.service';
import { prepareQuestion } from '../shared/shuffle';

/** Every question keeps at least this much chance of being picked. */
const BASE_WEIGHT = 1;
/** How strongly a high recent wrong-rate boosts a question's pick chance. */
const WRONG_SCALE = 4;

/**
 * Indefinite, self-paced practice loop: one question at a time, weighted toward
 * recently-missed questions, with immediate feedback. Exit any time to home.
 */
@Component({
  selector: 'app-practice-runner',
  templateUrl: './practice-runner.component.html',
  styleUrls: ['./practice-runner.component.scss'],
})
export class PracticeRunnerComponent implements OnInit {
  test?: StoredTest;
  notFound = false;

  phase: 'answering' | 'feedback' = 'answering';

  /** The question currently shown (a shuffled copy). */
  current?: Question;
  answer: AnswerValue = null;
  lastCorrect = false;

  /** In-memory tally for this practice session only. */
  answered = 0;
  correctCount = 0;

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
    this.nextQuestion();
  }

  /** Pick the next question by weighting and present it. */
  nextQuestion(): void {
    if (!this.test) {
      return;
    }
    const picked = this.pickQuestion(this.test.questions, this.current?.id);
    const shuffle = this.test.shuffle !== false;
    this.current = prepareQuestion(picked, shuffle);
    this.answer = picked.type === 'true-false' ? null : [];
    this.phase = 'answering';
    window.scrollTo({ top: 0 });
  }

  setAnswer(value: AnswerValue): void {
    this.answer = value;
  }

  get isAnswered(): boolean {
    if (!this.current) {
      return false;
    }
    if (this.current.type === 'true-false') {
      return typeof this.answer === 'boolean';
    }
    return Array.isArray(this.answer) && this.answer.length > 0;
  }

  /** Score the current answer, persist it, and reveal feedback. */
  check(): void {
    if (!this.test || !this.current || !this.isAnswered) {
      return;
    }
    this.lastCorrect = this.storage.isAnswerCorrect(this.current, this.answer);
    // Updates cumulative stats and the rolling history in one call.
    this.storage.recordResult(this.test.id, { [this.current.id]: this.lastCorrect });
    this.answered += 1;
    if (this.lastCorrect) {
      this.correctCount += 1;
    }
    this.phase = 'feedback';
    window.scrollTo({ top: 0 });
  }

  get sessionPercent(): number {
    return this.answered === 0
      ? 0
      : Math.round((this.correctCount / this.answered) * 100);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  /**
   * Weighted random pick. Questions missed more often recently (over their last
   * few outcomes) get higher weight; unseen questions are treated as fully
   * missed so they surface early. Every question keeps a non-zero chance.
   * `excludeId` avoids repeating the just-answered question back-to-back.
   */
  private pickQuestion(questions: Question[], excludeId?: string): Question {
    const history = this.storage.getHistory(this.test!.id);
    const pool =
      questions.length > 1 && excludeId
        ? questions.filter((q) => q.id !== excludeId)
        : questions;

    const weights = pool.map((q) => {
      const recent = history[q.id] ?? [];
      const wrongFraction =
        recent.length === 0
          ? 1
          : recent.filter((ok) => !ok).length / recent.length;
      return BASE_WEIGHT + WRONG_SCALE * wrongFraction;
    });

    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        return pool[i];
      }
    }
    return pool[pool.length - 1];
  }
}
