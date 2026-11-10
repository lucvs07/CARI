"use client";

import { useHouseholdRealtime } from "./useHouseholdRealtime";

export function RealtimeBridge({ householdId }: { householdId: string }) {
  useHouseholdRealtime(householdId);
  return null;
}
