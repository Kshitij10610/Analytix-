export class UploadResponseDto {
  importJobId!: string;
  sourceFileId!: string;
  status!: 'UPLOADED';
  statementType!: string | null;
  originalFilename!: string;
  mimeType!: string;
  sizeBytes!: number;
  sha256!: string;
  uploadedAt!: Date;
}
