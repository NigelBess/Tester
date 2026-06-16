import { Injectable } from '@angular/core';

const DB_NAME = 'tester';
const DB_VERSION = 1;
const STORE = 'images';

/**
 * Stores user-uploaded image blobs in IndexedDB, keyed per test by the image's
 * basename. Tests reference images by name (e.g. "fig1.png"); the bytes live here
 * rather than in localStorage (too small for image data).
 */
@Injectable({ providedIn: 'root' })
export class ImageStoreService {
  private dbPromise?: Promise<IDBDatabase>;
  /** Cache of created object URLs so the same blob isn't re-materialised. */
  private urlCache = new Map<string, string>();

  private key(testId: string, name: string): string {
    return `${testId}::${name}`;
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  private tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return this.openDb().then((db) =>
      db.transaction(STORE, mode).objectStore(STORE)
    );
  }

  /** Store each file under its basename for the given test. Returns stored names. */
  async putImages(testId: string, files: File[]): Promise<string[]> {
    const stored: string[] = [];
    for (const file of files) {
      const name = this.basename(file.name);
      await this.put(this.key(testId, name), file);
      // A re-upload should invalidate any cached URL.
      const cached = this.urlCache.get(this.key(testId, name));
      if (cached) {
        URL.revokeObjectURL(cached);
        this.urlCache.delete(this.key(testId, name));
      }
      stored.push(name);
    }
    return stored;
  }

  /** Names of images stored for a test (basenames). */
  async getStoredNames(testId: string): Promise<string[]> {
    const store = await this.tx('readonly');
    const prefix = `${testId}::`;
    return new Promise<string[]>((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const names = (req.result as IDBValidKey[])
          .map((k) => String(k))
          .filter((k) => k.startsWith(prefix))
          .map((k) => k.slice(prefix.length));
        resolve(names);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Build object URLs for the requested names that actually exist in the store.
   * Returns a name -> objectUrl map so components can render synchronously.
   */
  async resolveUrls(
    testId: string,
    names: string[]
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const name of new Set(names)) {
      const key = this.key(testId, name);
      const cached = this.urlCache.get(key);
      if (cached) {
        map.set(name, cached);
        continue;
      }
      const blob = await this.get(key);
      if (blob) {
        const url = URL.createObjectURL(blob);
        this.urlCache.set(key, url);
        map.set(name, url);
      }
    }
    return map;
  }

  /** Remove all images belonging to a test. */
  async deleteForTest(testId: string): Promise<void> {
    const store = await this.tx('readwrite');
    const prefix = `${testId}::`;
    await new Promise<void>((resolve, reject) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        if (String(cursor.key).startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
    // Drop any cached URLs for this test.
    for (const key of Array.from(this.urlCache.keys())) {
      if (key.startsWith(prefix)) {
        URL.revokeObjectURL(this.urlCache.get(key)!);
        this.urlCache.delete(key);
      }
    }
  }

  // --- low-level helpers ---

  private async put(key: string, value: Blob): Promise<void> {
    const store = await this.tx('readwrite');
    await new Promise<void>((resolve, reject) => {
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async get(key: string): Promise<Blob | undefined> {
    const store = await this.tx('readonly');
    return new Promise<Blob | undefined>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  private basename(name: string): string {
    return name.split(/[\\/]/).pop() ?? name;
  }
}
