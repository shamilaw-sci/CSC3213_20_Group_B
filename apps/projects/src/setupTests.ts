import '@testing-library/jest-dom';

/* jsdom does not implement pointer capture or scrolling used by Radix Select. */
Object.defineProperties(HTMLElement.prototype, {
  hasPointerCapture: { value: () => false },
  releasePointerCapture: { value: () => undefined },
  scrollIntoView: { value: () => undefined },
  setPointerCapture: { value: () => undefined },
});
