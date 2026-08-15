import { useSyncExternalStore } from "react";

// ONE global 1s tick shared by every live card/timer in the app.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function start() {
  if (timer) return;
  timer = setInterval(() => {
    now = Date.now();
    listeners.forEach((l) => l());
  }, 1000);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}
