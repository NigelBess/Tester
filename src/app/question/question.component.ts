import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AnswerValue, Question } from '../models/test.model';

@Component({
  selector: 'app-question',
  templateUrl: './question.component.html',
  styleUrls: ['./question.component.scss'],
})
export class QuestionComponent {
  @Input({ required: true }) question!: Question;
  @Input() index = 0;

  /** Current answer for this question. */
  @Input() answer: AnswerValue = null;
  @Output() answerChange = new EventEmitter<AnswerValue>();

  /** When true, the component is read-only and shows correct/chosen highlighting. */
  @Input() review = false;
  /**
   * When true, grade the answer live as it's picked — tint only the chosen
   * option and show a result icon, without revealing the correct option.
   */
  @Input() instantFeedback = false;
  /** Whether the answer is correct (meaningful in review or instant-feedback mode). */
  @Input() wasCorrect = false;

  /** Resolved image-name -> objectUrl map for this test. */
  @Input() imageUrls: Map<string, string> = new Map();

  /** Object URL for an image name, or undefined if not uploaded yet. */
  imageUrl(name: string | undefined): string | undefined {
    return name ? this.imageUrls.get(name) : undefined;
  }

  // --- Single answer (multiple-choice + true-false) helpers ---

  get singleChoiceValue(): string | null {
    return Array.isArray(this.answer) ? this.answer[0] ?? null : null;
  }

  onSingleChoice(optionId: string): void {
    this.answerChange.emit([optionId]);
  }

  get booleanValue(): boolean | null {
    return typeof this.answer === 'boolean' ? this.answer : null;
  }

  onBoolean(value: boolean): void {
    this.answerChange.emit(value);
  }

  // --- Multi-select helpers ---

  isChecked(optionId: string): boolean {
    return Array.isArray(this.answer) && this.answer.includes(optionId);
  }

  onMultiToggle(optionId: string, checked: boolean): void {
    const current = Array.isArray(this.answer) ? [...this.answer] : [];
    const next = checked
      ? Array.from(new Set([...current, optionId]))
      : current.filter((id) => id !== optionId);
    this.answerChange.emit(next);
  }

  // --- Feedback helpers ---

  /** True when this question has a usable answer (mirrors the runner's check). */
  get answered(): boolean {
    if (this.question.type === 'true-false') {
      return typeof this.answer === 'boolean';
    }
    return Array.isArray(this.answer) && this.answer.length > 0;
  }

  /** True when live grading should be shown for this question right now. */
  get showLive(): boolean {
    return this.instantFeedback && this.answered;
  }

  isOptionCorrect(optionId: string): boolean {
    if (this.question.type === 'true-false') {
      return false;
    }
    return this.question.correct.includes(optionId);
  }

  isOptionChosen(optionId: string): boolean {
    return Array.isArray(this.answer) && this.answer.includes(optionId);
  }

  get correctBooleanValue(): boolean {
    return this.question.type === 'true-false' ? this.question.correct : false;
  }
}
