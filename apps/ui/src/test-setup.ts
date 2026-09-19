const noop = (): void => undefined;

class TestResizeObserver implements ResizeObserver {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}

globalThis.ResizeObserver ??= TestResizeObserver;

/**
 * Give jsdom the part of `<dialog>` it does not implement.
 *
 * jsdom has the element and reflects its `open` attribute, but ships neither `showModal` nor
 * `close`, so any component that opens a real modal throws on mount. The shim is installed per
 * element as it is created, rather than on the prototype, because a prototype method needs `this`
 * and this codebase is arrow functions only.
 */
const shimDialog = (dialog: HTMLDialogElement): void => {
  Object.defineProperties(dialog, {
    showModal: {
      configurable: true,
      value: () => dialog.setAttribute('open', ''),
    },
    close: {
      configurable: true,
      value: () => {
        dialog.removeAttribute('open');
        dialog.dispatchEvent(new Event('close'));
      },
    },
  });
};

const nativeCreateElement = document.createElement.bind(document);

document.createElement = ((
  tagName: string,
  options?: ElementCreationOptions,
) => {
  const element = nativeCreateElement(tagName, options);
  if (tagName.toLowerCase() === 'dialog')
    shimDialog(element as HTMLDialogElement);
  return element;
}) as typeof document.createElement;
