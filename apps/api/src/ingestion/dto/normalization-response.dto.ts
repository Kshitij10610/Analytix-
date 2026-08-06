export class NormalizationResponseDto {
  importJobId: string;
  status: string;
  valid: boolean;
  normalizedRowCount: number;
  statementType: string | null;
  readyBlockedReason: string | null;
}
