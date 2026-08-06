export type CompanyMemberResponse = {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  role: string;
  createdAt: string;
};
