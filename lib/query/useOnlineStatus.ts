"use client";

import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}
