import { Store, useStore } from '@tanstack/react-store';
import { useCallback, useRef, useState } from 'react';

export type ToastMessage = {
  message: string;
  variant: 'success' | 'error';
};

export type ToastNotice = ToastMessage & { readonly id: number };

/**
 * One toast at a time for a screen, with the time it stays up left to the Toast that renders it.
 *
 * Every show carries a fresh id for the renderer to key its Toast on, so showing the same message
 * again starts that toast's five seconds over instead of letting the first showing's clock close it.
 */
export const useToast = () => {
  const [store] = useState(() => new Store<ToastNotice | null>(null));
  const shown = useRef(0);
  const notification = useStore(store, (value) => value);
  const clear = useCallback(() => store.setState(() => null), [store]);
  const show = useCallback(
    (message: string, variant: ToastMessage['variant']) => {
      shown.current += 1;
      const id = shown.current;
      store.setState(() => ({ id, message, variant }));
    },
    [store],
  );

  return { notification, show, clear };
};
