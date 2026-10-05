import { useCallback, useEffect, useState } from 'react';

import { logger } from '@founders-coffee/observability';

import {
  installPlatformFor,
  installPromptDueAt,
  isInstalledDisplay,
  RETURN_AFTER_MS,
  takeCapturedInstallPrompt,
  type BeforeInstallPromptEvent,
  type InstallPlatform,
} from '../../lib/install-prompt';
import {
  readInstallRecord,
  recordInstallOutcome,
  type InstallOutcome,
} from '../../lib/install-record';

type InstallSetup = {
  readonly platform: InstallPlatform;
  readonly firstSeenAt: number;
  readonly startedAt: number;
};

const OPEN_DIALOG = 'dialog[open]';

/**
 * The phone this page runs on and what it remembers, once mounted; null where the sheet never opens.
 *
 * That is the installed app itself, a computer, an app's own browser, a browser that cannot keep the
 * record, and any browser that has already answered the sheet.
 */
const useInstallSetup = (): InstallSetup | null => {
  const [setup, setSetup] = useState<InstallSetup | null>(null);

  useEffect(() => {
    if (isInstalledDisplay()) return;
    const platform = installPlatformFor(navigator.userAgent);
    if (!platform) return;
    const startedAt = Date.now();
    const record = readInstallRecord(startedAt);
    if (!record || record.outcome) return;
    setSetup({ platform, firstSeenAt: record.firstSeenAt, startedAt });
  }, []);

  return setup;
};

/**
 * When the current visit began: when the page started, or when it came back after half an hour away.
 *
 * A phone keeps a tab in memory for hours, so returning to the site does not always load a page.
 */
const useVisitStartedAt = (pageStartedAt: number | null): number | null => {
  const [restartedAt, setRestartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (pageStartedAt === null) return undefined;
    let hiddenAt: number | null = null;
    const onVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        hiddenAt = now;
        return;
      }
      if (hiddenAt !== null && now - hiddenAt >= RETURN_AFTER_MS)
        setRestartedAt(now);
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [pageStartedAt]);

  return restartedAt ?? pageStartedAt;
};

/**
 * When the reader first tapped or pressed a key on this page.
 */
const useEngagedAt = (isListening: boolean): number | null => {
  const [engagedAt, setEngagedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!isListening || engagedAt !== null) return undefined;
    const engage = () => setEngagedAt((current) => current ?? Date.now());
    window.addEventListener('pointerdown', engage, { capture: true });
    window.addEventListener('keydown', engage, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', engage, { capture: true });
      window.removeEventListener('keydown', engage, { capture: true });
    };
  }, [isListening, engagedAt]);

  return engagedAt;
};

/**
 * Chrome's install announcement for this page, from the head script or from Chrome later on.
 */
const useDeferredInstall = (isListening: boolean) => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (!isListening) return undefined;
    const captured = takeCapturedInstallPrompt();
    if (captured) setDeferred(captured);
    const hold = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', hold);
    return () => window.removeEventListener('beforeinstallprompt', hold);
  }, [isListening]);

  return [deferred, setDeferred] as const;
};

/**
 * Whether `dueAt` has passed. Once it has, it stays passed for the rest of the page.
 */
const useIsDue = (dueAt: number | null): boolean => {
  const [isDue, setIsDue] = useState(false);

  useEffect(() => {
    if (isDue || dueAt === null) return undefined;
    const timer = setTimeout(
      () => setIsDue(true),
      Math.max(0, dueAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [isDue, dueAt]);

  return isDue;
};

/**
 * Whether a dialog is open on the page, watched only while the sheet is waiting to show.
 */
const useIsDialogOpen = (isWatching: boolean): boolean => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isWatching) return undefined;
    const sync = () => setIsOpen(document.querySelector(OPEN_DIALOG) !== null);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    return () => observer.disconnect();
  }, [isWatching]);

  return isOpen;
};

/**
 * The install sheet's state: which sheet to show, if any, and its two answers.
 *
 * It opens on a phone that can install the app, after some use (see `installPromptDueAt`), on a
 * page that is not a task in progress (`canShow`) and never over an open dialog, which it gives
 * way to and comes back after. Android shows it only once Chrome has said the app can be
 * installed, because the Install button is Chrome's own prompt. Whatever the answer, it is
 * recorded on the device and the sheet never opens there again.
 */
export const useInstallPrompt = (canShow: boolean) => {
  const setup = useInstallSetup();
  const [outcome, setOutcome] = useState<InstallOutcome | null>(null);
  const isWaiting = setup !== null && outcome === null;
  const visitStartedAt = useVisitStartedAt(isWaiting ? setup.startedAt : null);
  const engagedAt = useEngagedAt(isWaiting);
  const [deferred, setDeferred] = useDeferredInstall(
    isWaiting && setup.platform === 'android',
  );
  const isDue = useIsDue(
    setup && visitStartedAt !== null
      ? installPromptDueAt({
          firstSeenAt: setup.firstSeenAt,
          visitStartedAt,
          engagedAt,
        })
      : null,
  );
  const canInstall = setup?.platform === 'ios' || deferred !== null;
  const isReady = isWaiting && isDue && canInstall && canShow;
  const isDialogOpen = useIsDialogOpen(isReady);

  const settle = useCallback((answer: InstallOutcome) => {
    recordInstallOutcome(answer, Date.now());
    setOutcome(answer);
  }, []);

  useEffect(() => {
    if (!isWaiting) return undefined;
    const onInstalled = () => settle('installed');
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [isWaiting, settle]);

  const install = useCallback(async () => {
    if (!deferred) return;
    setDeferred(null);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      settle(choice.outcome === 'accepted' ? 'installed' : 'dismissed');
    } catch (error) {
      logger.warn('install.prompt_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [deferred, setDeferred, settle]);

  const dismiss = useCallback(() => settle('dismissed'), [settle]);

  return {
    view: isReady && !isDialogOpen ? setup.platform : null,
    install,
    dismiss,
  };
};
