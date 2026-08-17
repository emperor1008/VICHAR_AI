import Image from "next/image";
import { cx } from "@/lib/format";

type BrandMarkSize = "sm" | "md" | "lg" | "xl" | "splash";

const SIZE_STYLES: Record<BrandMarkSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-20 w-20",
  splash: "h-40 w-40 sm:h-48 sm:w-48",
};

const IMAGE_SIZES: Record<BrandMarkSize, string> = {
  sm: "32px",
  md: "40px",
  lg: "48px",
  xl: "80px",
  splash: "(min-width: 640px) 192px, 160px",
};

export function BrandMark({
  size = "md",
  className,
  decorative = false,
  priority = false,
}: {
  size?: BrandMarkSize;
  className?: string;
  decorative?: boolean;
  priority?: boolean;
}) {
  return (
    <span
      className={cx(
        "relative inline-flex shrink-0 overflow-hidden rounded-[28%] bg-[#fff3ea] shadow-[0_8px_24px_rgba(192,91,116,0.16)] ring-1 ring-[#c76b82]/15",
        SIZE_STYLES[size],
        className,
      )}
      aria-hidden={decorative || undefined}
    >
      <Image
        src="/vichar-heart-logo.webp"
        alt={decorative ? "" : "Vichar AI heart logo"}
        fill
        sizes={IMAGE_SIZES[size]}
        className="object-cover"
        priority={priority}
      />
    </span>
  );
}
