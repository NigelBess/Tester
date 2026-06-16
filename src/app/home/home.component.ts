import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StoredTest } from '../models/test.model';
import { TestStorageService } from '../services/test-storage.service';

interface TestRow {
  test: StoredTest;
  questionCount: number;
  attempts: number;
  mostMissed?: { prompt: string; wrong: number; total: number };
  mostCorrect?: { prompt: string; correct: number; total: number };
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  rows: TestRow[] = [];

  constructor(
    private storage: TestStorageService,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.rows = this.storage
      .listTests()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((test) => this.buildRow(test));
  }

  private buildRow(test: StoredTest): TestRow {
    const stats = this.storage.getStats(test.id);
    const promptById = new Map(test.questions.map((q) => [q.id, q.prompt]));

    let mostMissed: TestRow['mostMissed'];
    let mostCorrect: TestRow['mostCorrect'];
    let attempts = 0;

    for (const [qid, stat] of Object.entries(stats)) {
      const total = stat.correct + stat.wrong;
      attempts = Math.max(attempts, total);
      const prompt = promptById.get(qid) ?? qid;
      if (stat.wrong > 0 && (!mostMissed || stat.wrong > mostMissed.wrong)) {
        mostMissed = { prompt, wrong: stat.wrong, total };
      }
      if (stat.correct > 0 && (!mostCorrect || stat.correct > mostCorrect.correct)) {
        mostCorrect = { prompt, correct: stat.correct, total };
      }
    }

    return {
      test,
      questionCount: test.questions.length,
      attempts,
      mostMissed,
      mostCorrect,
    };
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const test = this.storage.addTest(String(reader.result));
        this.snack.open(`Imported "${test.title}".`, 'OK', { duration: 3000 });
        this.refresh();
      } catch (e: any) {
        this.snack.open(`Import failed: ${e.message}`, 'Dismiss', {
          duration: 8000,
          panelClass: 'snack-error',
        });
      }
    };
    reader.readAsText(file);
    // Reset so selecting the same file again re-triggers change.
    input.value = '';
  }

  deleteTest(row: TestRow): void {
    if (confirm(`Delete "${row.test.title}" and its stats?`)) {
      this.storage.deleteTest(row.test.id);
      this.refresh();
    }
  }
}
