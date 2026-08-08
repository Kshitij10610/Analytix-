import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12">
      <EmptyState
        icon={<FileText className="h-12 w-12" />}
        title="Reports"
        description="Financial reports and analytics will be available here. This feature is coming soon."
      />
    </div>
  );
}
