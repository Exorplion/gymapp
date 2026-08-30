// Revela un texto con GSAP — para títulos de pantalla (el nombre del día,
// los pasos del asistente de rutina).
//
// Parte por PALABRA, no por letra: la primera versión partía letra por
// letra y en las fuentes condensadas itálicas del proyecto (Barlow
// Condensed, con letter-spacing negativo en varios títulos) se veía mal —
// cada glyph se mide y posiciona suelto, sin los pares de kerning que el
// tipo de letra ya trae ajustados, y el tracking negativo no se aplica
// igual entre cajas inline-block separadas. Una palabra entera es un único
// span: el navegador la dibuja de un tirón con su kerning normal, y lo
// único que se anima es la aparición de la palabra completa.
//
// Se re-anima cada vez que cambia `text` (dependencia del efecto): un título
// que cambia de contenido (ej. "Sin rutina" -> "Push" al armar el split)
// vuelve a entrar en vez de aparecer de golpe.
//
// aria-label lleva el texto completo y los <span> individuales van
// aria-hidden: un lector de pantalla no tiene por qué escuchar palabra por
// palabra lo que para el ojo es una sola frase.
import { Fragment, useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function AnimatedText({ text, as: Tag = 'span', className, style }) {
  const ref = useRef(null);
  const palabras = String(text ?? '').split(' ');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const words = el.querySelectorAll(':scope > span');
    if (!words.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' },
      );
    });
    return () => ctx.revert();
  }, [text]);

  return (
    <Tag ref={ref} className={className} style={style} aria-label={text}>
      {palabras.map((w, i) => (
        // El espacio va COMO HERMANO del span, no adentro: un espacio al
        // final del contenido de un inline-block cae justo en el borde de su
        // propio mini-formato de línea, y el navegador lo recorta igual que
        // recortaría un espacio al final de cualquier línea — eso era lo que
        // pegaba las palabras ("Nuevarutina"). Afuera, como texto plano del
        // contenedor (que es inline normal, no inline-block), el espacio no
        // toca ningún borde y se ve.
        <Fragment key={i}>
          <span aria-hidden="true" style={{ display: 'inline-block' }}>{w}</span>
          {i < palabras.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </Tag>
  );
}
