import { afterAll, afterEach, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://people.scs-pdn.space',
  pretendToBeVisual: true,
});
const browserGlobals = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle,
  requestAnimationFrame: dom.window.requestAnimationFrame,
  cancelAnimationFrame: dom.window.cancelAnimationFrame,
  IS_REACT_ACT_ENVIRONMENT: true,
};
const originals = Object.fromEntries(
  Object.keys(browserGlobals).map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ])
);
Object.assign(globalThis, browserGlobals);

const { act, cleanup, render, screen, waitFor } =
  await import('@testing-library/react');
const { VerifiedOrcidLink } =
  await import('@/components/people/verified-orcid-link');

afterEach(() => cleanup());
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  dom.window.close();
});

test('the separate verification trigger shows a short tooltip on keyboard focus', async () => {
  render(<VerifiedOrcidLink href="https://orcid.org/0000-0002-1825-0097" />);
  const link = screen.getByRole('link', { name: 'ORCID' });
  const trigger = screen.getByRole('button', { name: 'Verified' });
  expect(link.getAttribute('href')).toBe(
    'https://orcid.org/0000-0002-1825-0097'
  );
  expect(link.contains(trigger)).toBe(false);
  act(() => trigger.focus());
  await waitFor(() => {
    expect(screen.getByText('Verified')).toBeTruthy();
  });
});
