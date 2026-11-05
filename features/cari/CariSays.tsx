import type { ReactNode } from "react";
import { CariAvatar } from "./CariAvatar";

/** Avatar + balão de fala. Com `live`, anuncia a fala como feedback (role="status"). */
export function CariSays({
  message,
  action,
  live = false,
}: {
  message: string;
  action?: ReactNode;
  live?: boolean;
}) {
  return (
    <div className="flex items-end gap-3" {...(live ? { role: "status" } : {})}>
      <CariAvatar />
      <div className="flex min-w-0 flex-col items-start gap-3 rounded-2xl rounded-bl-sm bg-surface-container-low px-4 py-3 ring-1 ring-border">
        <p className="text-base leading-snug">{message}</p>
        {action}
      </div>
    </div>
  );
}
