import { describe, expect, test } from 'bun:test';

import { ProxyUpdateRequestSchema, ProxyUrlSchema } from '#index';

describe('proxy transport contracts', () => {
  test('accepts credential-free HTTP and HTTPS proxy URLs', () => {
    expect(ProxyUrlSchema.parse(' https://proxy.example.com:8080 ')).toBe(
      'https://proxy.example.com:8080'
    );
    expect(ProxyUrlSchema.safeParse('http://192.168.1.10:3128').success).toBe(
      true
    );
  });

  test('rejects unsupported protocols and embedded credentials', () => {
    expect(ProxyUrlSchema.safeParse('socks5://proxy.example.com').success).toBe(
      false
    );
    expect(
      ProxyUrlSchema.safeParse('https://user:pass@proxy.example.com').success
    ).toBe(false);
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
