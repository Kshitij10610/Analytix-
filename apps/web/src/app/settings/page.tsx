import { EmptyState } from "@/components/ui/empty-state";
import { Settings2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12">
      <EmptyState
        icon={<Settings2 className="h-12 w-12" />}
        title="Settings"
        description="Application settings and preferences will be available here. This feature is coming soon."
      />
    </div>
  );
}
