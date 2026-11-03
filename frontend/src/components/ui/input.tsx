import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // 16px on mobile avoids iOS auto-zoom on focus; 44px tall for touch.
        "h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground transition-[border-color] duration-150 placeholder:text-muted-fg sm:h-10 sm:text-sm",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
