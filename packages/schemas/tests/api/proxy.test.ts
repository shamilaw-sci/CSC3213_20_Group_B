import { describe, expect, test } from 'bun:test';

import {
  ProxyResolutionResponseSchema,
  ProxyUpdateRequestSchema,
  ProxyUrlSchema,
  ProxyUsernameSchema,
} from '#index';

describe('proxy transport contracts', () => {
  test('accepts credential-free public HTTPS proxy URLs', () => {
    expect(ProxyUrlSchema.parse(' https://proxy.example.com:8080 ')).toBe(
      'https://proxy.example.com:8080'
    );
  });

  test('rejects unsupported protocols, credentials, and non-public hosts', () => {
    expect(ProxyUrlSchema.safeParse('http://proxy.example.com').success).toBe(
      false
    );
    expect(ProxyUrlSchema.safeParse('socks5://proxy.example.com').success).toBe(
      false
    );
    expect(
      ProxyUrlSchema.safeParse('https://user:pass@proxy.example.com').success
    ).toBe(false);
    for (const url of [
      'http://127.0.0.1:8787',
      'http://192.168.1.10:3128',
      'http://[::1]',
      'http://metadata.google.internal',
      'http://localhost',
    ]) {
      expect(ProxyUrlSchema.safeParse(url).success, url).toBe(false);
    }
  });

  test('validates the internal proxy resolution contract', () => {
    expect(ProxyUsernameSchema.parse(' Student-01 ')).toBe('student-01');
    expect(ProxyUsernameSchema.safeParse('student/name').success).toBe(false);
    expect(
      ProxyResolutionResponseSchema.parse({
        url: 'https://portfolio.example/student/',
      })
    ).toEqual({ url: 'https://portfolio.example/student/' });
  });

  test('keeps the API update body strict', () => {
    expect(
      ProxyUpdateRequestSchema.safeParse({
        active: true,
        url: 'https://proxy.example.com',
        unexpected: true,
      }).success
    ).toBe(false);
  });
});
