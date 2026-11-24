import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/libs/utils/cn"

/* M3 buttons: filled (default), tonal (secondary), outlined, text (ghost). Hover/press use state layers. */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-md text-sm font-medium tracking-wide whitespace-nowrap transition-[box-shadow,background-color] outline-none select-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity hover:before:opacity-8 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:before:opacity-10 active:before:opacity-10 disabled:pointer-events-none disabled:bg-foreground/10 disabled:text-foreground/38 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125rem]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:shadow-elevation-1",
        secondary: "bg-secondary text-secondary-foreground hover:shadow-elevation-1",
        outline: "border-outline text-primary border bg-transparent",
        ghost: "text-primary bg-transparent",
        destructive: "bg-error-container text-on-error-container",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6",
        sm: "h-8 gap-1.5 px-4 text-[0.8125rem]",
        lg: "h-14 px-8 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
