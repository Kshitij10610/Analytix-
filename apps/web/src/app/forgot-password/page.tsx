import { EmptyState } from "@/components/ui/empty-state";
import { Lock } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <EmptyState
        icon={<Lock className="h-12 w-12" />}
        title="Forgot Password"
        description="Password reset functionality will be available here. This feature is coming soon."
      />
    </div>
  );
}
