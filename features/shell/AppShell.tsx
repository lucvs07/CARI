import type { ReactNode } from "react";
import { ClaimLocalData } from "@/lib/query/userGate";
import { BottomTabs } from "./BottomTabs";
import { CurrentUserProvider } from "./CurrentUser";
import { HouseholdSwitcher } from "./HouseholdSwitcher";
import { PendingSyncChip } from "./PendingSyncChip";
import { UserMenu } from "./UserMenu";

export function AppShell({
  householdId,
  households,
  user,
  children,
}: {
  householdId: string;
  households: { id: string; name: string }[];
  user: { id: string; email?: string };
  children: ReactNode;
}) {
  return (
    <CurrentUserProvider userId={user.id}>
      <ClaimLocalData userId={user.id} />
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background px-2 py-1">
          <HouseholdSwitcher userId={user.id} currentId={householdId} households={households} />
          <div className="flex items-center gap-1">
            <PendingSyncChip />
            <UserMenu householdId={householdId} email={user.email} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 p-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)]">
          {children}
        </main>
        <BottomTabs householdId={householdId} />
      </div>
    </CurrentUserProvider>
  );
}
