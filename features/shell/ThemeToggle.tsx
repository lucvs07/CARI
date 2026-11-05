"use client";

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { setThemePreference, useThemePreference, type ThemePreference } from "./theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

/** Itens de menu (dentro de um DropdownMenuContent): Tema → Sistema/Claro/Escuro. */
export function ThemeToggle() {
  const pref = useThemePreference();
  return (
    <>
      <DropdownMenuLabel>Tema</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={pref} onValueChange={(v) => setThemePreference(v as ThemePreference)}>
        {OPTIONS.map((o) => (
          <DropdownMenuRadioItem key={o.value} value={o.value} className="min-h-11" onSelect={(e) => e.preventDefault()}>
            {o.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
