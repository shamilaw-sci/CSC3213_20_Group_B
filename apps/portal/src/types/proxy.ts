export interface AdminProxyEntry {
  username: string;
  email: string;
  active: boolean;
  url: string;
  availableAttempts: number;
  updatedBy?: string;
  updatedAt?: string;
  revision: number;
}

export interface AdminProxyPageResponse {
  version: 1;
  items: AdminProxyEntry[];
  page: {
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
}
