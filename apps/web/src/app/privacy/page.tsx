import { EmptyState } from "@/components/ui/empty-state";
import { Shield } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <EmptyState
        icon={<Shield className="h-12 w-12" />}
        title="Privacy Policy"
        description="The privacy policy will be available here. This page is coming soon."
      />
    </div>
  );
}
