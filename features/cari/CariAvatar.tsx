import Image from "next/image";
import { cn } from "cn";

/** Avatar da Cari (decorativo: o texto ao lado já diz quem fala). */
export function CariAvatar({ className, size = 48 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-primary/15", className)}
      style={{ width: size, height: size }}
    >
      <Image src="/cari/cari.svg" alt="" width={36} height={63} className="h-[88%] w-auto" unoptimized />
    </span>
  );
}
