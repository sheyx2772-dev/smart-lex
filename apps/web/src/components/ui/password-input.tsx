"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  showLabel?: string;
  hideLabel?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showLabel = "Show password", hideLabel = "Hide password", ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-lg border border-input bg-card pl-3.5 pr-10 text-sm text-foreground shadow-sm",
            "placeholder:text-muted-foreground/55 transition-all hover:border-muted-foreground/30",
            "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
            "disabled:cursor-not-allowed disabled:bg-muted/50 disabled:shadow-none",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
