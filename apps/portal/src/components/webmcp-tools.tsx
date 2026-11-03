'use client';

import { WebMcpToolError } from '@scs/webmcp';
import { useWebMcpTool } from '@scs/webmcp/react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { authClient } from '@/lib/auth-client';
import { portalToolsEnabled } from '@/lib/webmcp-session';

const emptySchema = z.object({}).strict();
const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export function WebMcpTools() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const enabled = portalToolsEnabled(isPending, Boolean(session?.user));

  useWebMcpTool({
    name: 'portal.current_account',
    description:
      'Reads the signed-in account identity. Use when the member asks which account is active.',
    schema: emptySchema,
    inputSchema: emptyInputSchema,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    enabled,
    execute: async () => {
      const result = await authClient.getSession();
      if (result.error || !result.data?.user) {
        throw new WebMcpToolError('Your session has expired. Sign in again.');
      }
      return { name: result.data.user.name, email: result.data.user.email };
    },
  });

  useWebMcpTool({
    name: 'portal.open_account',
    description:
      'Opens the signed-in member account page. Use when the member wants to review their profile and account options.',
    schema: emptySchema,
    inputSchema: emptyInputSchema,
    enabled,
    execute: async () => {
      const result = await authClient.getSession();
      if (result.error || !result.data?.user) {
        throw new WebMcpToolError('Your session has expired. Sign in again.');
      }
      router.push('/user/me');
      return { opened: '/user/me' };
    },
  });

  return null;
}
