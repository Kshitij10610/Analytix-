"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ingestionApi } from "@/services/api/ingestion";
import { Search } from "lucide-react";
import type { MappingConfirmRequestDto, MappingConfirmResponseDto, RowMappingDto } from "@/features/ingestion/types/ingestion";

interface MappingStepProps {
  companyId: string;
  importJobId: string;
  mapping: Record<string, unknown> | null;
  onComplete: (response: MappingConfirmResponseDto) => void;
}

export function MappingStep({ companyId, importJobId, mapping, onComplete }: MappingStepProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const rows = React.useMemo(() => {
    if (!mapping || typeof mapping !== "object") return [];
    const mappedRows: RowMappingDto[] = [];
    Object.entries(mapping).forEach(([key, value]) => {
      if (key.includes("rowMappings") && Array.isArray(value)) {
        mappedRows.push(...(value as RowMappingDto[]));
      }
    });
    return mappedRows;
  }, [mapping]);

  const filteredRows = rows.filter((row) =>
    row.sourceLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.metricCode?.toLowerCase().includes(searchQuery.toLowerCase()
  ));

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const payload: MappingConfirmRequestDto = {
        statementType: "INCOME_STATEMENT",
        sheets: [
          {
            sheetIndex: 0,
            rowMappings: rows.map((row) => ({
              rowNumber: row.rowNumber,
              metricCode: row.metricCode || "",
            })),
          },
        ],
      };

      const response = await ingestionApi.confirmMapping(companyId, importJobId, payload);
      onComplete(response.data);
    } catch {
      // Error handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  const unmappedCount = rows.filter((r) => !r.metricCode).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-secondary">
            {rows.length} rows mapped • {unmappedCount} unmapped
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search rows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border border-border">
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-2 text-left text-body-sm font-medium text-text-secondary">Row</th>
                <th className="px-4 py-2 text-left text-body-sm font-medium text-text-secondary">Original Label</th>
                <th className="px-4 py-2 text-left text-body-sm font-medium text-text-secondary">Suggested Metric</th>
                <th className="px-4 py-2 text-left text-body-sm font-medium text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.rowNumber} className="border-t border-border">
                  <td className="px-4 py-2">{row.rowNumber}</td>
                  <td className="px-4 py-2">{row.sourceLabel}</td>
                  <td className="px-4 py-2">
                    {row.metricCode || "—"}
                    {row.candidates && row.candidates.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.candidates.slice(0, 3).map((c) => (
                          <Badge key={c.code} variant="outline" className="text-xs">
                            {c.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {row.metricCode ? (
                      <Badge variant="success">Mapped</Badge>
                    ) : (
                      <Badge variant="warning">Unmapped</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleConfirm} disabled={isLoading || unmappedCount > 0}>
          Confirm Mapping
        </Button>
      </div>
    </div>
  );
}
