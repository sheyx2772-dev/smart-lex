import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-br from-primary to-secondary text-white shadow-[0_2px_8px_-2px_rgba(37,99,235,0.5)] hover:brightness-[1.06]",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:brightness-105",
        outline: "border border-border/80 bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-primary-soft/40",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_2px_8px_-2px_rgba(220,38,38,0.5)] hover:brightness-105",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
);
Button.displayName = "Button";
