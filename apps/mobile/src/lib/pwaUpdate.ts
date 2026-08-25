export type PwaUpdateHandler = () => Promise<void>;

type PwaUpdateListener = (update: PwaUpdateHandler) => void;

let pendingUpdate: PwaUpdateHandler | null = null;
const listeners = new Set<PwaUpdateListener>();

export const notifyPwaUpdateAvailable = (update: PwaUpdateHandler) => {
  pendingUpdate = update;
  listeners.forEach((listener) => listener(update));
};

export const subscribeToPwaUpdate = (listener: PwaUpdateListener) => {
  listeners.add(listener);

  // onNeedRefresh pode acontecer antes de o React montar o prompt.
  if (pendingUpdate) listener(pendingUpdate);

  return () => listeners.delete(listener);
};

export const clearPwaUpdate = (update?: PwaUpdateHandler) => {
  if (!update || pendingUpdate === update) pendingUpdate = null;
};
