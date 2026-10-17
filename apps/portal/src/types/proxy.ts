export interface ProxyData {
  active: boolean;
  isAllowed: boolean;
  url: string;
  availableAttempts?: number;
}

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

export interface AllProxyConfigResponse {
  schemaVersion: 1;
  generatedAt: string | null;
  users: Record<
    string,
    {
      username: string;
      proxy: {
        active: boolean;
        url: string;
        availableAttempts?: number;
        updatedBy?: string;
        updatedAt?: string;
      };
    }
  >;
}
