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
  /** Whether the answer was correct (only meaningful in review mode). */
  @Input() wasCorrect = false;

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

  // --- Review-mode helpers ---

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
