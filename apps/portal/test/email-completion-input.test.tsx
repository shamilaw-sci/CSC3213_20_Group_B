import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { useState } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
});
const browserGlobals = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  Event: dom.window.Event,
  MouseEvent: dom.window.MouseEvent,
  KeyboardEvent: dom.window.KeyboardEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
};
const originalGlobals = Object.fromEntries(
  Object.keys(browserGlobals).map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ])
);
Object.assign(globalThis, browserGlobals);

const { act, cleanup, fireEvent, render } =
  await import('@testing-library/react');
const { EmailCompletionInput } =
  await import('@/components/auth/email-completion-input');

afterEach(() => cleanup());
afterAll(() => {
  for (const [name, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  dom.window.close();
});

function Fixture() {
  const [value, setValue] = useState('');
  return (
    <EmailCompletionInput value={value} onChange={setValue} disabled={false} />
  );
}

function input() {
  return document.querySelector<HTMLInputElement>('#email-input')!;
}

function ghost() {
  return document.querySelector<HTMLElement>('[aria-hidden="true"]');
}

describe('inline email completion input', () => {
  test('shows a suffix without changing the actual value or submitting on Enter', () => {
    render(<Fixture />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'john@sc' } });

    expect(input().value).toBe('john@sc');
    expect(ghost()?.textContent).toBe('john@sci.pdn.ac.lk');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(input().value).toBe('john@sc');
  });

  test('Tab commits before blur and preserves focus navigation', () => {
    render(<Fixture />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 's21513' } });
    const event = new dom.window.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    act(() => input().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(input().value).toBe('s21513@sci.pdn.ac.lk');
    fireEvent.blur(input());
    expect(input().value).toBe('s21513@sci.pdn.ac.lk');
  });

  test('ArrowRight commits only at the end without a selection', () => {
    render(<Fixture />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'john@p' } });
    act(() => {
      input().setSelectionRange(2, 2);
      fireEvent.select(input());
    });
    expect(ghost()).toBeNull();
    fireEvent.keyDown(input(), { key: 'ArrowRight' });
    expect(input().value).toBe('john@p');

    act(() => {
      input().setSelectionRange(2, 6);
      fireEvent.select(input());
    });
    expect(ghost()).toBeNull();
    fireEvent.keyDown(input(), { key: 'ArrowRight' });
    expect(input().value).toBe('john@p');

    act(() => {
      input().setSelectionRange(6, 6);
      fireEvent.select(input());
    });
    fireEvent.keyDown(input(), { key: 'ArrowRight' });
    expect(input().value).toBe('john@pdn.ac.lk');
  });

  test('Escape dismisses until an edit, while deletion and paste stay native', () => {
    render(<Fixture />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'john@s' } });
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(ghost()).toBeNull();
    fireEvent.keyDown(input(), { key: 'Backspace' });
    expect(input().value).toBe('john@s');
    fireEvent.change(input(), { target: { value: 'john@sc' } });
    expect(ghost()).not.toBeNull();
    fireEvent.change(input(), { target: { value: 'john@pdn.ac.lk' } });
    expect(input().value).toBe('john@pdn.ac.lk');
    expect(ghost()).toBeNull();
  });

  test('student blur completes, while full addresses and ordinary names remain', () => {
    render(<Fixture />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 's21sp513' } });
    fireEvent.blur(input());
    expect(input().value).toBe('s21sp513@sci.pdn.ac.lk');
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 's21513@pdn.ac.lk' } });
    fireEvent.blur(input());
    expect(input().value).toBe('s21513@pdn.ac.lk');
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'john' } });
    fireEvent.blur(input());
    expect(input().value).toBe('john');
  });

  test('hides the prediction while composing and after focus leaves', () => {
    render(<Fixture />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'john@sc' } });
    expect(ghost()).not.toBeNull();
    fireEvent.compositionStart(input());
    expect(ghost()).toBeNull();
    fireEvent.compositionEnd(input());
    expect(ghost()).not.toBeNull();
    fireEvent.blur(input());
    expect(ghost()).toBeNull();
  });
});
