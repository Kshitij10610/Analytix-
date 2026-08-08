"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { UploadStep } from "@/features/ingestion/components/upload-step";
import { ParseStep } from "@/features/ingestion/components/parse-step";
import { StageStep } from "@/features/ingestion/components/stage-step";
import { MappingStep } from "@/features/ingestion/components/mapping-step";
import { ValidationStep } from "@/features/ingestion/components/validation-step";
import { NormalizeStep } from "@/features/ingestion/components/normalize-step";
import { MetadataStep } from "@/features/ingestion/components/metadata-step";
import { CommitStep } from "@/features/ingestion/components/commit-step";
import { FinishedStep } from "@/features/ingestion/components/finished-step";
import type { ImportJobState, StatementMetadataResponse } from "@/features/ingestion/types/ingestion";

interface IngestionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

const STEPS = [
  "Upload",
  "Parse",
  "Stage",
  "Mapping",
  "Validate",
  "Normalize",
  "Metadata",
  "Commit",
  "Finished",
];

export function IngestionWizard({ open, onOpenChange, companyId }: IngestionWizardProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [state, setState] = React.useState<ImportJobState>({
    importJobId: null,
    status: null,
    upload: null,
    parse: null,
    stage: null,
    mapping: null,
    validation: null,
    normalization: null,
    metadata: null,
    commit: null,
  });

  const reset = React.useCallback(() => {
    setCurrentStep(0);
    setState({
      importJobId: null,
      status: null,
      upload: null,
      parse: null,
      stage: null,
      mapping: null,
      validation: null,
      normalization: null,
      metadata: null,
      commit: null,
    });
  }, []);

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const goToStep = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Import Financial Statement</DialogTitle>
              <DialogDescription>Follow the steps to import a financial statement.</DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-6">
            {STEPS.map((label, index) => (
              <div key={index} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  disabled={index > currentStep}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    index < currentStep
                      ? "bg-primary text-text-inverse hover:bg-primary/90"
                      : index === currentStep
                      ? "bg-primary text-text-inverse"
                      : "bg-surface-hover text-text-muted cursor-not-allowed"
                  } ${index <= currentStep ? "cursor-pointer" : ""}`}
                >
                  {index < currentStep ? "✓" : index + 1}
                </button>
                <span className={`mx-1 text-xs ${index <= currentStep ? "text-text-primary" : "text-text-muted"}`}>
                  {label}
                </span>
                {index < STEPS.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 ${index < currentStep ? "bg-primary" : "bg-surface-hover"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="min-h-[300px]">
            {currentStep === 0 && (
              <UploadStep
                companyId={companyId}
                onComplete={(response) => {
                  setState((prev) => ({ ...prev, importJobId: response.importJobId, upload: response }));
                  nextStep();
                }}
              />
            )}
            {currentStep === 1 && state.importJobId && (
              <ParseStep
                companyId={companyId}
                importJobId={state.importJobId}
                onComplete={(response) => {
                  setState((prev) => ({ ...prev, parse: response }));
                  nextStep();
                }}
              />
            )}
            {currentStep === 2 && state.importJobId && (
              <StageStep
                companyId={companyId}
                importJobId={state.importJobId}
                onComplete={(response) => {
                  setState((prev) => ({ ...prev, stage: response }));
                  nextStep();
                }}
              />
            )}
            {currentStep === 3 && state.importJobId && (
              <MappingStep
                companyId={companyId}
                importJobId={state.importJobId}
                mapping={state.stage?.mapping ?? null}
                onComplete={(response) => {
                  setState((prev) => ({ ...prev, mapping: response }));
                  nextStep();
                }}
              />
            )}
            {currentStep === 4 && state.importJobId && (
              <ValidationStep
                companyId={companyId}
                importJobId={state.importJobId}
                onComplete={(response) => {
                  setState((prev) => ({ ...prev, validation: response }));
                  nextStep();
                }}
              />
            )}
            {currentStep === 5 && state.importJobId && (
              <NormalizeStep
                companyId={companyId}
                importJobId={state.importJobId}
                onComplete={(response) => {
                  setState((prev) => ({ ...prev, normalization: response }));
                  nextStep();
                }}
              />
            )}
            {currentStep === 6 && state.importJobId && (
              <MetadataStep
                companyId={companyId}
                importJobId={state.importJobId}
                onComplete={(metadata: StatementMetadataResponse) => {
                  setState((prev) => ({ ...prev, metadata }));
                  nextStep();
                }}
              />
            )}
            {currentStep === 7 && state.importJobId && (
              <CommitStep
                companyId={companyId}
                importJobId={state.importJobId}
                onComplete={(response) => {
                  setState((prev) => ({ ...prev, commit: response }));
                  nextStep();
                }}
              />
            )}
            {currentStep === 8 && (
              <FinishedStep statementId={state.commit?.statementId} companyId={companyId} />
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              {currentStep > 0 && currentStep < STEPS.length && (
                <Button variant="outline" onClick={prevStep}>
                  Back
                </Button>
              )}
            </div>
            <div />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
