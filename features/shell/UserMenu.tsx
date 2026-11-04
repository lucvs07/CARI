"use client";

import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearPersistedCache } from "@/lib/query/persist";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export async function signOut({ clearQueryCache }: { clearQueryCache?: () => void } = {}) {
  clearQueryCache?.(); // Task 9: passar queryClient.clear
  await clearPersistedCache();
  if (typeof window !== "undefined" && "caches" in window) await caches.delete("cari-lista");
  await getBrowserSupabase().auth.signOut({ scope: "local" });
}

export function UserMenu() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu da conta">
          <UserRound />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleSignOut}>Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
