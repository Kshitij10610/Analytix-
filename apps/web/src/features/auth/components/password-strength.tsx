"use client";

import * as React from "react";

interface PasswordStrengthProps {
  password: string;
}

interface StrengthRule {
  label: string;
  test: (password: string) => boolean;
}

const rules: StrengthRule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function PasswordStrength({ password }: PasswordStrengthProps) {
  const passedCount = rules.filter((rule) => rule.test(password)).length;
  const strength = passedCount === 0 ? 0 : passedCount <= 2 ? 1 : passedCount <= 3 ? 2 : passedCount <= 4 ? 3 : 4;

  const colors = [
    "bg-neutral-200 dark:bg-neutral-700",
    "bg-error",
    "bg-warning",
    "bg-info",
    "bg-success",
  ];

  const labels = ["", "Weak", "Fair", "Good", "Strong"];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
              level <= strength ? colors[strength] : "bg-neutral-200 dark:bg-neutral-700"
            }`}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className="text-xs text-text-secondary">
          Password strength:{" "}
          <span
            className={`font-medium ${
              strength === 1
                ? "text-error"
                : strength === 2
                  ? "text-warning"
                  : strength === 3
                    ? "text-info"
                    : strength === 4
                      ? "text-success"
                      : "text-text-muted"
            }`}
          >
            {labels[strength]}
          </span>
        </p>
      )}
      <ul className="space-y-1">
        {rules.map((rule) => {
          const passed = rule.test(password);
          return (
            <li
              key={rule.label}
              className={`flex items-center gap-2 text-xs ${
                passed ? "text-success" : "text-text-muted"
              }`}
            >
              <span className="h-3 w-3 flex items-center justify-center">
                {passed ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { PasswordStrength };
