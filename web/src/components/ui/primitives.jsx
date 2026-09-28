// Primitivas al estilo shadcn/ui (cva + Radix Slot), pero con los tokens de
// FIERRO ya definidos en styles.css (@theme) en vez de la paleta zinc/slate
// por defecto de shadcn — la app ya tenía un lenguaje visual propio bien
// afinado; el objetivo acá es composición y accesibilidad, no un reskin.
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils.js'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-r)] text-body font-medium transition-[transform,background,color,border-color] duration-150 active:scale-[.96] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        primary:
          "relative overflow-hidden bg-[image:var(--accent-grad)] text-[var(--on-accent)] shadow-[var(--accent-glow)] after:content-[''] after:absolute after:top-0 after:-left-[60%] after:h-full after:w-[40%] after:bg-[linear-gradient(115deg,transparent,rgba(255,255,255,.35),transparent)] after:pointer-events-none after:animate-[sweep_3.2s_ease-in-out_infinite]",
        /* Gemela ámbar de `primary`, con el mismo barrido de brillo, para el
           CTA que vive dentro de la tarjeta de calentamiento — que es cálida
           por diseño (calentar = calor). Con la paleta "acero" el primario es
           frío otra vez, así que un botón primario ahí adentro volvería a ser
           el único elemento frío de un bloque cálido. */
        warn:
          "relative overflow-hidden bg-[image:var(--grad-warn)] text-[var(--on-warn)] shadow-[var(--glow-warn)] after:content-[''] after:absolute after:top-0 after:-left-[60%] after:h-full after:w-[40%] after:bg-[linear-gradient(115deg,transparent,rgba(255,255,255,.35),transparent)] after:pointer-events-none after:animate-[sweep_3.2s_ease-in-out_infinite]",
        secondary: 'bg-surface-2 text-text border border-line-2',
        ghost: 'bg-transparent text-text-2 hover:text-text',
        outline: 'bg-transparent border border-line-2 text-text',
        icon: 'w-[38px] h-[38px] rounded-[13px] border border-white/10 text-text-2 bg-[linear-gradient(150deg,rgba(255,255,255,.09),rgba(255,255,255,.02))]',
        destructive: 'bg-danger/15 text-danger border border-danger/30',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-13 px-6 text-lg',
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
        'rounded-[var(--radius-r-lg)] border border-line bg-surface-2 p-4',
        className,
      )}
      {...props}
    />
  )
}

export function Badge({ className, tone = 'default', ...props }) {
  const tones = {
    default: 'bg-white/8 text-text-2',
    accent: 'bg-accent/15 text-accent',
    ok: 'bg-ok/15 text-ok',
    warn: 'bg-warn/15 text-warn',
    red: 'bg-danger/15 text-danger',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-micro font-semibold uppercase tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
