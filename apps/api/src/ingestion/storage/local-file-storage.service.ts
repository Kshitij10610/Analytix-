import * as crypto from 'crypto';
import * as fs from 'fs';
import { Injectable } from '@nestjs/common';
import { StorageWriteResult } from './storage.interface';

@Injectable()
export class LocalFileStorageService {
  private readonly root: string;

  constructor() {
    const configuredRoot = process.env.INGESTION_STORAGE_ROOT;
    if (!configuredRoot || configuredRoot.trim().length === 0) {
      throw new Error('INGESTION_STORAGE_ROOT is not defined');
    }
    this.root = configuredRoot.trim();
  }

  async write(storageKey: string, bytes: Buffer): Promise<StorageWriteResult> {
    this.validateStorageKey(storageKey);

    const resolved = this.resolvePath(storageKey);
    this.ensureWithinRoot(resolved);

    if (await this.exists(storageKey)) {
      throw new Error(`Storage object already exists: ${storageKey}`);
    }

    await fs.promises.mkdir(resolved.parentDir, { recursive: true });

    const tempPath = `${resolved.path}.${process.pid}.${Date.now()}.tmp`;

    let hash: string;
    try {
      hash = crypto.createHash('sha256').update(bytes).digest('hex');
      await fs.promises.writeFile(tempPath, bytes);
      await fs.promises.rename(tempPath, resolved.path);
      return { storageKey, sizeBytes: bytes.length, sha256: hash };
    } catch (error) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // ignore cleanup failure
      }
      throw error;
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    this.validateStorageKey(storageKey);
    const resolved = this.resolvePath(storageKey);
    this.ensureWithinRoot(resolved);

    if (!(await this.exists(storageKey))) {
      throw new Error(`Storage object not found: ${storageKey}`);
    }

    return fs.promises.readFile(resolved.path);
  }

  async exists(storageKey: string): Promise<boolean> {
    this.validateStorageKey(storageKey);
    const resolved = this.resolvePath(storageKey);
    this.ensureWithinRoot(resolved);

    try {
      await fs.promises.access(resolved.path);
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageKey: string): Promise<void> {
    this.validateStorageKey(storageKey);
    const resolved = this.resolvePath(storageKey);
    this.ensureWithinRoot(resolved);

    try {
      await fs.promises.unlink(resolved.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  async verify(storageKey: string, expectedSha256: string): Promise<boolean> {
    this.validateStorageKey(storageKey);
    const resolved = this.resolvePath(storageKey);
    this.ensureWithinRoot(resolved);

    if (!(await this.exists(storageKey))) {
      return false;
    }

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(resolved.path);
    stream.on('error', () => {
      throw new Error(`Failed to read file for verification: ${resolved.path}`);
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve());
      stream.on('error', () => reject(new Error(`Failed to read file for verification: ${resolved.path}`)));
    });

    const actualSha256 = hash.digest('hex');
    return actualSha256 === expectedSha256;
  }

  private validateStorageKey(storageKey: string): void {
    if (!storageKey || typeof storageKey !== 'string') {
      throw new Error('storageKey must be a non-empty string');
    }

    if (storageKey.includes('\\')) {
      throw new Error('storageKey must not contain backslashes');
    }

    if (storageKey.includes('..')) {
      throw new Error('storageKey must not contain parent directory references');
    }

    if (storageKey.startsWith('/')) {
      throw new Error('storageKey must be a relative path');
    }

    if (storageKey.includes('\0')) {
      throw new Error('storageKey must not contain null bytes');
    }

    const segments = storageKey.split('/');
    for (const segment of segments) {
      if (segment === '..') {
        throw new Error('storageKey must not contain parent directory references');
      }
    }
  }

  private resolvePath(storageKey: string): { path: string; parentDir: string } {
    const path = PathsSafeWrapper.join(this.root, ...storageKey.split('/'));
    const parentDir = PathsSafeWrapper.dirname(path);
    return { path, parentDir };
  }

  private ensureWithinRoot(resolved: { path: string; parentDir: string }): void {
    const realRoot = PathsSafeWrapper.realpath(this.root);
    const realPath = PathsSafeWrapper.realpath(resolved.path);
    const normalizedRoot = PathsSafeWrapper.normalizeSeparators(realRoot);
    const normalizedPath = PathsSafeWrapper.normalizeSeparators(realPath);
    if (!normalizedPath.startsWith(normalizedRoot + '/') && normalizedPath !== normalizedRoot) {
      throw new Error(`Resolved path escapes storage root: ${resolved.path}`);
    }
  }
}

class PathsSafeWrapper {
  static join(...segments: string[]): string {
    return segments.join('/').replace(/\\/g, '/');
  }

  static dirname(path: string): string {
    const idx = path.lastIndexOf('/');
    if (idx === -1) return '';
    return path.slice(0, idx);
  }

  static realpath(path: string): string {
    try {
      return fs.realpathSync(path);
    } catch {
      return path;
    }
  }

  static normalizeSeparators(path: string): string {
    return path.replace(/\\/g, '/');
  }
}
