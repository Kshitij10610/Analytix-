export interface Company {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  role: CompanyMemberRole;
  createdAt: string;
}

export type CompanyMemberRole = "OWNER" | "ANALYST" | "VIEWER";

export interface CreateCompanyPayload {
  name: string;
  industry?: string;
  website?: string;
}

export interface UpdateCompanyPayload {
  name?: string;
  industry?: string;
  website?: string;
}
