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
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { clearLocalUserData, type LocalDataClient } from "./localData";
import { ThemeToggle } from "./ThemeToggle";

type SignOutDeps = {
  queryClient: LocalDataClient;
  navigate: () => void;
};

/** Sem rede o signOut local pode esperar o lock/refresh da sessão: "Sair" nunca trava por isso. */
export const SIGN_OUT_TIMEOUT_MS = 3_000;

/**
 * Ordem importa: encerra a sessão antes de limpar, para nenhum refetch repopular o cache do usuário
 * anterior. Cada passo é independente; a limpeza e a navegação acontecem sempre.
 */
export async function signOut({ queryClient, navigate }: SignOutDeps) {
  try {
    await Promise.race([
      getBrowserSupabase().auth.signOut({ scope: "local" }),
      new Promise((resolve) => setTimeout(resolve, SIGN_OUT_TIMEOUT_MS)),
    ]);
  } catch {
    // segue limpando e saindo mesmo assim
  }
  try {
    await clearLocalUserData(queryClient);
  } finally {
    navigate();
  }
}

export function UserMenu({ householdId, email }: { householdId?: string; email?: string } = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await signOut({ queryClient, navigate: () => router.replace("/login") });
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
