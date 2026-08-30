// Revela un texto letra por letra con GSAP — para títulos de pantalla (el
// nombre del día, los pasos del asistente de rutina), no para texto largo:
// partir en <span> cuesta más cuanto más caracteres hay.
//
// Se re-anima cada vez que cambia `text` (dependencia del efecto): un título
// que cambia de contenido (ej. "Sin rutina" -> "Push" al armar el split)
// vuelve a entrar en vez de aparecer de golpe.
//
// aria-label lleva el texto completo y los <span> individuales van
// aria-hidden: un lector de pantalla no tiene por qué escuchar letra por
// letra lo que para el ojo es una sola palabra.
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function AnimatedText({ text, as: Tag = 'span', className, style }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const chars = el.querySelectorAll(':scope > span');
    if (!chars.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        { opacity: 0, y: 16, rotateX: -50 },
        { opacity: 1, y: 0, rotateX: 0, duration: 0.5, stagger: 0.022, ease: 'power3.out' },
      );
    });
    return () => ctx.revert();
  }, [text]);

  return (
    <Tag ref={ref} className={className} style={{ ...style, display: 'inline-block', perspective: 300 }} aria-label={text}>
      {[...String(text ?? '')].map((c, i) => (
        <span key={i} aria-hidden="true" style={{ display: 'inline-block' }}>
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </Tag>
  );
}
