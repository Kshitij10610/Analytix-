import { apiClient } from "@/lib/api/client";
import type {
  UploadResponseDto,
  ParseResponseDto,
  StageResponseDto,
  MappingConfirmRequestDto,
  MappingConfirmResponseDto,
  ValidationResponseDto,
  NormalizationResponseDto,
  StatementMetadataResponse,
  CommitResponse,
} from "@/features/ingestion/types/ingestion";

export const ingestionApi = {
  upload: (companyId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<UploadResponseDto>(`/companies/${companyId}/imports/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  parse: (companyId: string, importJobId: string) =>
    apiClient.post<ParseResponseDto>(`/companies/${companyId}/imports/${importJobId}/parse`),

  stage: (companyId: string, importJobId: string) =>
    apiClient.post<StageResponseDto>(`/companies/${companyId}/imports/${importJobId}/stage`),

  confirmMapping: (companyId: string, importJobId: string, data: MappingConfirmRequestDto) =>
    apiClient.put<MappingConfirmResponseDto>(`/companies/${companyId}/imports/${importJobId}/mapping`, data),

  validate: (companyId: string, importJobId: string) =>
    apiClient.post<ValidationResponseDto>(`/companies/${companyId}/imports/${importJobId}/validate`),

  normalize: (companyId: string, importJobId: string) =>
    apiClient.post<NormalizationResponseDto>(`/companies/${companyId}/imports/${importJobId}/normalize`),

  finalizeMetadata: (companyId: string, importJobId: string, data: unknown) =>
    apiClient.put<StatementMetadataResponse>(`/companies/${companyId}/imports/${importJobId}/statement-metadata`, data),

  commit: (companyId: string, importJobId: string) =>
    apiClient.post<CommitResponse>(`/companies/${companyId}/imports/${importJobId}/commit`),
};
