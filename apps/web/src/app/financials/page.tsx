import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp } from "lucide-react";

export default function FinancialsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12">
      <EmptyState
        icon={<TrendingUp className="h-12 w-12" />}
        title="Financials"
        description="Financial statements and line items will be available here. This feature is coming soon."
      />
    </div>
  );
}
