export interface AdminProxyEntry {
  username: string;
  email: string;
  active: boolean;
  url: string;
  availableAttempts: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AdminProxyListResponse {
  proxies: AdminProxyEntry[];
  page: number;
  totalPages: number;
  total: number;
}
