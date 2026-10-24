import { MailerSendRequestSchema, type MailerSendRequest } from '@scs/schemas';
export const sendRequestSchema = MailerSendRequestSchema;
export type SendRequest = MailerSendRequest;

export type SendResponse = { ok: true } | { ok: false; error: string };
