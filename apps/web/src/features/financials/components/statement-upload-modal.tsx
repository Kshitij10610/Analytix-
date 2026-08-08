"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ingestionApi } from "@/services/api/ingestion";
import { useToast } from "@/components/ui/toast-provider";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/json": [".json"],
};

interface StatementUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onSuccess?: (importJobId: string) => void;
}

export function StatementUploadModal({ open, onOpenChange, companyId, onSuccess }: StatementUploadModalProps) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});
  const { addToast } = useToast();

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  const removeFile = (fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    setUploadProgress((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);

    for (const file of files) {
      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
        const response = await ingestionApi.upload(companyId, file);
        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
        addToast({
          title: "Upload successful",
          description: `${file.name} uploaded successfully.`,
          variant: "success",
          duration: 3000,
        });
        onSuccess?.(response.data.importJobId);
      } catch {
        setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
        addToast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}. Please try again.`,
          variant: "error",
          duration: 5000,
        });
      }
    }

    setIsUploading(false);
    setFiles([]);
    setUploadProgress({});
    onOpenChange(false);
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setUploadProgress({});
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Financial Statement</DialogTitle>
          <DialogDescription>
            Upload a CSV, Excel (.xlsx), or JSON file. Maximum file size is 20MB.
          </DialogDescription>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 text-text-muted mb-3" />
          {isDragActive ? (
            <p className="text-sm font-medium text-primary">Drop the file here...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-text-heading">Drag and drop files here, or click to browse</p>
              <p className="mt-1 text-xs text-text-muted">CSV, XLSX, or JSON up to 20MB</p>
            </>
          )}
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file) => {
              const progress = uploadProgress[file.name];
              const isComplete = progress === 100;
              const isFailed = progress === -1;

              return (
                <div
                  key={file.name}
                  className="flex items-center justify-between rounded-md border border-border bg-surface p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-text-muted shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                      <p className="text-xs text-text-muted">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                        {isComplete && " — Uploaded"}
                        {isFailed && " — Failed"}
                      </p>
                    </div>
                  </div>
                  {!isUploading && !isComplete && !isFailed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.name)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || isUploading}>
            {isUploading ? "Uploading..." : `Upload ${files.length} file${files.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

