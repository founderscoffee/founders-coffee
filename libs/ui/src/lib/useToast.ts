import { Store, useStore } from '@tanstack/react-store';
import { useCallback, useEffect, useState } from 'react';

export type ToastMessage = {
  message: string;
  variant: 'success' | 'error';
};

export const useToast = () => {
  const [store] = useState(() => new Store<ToastMessage | null>(null));
  const notification = useStore(store, (value) => value);
  const clear = useCallback(() => store.setState(() => null), [store]);
  const show = useCallback(
    (message: string, variant: ToastMessage['variant']) =>
      store.setState(() => ({ message, variant })),
    [store],
  );

  useEffect(() => {
    if (notification?.variant !== 'success') return;
    const timeout = setTimeout(clear, 5000);
    return () => clearTimeout(timeout);
  }, [notification, clear]);

  return { notification, show, clear };
};
