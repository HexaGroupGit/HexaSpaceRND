import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils.js'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground border-border',
        success: 'border-transparent bg-green-100 text-green-800',
        warning: 'border-transparent bg-amber-100 text-amber-800',
        destructive: 'border-transparent bg-red-100 text-red-700',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
