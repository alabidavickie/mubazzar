import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-sans font-bold transition-[transform,opacity,background-color] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-navy text-on-dark shadow-card hover:bg-navy-ink",
        cta: "border-t-2 border-gold bg-navy text-on-dark shadow-raised hover:bg-navy-ink",
        gold: "bg-gold-soft text-bronze-ink shadow-card hover:bg-gold-dim",
        whatsapp: "bg-emerald-ink text-on-dark shadow-raised hover:bg-emerald-deep",
        outline: "border-[1.5px] border-navy bg-transparent text-navy hover:bg-surface-container",
        soft: "bg-surface-high text-navy hover:bg-navy hover:text-on-dark",
        ghost: "bg-transparent text-navy hover:bg-surface-container",
        danger: "bg-urgent text-on-dark hover:opacity-90",
      },
      size: {
        sm: "h-9 rounded-md px-3 text-label-sm",
        md: "h-11 rounded-lg px-4 text-label-md",
        lg: "min-h-[52px] rounded-lg px-5 text-label-lg",
        xl: "min-h-14 rounded-lg px-6 text-label-lg uppercase tracking-wide",
        icon: "size-11 rounded-full p-0",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
});
