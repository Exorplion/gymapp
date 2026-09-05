// Primitivas al estilo shadcn/ui (cva + Radix Slot), pero con los tokens de
// FIERRO ya definidos en styles.css (@theme) en vez de la paleta zinc/slate
// por defecto de shadcn — la app ya tenía un lenguaje visual propio bien
// afinado; el objetivo acá es composición y accesibilidad, no un reskin.
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils.js'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-r)] text-[15px] font-medium transition-[transform,background,color,border-color] duration-150 active:scale-[.96] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue2 focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        primary:
          "relative overflow-hidden bg-[image:var(--grad2)] text-[var(--on-grad)] shadow-[var(--glow)] after:content-[''] after:absolute after:top-0 after:-left-[60%] after:h-full after:w-[40%] after:bg-[linear-gradient(115deg,transparent,rgba(255,255,255,.35),transparent)] after:pointer-events-none after:animate-[sweep_3.2s_ease-in-out_infinite]",
        /* Hubo una variante `warn` (gemela ámbar de `primary`) creada cuando
           el primario era CIAN y desentonaba dentro de la tarjeta cálida del
           calentamiento. Con la paleta "hierro y encendido" el primario ya es
           naranja, así que esa razón desapareció y mantenerla dejaría dos
           gradientes cálidos casi idénticos — la acumulación que la
           reformulación vino a cortar. Un solo color de acción: `primary`. */
        secondary: 'bg-card2 text-txt border border-line2',
        ghost: 'bg-transparent text-mut hover:text-txt',
        outline: 'bg-transparent border border-line2 text-txt',
        icon: 'w-[38px] h-[38px] rounded-[13px] border border-white/10 text-mut bg-[linear-gradient(150deg,rgba(255,255,255,.09),rgba(255,255,255,.02))]',
        destructive: 'bg-red/15 text-red border border-red/30',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4 text-[13px]',
        lg: 'h-13 px-6 text-[18px]',
        icon: 'w-[38px] h-[38px] p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-r-lg)] border border-line bg-card2 p-4',
        className,
      )}
      {...props}
    />
  )
}

export function Badge({ className, tone = 'default', ...props }) {
  const tones = {
    default: 'bg-white/8 text-mut',
    accent: 'bg-accent/15 text-accent',
    ok: 'bg-ok/15 text-ok',
    warn: 'bg-warn/15 text-warn',
    red: 'bg-red/15 text-red',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
