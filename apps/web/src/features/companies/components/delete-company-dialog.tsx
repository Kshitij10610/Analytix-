"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface DeleteCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  companyName: string;
  isLoading?: boolean;
}

export function DeleteCompanyDialog({ open, onOpenChange, onConfirm, companyName, isLoading }: DeleteCompanyDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-spacing-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Delete Company</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the company and all associated data.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="rounded-md border border-error/50 bg-error/10 p-4">
          <p className="text-sm text-error">
            Are you sure you want to delete <strong>{companyName}</strong>? This action is irreversible.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting || isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting || isLoading}
          >
            {isDeleting || isLoading ? "Deleting..." : "Delete Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
