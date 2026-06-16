import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StoredTest } from '../models/test.model';
import { TestStorageService } from '../services/test-storage.service';
import { ImageStoreService } from '../services/image-store.service';

interface TestRow {
  test: StoredTest;
  questionCount: number;
  attempts: number;
  mostMissed?: { prompt: string; wrong: number; total: number };
  mostCorrect?: { prompt: string; correct: number; total: number };
  /** All image names this test references. */
  imageNames: string[];
  /** How many of those are uploaded. */
  imagesUploaded: number;
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
    private images: ImageStoreService,
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
    // Fill in uploaded-image counts asynchronously (IndexedDB).
    this.rows.forEach((row) => this.refreshImageStatus(row));
  }

  private async refreshImageStatus(row: TestRow): Promise<void> {
    if (row.imageNames.length === 0) {
      return;
    }
    const stored = new Set(await this.images.getStoredNames(row.test.id));
    row.imagesUploaded = row.imageNames.filter((n) => stored.has(n)).length;
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
      imageNames: this.storage.referencedImageNames(test),
      imagesUploaded: 0,
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

  async onImagesSelected(event: Event, row: TestRow): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length === 0) {
      return;
    }
    const stored = await this.images.putImages(row.test.id, files);
    const referenced = new Set(row.imageNames);
    const matched = stored.filter((n) => referenced.has(n));
    const unmatched = stored.filter((n) => !referenced.has(n));
    await this.refreshImageStatus(row);

    let msg = `Uploaded ${matched.length} matching image${matched.length === 1 ? '' : 's'}.`;
    if (unmatched.length) {
      msg += ` ${unmatched.length} file(s) didn't match any reference: ${unmatched.join(', ')}.`;
    }
    this.snack.open(msg, 'OK', { duration: 5000 });
  }

  deleteTest(row: TestRow): void {
    if (confirm(`Delete "${row.test.title}" and its stats?`)) {
      this.storage.deleteTest(row.test.id);
      void this.images.deleteForTest(row.test.id);
      this.refresh();
    }
  }
}
