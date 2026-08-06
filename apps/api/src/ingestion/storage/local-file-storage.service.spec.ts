import { Test, TestingModule } from '@nestjs/testing';
import { LocalFileStorageService } from './local-file-storage.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('LocalFileStorageService', () => {
  let service: LocalFileStorageService;
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-storage-'));
    process.env.INGESTION_STORAGE_ROOT = tempRoot;

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalFileStorageService],
    }).compile();

    service = module.get<LocalFileStorageService>(LocalFileStorageService);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    delete process.env.INGESTION_STORAGE_ROOT;
  });

  describe('write', () => {
    it('should write bytes and return metadata', async () => {
      const storageKey = 'imports/company-1/source-123';
      const bytes = Buffer.from('hello world');

      const result = await service.write(storageKey, bytes);
      expect(result.storageKey).toBe(storageKey);
      expect(result.sizeBytes).toBe(11);
      const crypto = require('crypto');
      expect(result.sha256).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
    });

    it('should compute correct SHA-256 for complete file', async () => {
      const storageKey = 'imports/company-1/source-456';
      const bytes = Buffer.from('test data for hashing');

      const expectedHash = '5e6d6e6f5e6d6e6f5e6d6e6f5e6d6e6f5e6d6e6f5e6d6e6f5e6d6e6f';
      // Use actual crypto to get real hash
      const crypto = require('crypto');
      const realHash = crypto.createHash('sha256').update(bytes).digest('hex');

      const result = await service.write(storageKey, bytes);
      expect(result.sha256).toBe(realHash);
    });

    it('should return sizeBytes matching actual bytes written', async () => {
      const storageKey = 'imports/company-1/source-size';
      const bytes = Buffer.from('x'.repeat(1024));

      const result = await service.write(storageKey, bytes);
      expect(result.sizeBytes).toBe(1024);
    });

    it('should store bytes identical to input', async () => {
      const storageKey = 'imports/company-1/source-exact';
      const bytes = Buffer.from('exact bytes test');

      await service.write(storageKey, bytes);
      const readBytes = await service.read(storageKey);
      expect(readBytes).toEqual(bytes);
    });

    it('should reject write when destination already exists', async () => {
      const storageKey = 'imports/company-1/source-overwrite';
      const bytes = Buffer.from('first write');

      await service.write(storageKey, bytes);
      await expect(service.write(storageKey, Buffer.from('second write'))).rejects.toThrow('already exists');
    });
  });

  describe('read', () => {
    it('should read exact persisted bytes', async () => {
      const storageKey = 'imports/company-1/source-read';
      const bytes = Buffer.from('read test data');

      await service.write(storageKey, bytes);
      const readBytes = await service.read(storageKey);
      expect(readBytes).toEqual(bytes);
    });

    it('should throw for nonexistent object', async () => {
      await expect(service.read('imports/company-1/missing')).rejects.toThrow('not found');
    });
  });

  describe('exists', () => {
    it('should return true for existing object', async () => {
      const storageKey = 'imports/company-1/source-exists';
      await service.write(storageKey, Buffer.from('exists test'));
      expect(await service.exists(storageKey)).toBe(true);
    });

    it('should return false for absent object', async () => {
      expect(await service.exists('imports/company-1/absent')).toBe(false);
    });
  });

  describe('verify', () => {
    it('should verify correct SHA-256', async () => {
      const storageKey = 'imports/company-1/source-verify';
      const bytes = Buffer.from('verification data');
      const crypto = require('crypto');
      const expectedHash = crypto.createHash('sha256').update(bytes).digest('hex');

      await service.write(storageKey, bytes);
      expect(await service.verify(storageKey, expectedHash)).toBe(true);
    });

    it('should fail verification for modified bytes', async () => {
      const storageKey = 'imports/company-1/source-modified';
      const bytes = Buffer.from('original data');
      const crypto = require('crypto');
      const originalHash = crypto.createHash('sha256').update(bytes).digest('hex');

      await service.write(storageKey, bytes);

      const filePath = path.join(tempRoot, storageKey);
      await fs.promises.writeFile(filePath, Buffer.from('modified data'));

      expect(await service.verify(storageKey, originalHash)).toBe(false);
    });

    it('should return false for nonexistent object', async () => {
      expect(await service.verify('imports/company-1/missing', 'abc123')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing object', async () => {
      const storageKey = 'imports/company-1/source-delete';
      await service.write(storageKey, Buffer.from('delete me'));
      await service.delete(storageKey);
      expect(await service.exists(storageKey)).toBe(false);
    });

    it('should succeed for absent object (idempotent)', async () => {
      await expect(service.delete('imports/company-1/absent-delete')).resolves.toBeUndefined();
    });
  });

  describe('path safety', () => {
    it('should reject parent directory traversal', async () => {
      await expect(service.write('imports/../escape/file', Buffer.from('x'))).rejects.toThrow('parent directory');
    });

    it('should reject absolute path', async () => {
      await expect(service.write('/etc/passwd', Buffer.from('x'))).rejects.toThrow('relative');
    });

    it('should reject null byte', async () => {
      await expect(service.write('imports/company/null\x00/file', Buffer.from('x'))).rejects.toThrow('null bytes');
    });

    it('should reject backslash traversal', async () => {
      await expect(service.write('imports\\company\\file', Buffer.from('x'))).rejects.toThrow('backslashes');
    });

    it('should prevent path escape via companyId', async () => {
      await expect(service.write('imports/../evil-company/source', Buffer.from('x'))).rejects.toThrow('parent directory');
    });

    it('originalFilename does not affect storage path', async () => {
      const storageKey = 'imports/company-1/source-original';
      const bytes = Buffer.from('original filename test');
      await service.write(storageKey, bytes);
      const filePath = path.join(tempRoot, storageKey);
      const stats = await fs.promises.stat(filePath);
      expect(stats.size).toBe(bytes.length);
    });
  });

  describe('immutability', () => {
    it('should not silently overwrite existing storageKey', async () => {
      const storageKey = 'imports/company-1/source-immutable';
      await service.write(storageKey, Buffer.from('first'));
      await expect(service.write(storageKey, Buffer.from('second'))).rejects.toThrow('already exists');
    });
  });
});
