"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface WizardProps {
  currentStep: number;
  children: React.ReactNode;
}

interface WizardStepProps {
  step: number;
  children: React.ReactNode;
}

interface WizardContextValue {
  currentStep: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

const WizardContext = React.createContext<WizardContextValue | null>(null);

function useWizard() {
  const context = React.useContext(WizardContext);
  if (!context) {
    throw new Error("Wizard components must be used within a Wizard provider");
  }
  return context;
}

export function Wizard({ currentStep, children }: WizardProps) {
  const [internalStep, setInternalStep] = React.useState(currentStep);
  const activeStep = currentStep !== undefined ? currentStep : internalStep;

  const goToStep = React.useCallback((step: number) => {
    setInternalStep(step);
  }, []);

  const nextStep = React.useCallback(() => {
    setInternalStep((prev) => Math.min(prev + 1, React.Children.count(children) - 1));
  }, [children]);

  const prevStep = React.useCallback(() => {
    setInternalStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const canGoNext = activeStep < React.Children.count(children) - 1;
  const canGoPrev = activeStep > 0;

  return (
    <WizardContext.Provider value={{ currentStep: activeStep, goToStep, nextStep, prevStep, canGoNext, canGoPrev }}>
      <div className="w-full">{children}</div>
    </WizardContext.Provider>
  );
}

export function WizardStep({ step, children }: WizardStepProps) {
  const { currentStep } = useWizard();
  if (step !== currentStep) return null;
  return <>{children}</>;
}

export function WizardProgress({ steps }: { steps: string[] }) {
  const { currentStep, goToStep } = useWizard();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((label, index) => (
          <div key={index} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => goToStep(index)}
                disabled={index > currentStep}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  index < currentStep
                    ? "bg-primary text-text-inverse hover:bg-primary/90"
                    : index === currentStep
                    ? "bg-primary text-text-inverse"
                    : "bg-surface-hover text-text-muted cursor-not-allowed",
                  index <= currentStep && "cursor-pointer"
                )}
                aria-current={index === currentStep ? "step" : undefined}
              >
                {index < currentStep ? "✓" : index + 1}
              </button>
              <span
                className={cn(
                  "mt-1 text-xs",
                  index <= currentStep ? "text-text-primary" : "text-text-muted"
                )}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1",
                  index < currentStep ? "bg-primary" : "bg-surface-hover"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WizardNavigation({ onNext, onPrev, nextLabel = "Next", prevLabel = "Back", isLastStep = false }: {
  onNext?: () => void;
  onPrev?: () => void;
  nextLabel?: string;
  prevLabel?: string;
  isLastStep?: boolean;
}) {
  const { canGoNext, canGoPrev } = useWizard();

  return (
    <div className="mt-6 flex items-center justify-between">
      <div>
        {canGoPrev && onPrev && (
          <button type="button" onClick={onPrev} className="text-sm text-text-secondary hover:text-text-primary">
            {prevLabel}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {isLastStep ? (
          <button type="button" onClick={onNext} className="...">
            Finish
          </button>
        ) : (
          canGoNext && onNext && (
            <button type="button" onClick={onNext} className="...">
              {nextLabel}
            </button>
          )
        )}
      </div>
    </div>
  );
}
