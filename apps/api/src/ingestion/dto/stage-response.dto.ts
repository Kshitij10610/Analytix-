export class StageResponseDto {
  importJobId: string;
  status: string;
  stagedRowCount: number;
  sheetCount: number;
  mapping: Record<string, unknown>;
}
