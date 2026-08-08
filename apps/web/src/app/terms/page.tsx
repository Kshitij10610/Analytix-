import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <EmptyState
        icon={<FileText className="h-12 w-12" />}
        title="Terms of Service"
        description="The terms of service will be available here. This page is coming soon."
      />
    </div>
  );
}
