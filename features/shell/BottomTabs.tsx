"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Package, ShoppingCart } from "lucide-react";
import { cn } from "cn";
import { countUnchecked } from "@/features/shopping/model";
import { useList } from "@/features/shopping/queries";

const TABS = [
  { slug: "estoque", label: "Estoque", Icon: Package },
  { slug: "lista", label: "Lista", Icon: ShoppingCart },
  { slug: "receitas", label: "Receitas", Icon: BookOpen },
] as const;

export function BottomTabs({ householdId }: { householdId: string }) {
  const pathname = usePathname();
  // Mesmo cache ['list', id] da tela: o Realtime e as escritas otimistas mantêm o número vivo.
  const { data: entries } = useList(householdId);
  const pendingCount = countUnchecked(entries);
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ slug, label, Icon }) => {
          const href = `/${householdId}/${slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={slug} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "text-primary" : "text-secondary",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {slug === "lista" && pendingCount > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-1.5 left-3 min-w-4 rounded-full bg-primary px-1 text-center text-[0.625rem] leading-4 font-semibold text-primary-foreground tabular-nums"
                    >
                      {pendingCount}
                    </span>
                  )}
                </span>
                {label}
                {slug === "lista" && pendingCount > 0 && <span className="sr-only">({pendingCount} a comprar)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
