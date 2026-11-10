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
