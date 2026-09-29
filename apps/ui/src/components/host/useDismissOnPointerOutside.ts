import { useEffect, useEffectEvent, type RefObject } from 'react';

import { isOutside } from '../shell/useDismissableDetails';

/**
 * Call `onDismiss` when a pointer goes down anywhere outside `ref`, for as long as `isActive`.
 *
 * `pointerdown` rather than `click`, as for the header menu: the panel is out of the way by the
 * time the finger lifts, and a drag of the map that starts outside it counts as well. The listener
 * exists only while the panel is open, and always calls the latest `onDismiss`.
 */
export const useDismissOnPointerOutside = (
  ref: RefObject<HTMLElement | null>,
  isActive: boolean,
  onDismiss: () => void,
) => {
  const dismiss = useEffectEvent(onDismiss);

  useEffect(() => {
    if (!isActive) return;
    const onPointerDown = (event: Event) => {
      if (isOutside(ref.current, event.target)) dismiss();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [ref, isActive]);
};
