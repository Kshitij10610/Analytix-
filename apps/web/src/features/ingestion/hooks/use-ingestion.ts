import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ingestionApi } from "@/services/api/ingestion";

export function useUploadFile(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => ingestionApi.upload(companyId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", companyId, "imports"] });
    },
  });
}

export function useParseImport(companyId: string, importJobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ingestionApi.parse(companyId, importJobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", companyId, "imports", importJobId] });
    },
  });
}

export function useStageImport(companyId: string, importJobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ingestionApi.stage(companyId, importJobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", companyId, "imports", importJobId] });
    },
  });
}

export function useConfirmMapping(companyId: string, importJobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => ingestionApi.confirmMapping(companyId, importJobId, data as Parameters<typeof ingestionApi.confirmMapping>[2]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", companyId, "imports", importJobId] });
    },
  });
}

export function useValidateImport(companyId: string, importJobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ingestionApi.validate(companyId, importJobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", companyId, "imports", importJobId] });
    },
  });
}

export function useNormalizeImport(companyId: string, importJobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ingestionApi.normalize(companyId, importJobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", companyId, "imports", importJobId] });
    },
  });
}

export function useFinalizeMetadata(companyId: string, importJobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => ingestionApi.finalizeMetadata(companyId, importJobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", companyId, "imports", importJobId] });
    },
  });
}

export function useCommitImport(companyId: string, importJobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ingestionApi.commit(companyId, importJobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", companyId, "imports"] });
      queryClient.invalidateQueries({ queryKey: ["companies", companyId, "financial-statements"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements"] });
    },
  });
}
