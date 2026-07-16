import * as React from "react";
import { cn } from "@/lib/utils";

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ required, children, className, ...props }: LabelProps) {
  return (
    <label className={cn("text-sm font-medium text-foreground", className)} {...props}>
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </label>
  );
}
