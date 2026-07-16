import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm text-foreground shadow-sm",
        "placeholder:text-muted-foreground/55 transition-all",
        "hover:border-muted-foreground/30",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
        "disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground disabled:shadow-none",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
