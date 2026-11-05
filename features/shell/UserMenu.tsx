"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearPersistedCache } from "@/lib/query/persist";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { ThemeToggle } from "./ThemeToggle";

export async function signOut({ clearQueryCache }: { clearQueryCache?: () => void } = {}) {
  clearQueryCache?.();
  await clearPersistedCache();
  if (typeof window !== "undefined" && "caches" in window) await caches.delete("cari-lista");
  await getBrowserSupabase().auth.signOut({ scope: "local" });
}

export function UserMenu({ householdId, email }: { householdId?: string; email?: string } = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await signOut({ clearQueryCache: () => queryClient.clear() });
    router.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu da conta">
          <UserRound />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {email && <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>}
        {householdId && (
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={`/${householdId}/casa`}>Gerenciar casa</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <ThemeToggle />
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11" onSelect={handleSignOut}>
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
