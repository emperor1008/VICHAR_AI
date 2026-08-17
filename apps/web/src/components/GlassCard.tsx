import { cx } from "@/lib/format";

export function GlassCard({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={cx("glass", hover && "glass-hover", className)}>{children}</div>;
}
