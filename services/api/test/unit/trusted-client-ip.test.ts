import { expect, test } from 'bun:test';

import { trustedClientHeaders } from '@/runtime/bun/client-ip';

test('direct clients cannot set their own address', () => {
  const headers = new Headers({
    'cf-connecting-ip': '198.51.100.1',
    'x-scs-client-ip': '198.51.100.2',
  });
  const trusted = trustedClientHeaders(headers, '192.0.2.3', undefined);
  expect(trusted?.get('cf-connecting-ip')).toBe('192.0.2.3');
  expect(trusted?.has('x-scs-client-ip')).toBe(false);
});

test('only the configured reverse proxy can forward a valid client address', () => {
  const headers = new Headers({ 'x-scs-client-ip': '198.51.100.2' });
  expect(trustedClientHeaders(headers, '192.0.2.4', '192.0.2.3')).toBeNull();
  expect(
    trustedClientHeaders(headers, '192.0.2.3', '192.0.2.3')?.get(
      'cf-connecting-ip'
    )
  ).toBe('198.51.100.2');
  headers.set('x-scs-client-ip', 'invalid');
  expect(trustedClientHeaders(headers, '192.0.2.3', '192.0.2.3')).toBeNull();
  headers.delete('x-scs-client-ip');
  expect(trustedClientHeaders(headers, '192.0.2.3', '192.0.2.3')).toBeNull();
});
