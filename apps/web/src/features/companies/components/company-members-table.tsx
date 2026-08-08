"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { companyMembersApi } from "@/services/api/companies";
import type { CompanyMember } from "@/features/companies/types/company";
import { DataTable } from "@/components/primitives/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CompanyMembersTableProps {
  companyId: string;
}

const roleVariantMap: Record<string, "default" | "success" | "warning" | "info" | "destructive"> = {
  OWNER: "success",
  ANALYST: "info",
  VIEWER: "default",
};

export function CompanyMembersTable({ companyId }: CompanyMembersTableProps) {
  const { data: members, isLoading, error } = useQuery({
    queryKey: ["companies", companyId, "members"],
    queryFn: async () => {
      const response = await companyMembersApi.list(companyId);
      return response.data ?? [];
    },
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-spacing-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-error/50 bg-error/10 p-4 text-sm text-error">
        Failed to load members. Please try again later.
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center">
        <p className="text-sm text-text-secondary">No members found.</p>
      </div>
    );
  }

  const columns = [
    {
      id: "user",
      header: "Member",
      align: "left" as const,
      render: (row: CompanyMember) => (
        <div className="flex items-center gap-spacing-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {(row.user.name || row.user.email).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-text-primary">{row.user.name || "Unnamed User"}</p>
            <p className="text-xs text-text-muted">{row.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      align: "center" as const,
      render: (row: CompanyMember) => (
        <Badge variant={roleVariantMap[row.role] || "default"}>{row.role}</Badge>
      ),
    },
    {
      id: "joined",
      header: "Joined",
      align: "left" as const,
      render: (row: CompanyMember) => (
        <span className="text-sm text-text-secondary">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return <DataTable columns={columns} rows={members} />;
}
