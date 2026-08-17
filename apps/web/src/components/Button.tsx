"use client";

import { cx } from "@/lib/format";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  return (
    <button
      className={cx(
        "focus-ring inline-flex items-center justify-center gap-2 font-semibold transition-all",
        variant === "primary" && "btn-primary",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-ghost text-red-600 dark:text-red-400 hover:!border-red-400 hover:!bg-red-50 dark:hover:!bg-red-950/30",
        size === "sm" && "px-4 py-2 text-sm",
        size === "md" && "px-6 py-2.5 text-sm",
        size === "lg" && "px-8 py-3.5 text-base",
        className,
      )}
      {...rest}
    />
  );
}
