import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getVisibleFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true'
  );
}

/**
 * Applies scroll locking, focus containment and focus restoration to every
 * aria-modal dialog rendered by the app, including lazy-loaded dialogs.
 */
export function useDialogAccessibility(): void {
  useEffect(() => {
    let activeDialog: HTMLElement | null = null;
    let previousActiveElement: HTMLElement | null = null;
    const dialogFocusOrigins = new WeakMap<HTMLElement, HTMLElement | null>();
    const originalBodyOverflow = document.body.style.overflow;

    const getTopDialog = (): HTMLElement | null => {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
      ).filter((dialog) => dialog.getClientRects().length > 0);

      return dialogs.at(-1) ?? null;
    };

    const focusInsideDialog = (dialog: HTMLElement) => {
      const preferredTarget = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]');
      const target = preferredTarget && preferredTarget.getClientRects().length > 0
        ? preferredTarget
        : getVisibleFocusableElements(dialog)[0] ?? dialog;
      if (target === dialog && !dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
      target.focus({ preventScroll: true });
    };

    const syncDialog = () => {
      const nextDialog = getTopDialog();
      const openDialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
      ).filter((dialog) => dialog.getClientRects().length > 0);

      openDialogs.forEach((dialog) => {
        if (dialog === nextDialog) {
          if (dialog.dataset.rooservDialogInert === 'true') {
            dialog.inert = false;
            dialog.removeAttribute('aria-hidden');
            delete dialog.dataset.rooservDialogInert;
          }
          return;
        }
        dialog.inert = true;
        dialog.setAttribute('aria-hidden', 'true');
        dialog.dataset.rooservDialogInert = 'true';
      });

      if (nextDialog === activeDialog) return;

      const previousDialog = activeDialog;
      if (nextDialog && !dialogFocusOrigins.has(nextDialog)) {
        dialogFocusOrigins.set(
          nextDialog,
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        );
      }
      const nestedReturnTarget = previousDialog && !document.body.contains(previousDialog)
        ? dialogFocusOrigins.get(previousDialog) ?? null
        : null;

      if (!activeDialog && nextDialog) {
        previousActiveElement = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      }

      activeDialog = nextDialog;

      if (activeDialog) {
        document.body.style.overflow = 'hidden';
        window.setTimeout(() => {
          if (nestedReturnTarget && activeDialog?.contains(nestedReturnTarget)) {
            nestedReturnTarget.focus({ preventScroll: true });
            return;
          }
          if (activeDialog && !activeDialog.contains(document.activeElement)) {
            focusInsideDialog(activeDialog);
          }
        }, 0);
        return;
      }

      document.body.style.overflow = originalBodyOverflow;
      previousActiveElement?.focus({ preventScroll: true });
      previousActiveElement = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeDialog) return;

      if (event.key === 'Escape') {
        const closeButton = activeDialog.querySelector<HTMLButtonElement>(
          'button[aria-label^="Fechar"]:not([disabled])'
        );
        if (closeButton) {
          event.preventDefault();
          closeButton.click();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getVisibleFocusableElements(activeDialog);
      if (focusable.length === 0) {
        event.preventDefault();
        focusInsideDialog(activeDialog);
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focused = document.activeElement;

      if (event.shiftKey && (focused === first || !activeDialog.contains(focused))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (activeDialog && event.target instanceof Node && !activeDialog.contains(event.target)) {
        focusInsideDialog(activeDialog);
      }
    };

    const observer = new MutationObserver(syncDialog);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    syncDialog();

    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.body.style.overflow = originalBodyOverflow;
      document.querySelectorAll<HTMLElement>('[data-rooserv-dialog-inert="true"]').forEach((dialog) => {
        dialog.inert = false;
        dialog.removeAttribute('aria-hidden');
        delete dialog.dataset.rooservDialogInert;
      });
    };
  }, []);
}
