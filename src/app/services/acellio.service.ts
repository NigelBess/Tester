import { Injectable } from '@angular/core';
import * as JSZip from 'jszip';
import { TestFile } from '../models/test.model';

/** Custom extension for a bundled test (ZIP archive: test.json + images/). */
export const ACELLIO_EXT = '.acellio';

const TEST_JSON = 'test.json';
const IMAGES_DIR = 'images/';

/**
 * Packs/unpacks a test plus its images into a single `.acellio` file — a ZIP
 * archive containing `test.json` and an `images/` folder of the real image
 * files (same idea as .docx/.epub). Lets a test be shared as one artifact.
 */
@Injectable({ providedIn: 'root' })
export class AcellioService {
  /** Bundle a test + its images into a `.acellio` blob ready for download. */
  async pack(test: TestFile, images: Map<string, Blob>): Promise<Blob> {
    const zip = new JSZip();
    // Strip any StoredTest extras (id/createdAt) — only the file shape ships.
    const clean: TestFile = {
      version: test.version,
      title: test.title,
      ...(test.description !== undefined ? { description: test.description } : {}),
      ...(test.shuffle !== undefined ? { shuffle: test.shuffle } : {}),
      questions: test.questions,
    };
    zip.file(TEST_JSON, JSON.stringify(clean, null, 2));
    const imagesFolder = zip.folder('images')!;
    for (const [name, blob] of images) {
      imagesFolder.file(name, blob);
    }
    return zip.generateAsync({ type: 'blob' });
  }

  /** Read a `.acellio` blob back into its raw test JSON string and image blobs. */
  async unpack(file: Blob): Promise<{ json: string; images: Map<string, Blob> }> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      throw new Error('Not a valid .acellio file (could not read the archive).');
    }
    const entry = zip.file(TEST_JSON);
    if (!entry) {
      throw new Error('.acellio file is missing test.json.');
    }
    const json = await entry.async('string');

    const images = new Map<string, Blob>();
    const tasks: Promise<void>[] = [];
    zip.forEach((path, zipEntry) => {
      if (zipEntry.dir || !path.startsWith(IMAGES_DIR)) {
        return;
      }
      const name = path.slice(IMAGES_DIR.length);
      if (!name) {
        return;
      }
      tasks.push(
        zipEntry.async('blob').then((blob) => {
          images.set(name, blob);
        })
      );
    });
    await Promise.all(tasks);
    return { json, images };
  }
}
