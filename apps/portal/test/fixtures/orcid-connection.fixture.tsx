import { afterAll, afterEach, expect, spyOn, test } from 'bun:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://portal.scs-pdn.space/user/me/public-profile',
});
const browserGlobals = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
};
const originals = Object.fromEntries(
  Object.keys(browserGlobals).map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ])
);
Object.assign(globalThis, browserGlobals);

const { cleanup, fireEvent, render, screen, waitFor } =
  await import('@testing-library/react');
const { OrcidConnection } =
  await import('@/components/profiles/orcid-connection');

afterEach(() => {
  cleanup();
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});
afterAll(() => {
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  dom.window.close();
});

test('public profile and account settings reuse the disconnected ORCID controls', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ orcid: null }));
  const editor = render(<OrcidConnection inPublicProfile />);
  expect(
    screen.getByText('ORCID', { selector: '[data-slot="card-title"]' })
  ).toBeTruthy();
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Connect ORCID',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  expect(screen.getByText(/verify your researcher identifier/)).toBeTruthy();
  editor.unmount();
  render(<OrcidConnection />);
  expect(screen.getByText('Connect your ORCID')).toBeTruthy();
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Connect ORCID',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
});

test('disconnect uses the ORCID endpoint without submitting a profile PR', async () => {
  const request = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ orcid: '0000-0002-1825-0097' }))
    .mockResolvedValueOnce(Response.json({ orcid: null }));
  render(<OrcidConnection inPublicProfile />);
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Disconnect ORCID',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  expect(
    screen.getByText('0000-0002-1825-0097', { exact: false })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect ORCID' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Connect ORCID' })).toBeTruthy()
  );
  expect(String(request.mock.calls[1]?.[0])).toContain('/api/orcid/me');
  expect((request.mock.calls[1]?.[1] as RequestInit)?.method).toBe('DELETE');
  expect(request.mock.calls.some(([url]) => String(url).includes('/pr'))).toBe(
    false
  );
});
