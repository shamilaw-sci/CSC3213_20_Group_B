import type { Page, PageInfo } from '@scs/schemas';

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

export type AdminProxyPageResponse = Page<AdminProxyEntry> & {
  page: PageInfo & { total: number };
};
