import { useEffect, useRef } from 'react';

/**
 * Houdt een fixed, schermvullende overlay binnen de VISUELE viewport. Op mobiel
 * verkleint het software-toetsenbord alleen de visuele viewport, niet de
 * layout-viewport — waardoor knoppen onderin een `position: fixed`-overlay
 * achter het toetsenbord verdwijnen. Op iOS Safari raakt zo'n overlay na het
 * sluiten van het toetsenbord bovendien zijn tik-positie kwijt (je kunt wél
 * scrollen, maar niet meer tikken).
 *
 * Deze hook stelt hoogte + verticale offset van het overlay-element in op de
 * actuele `window.visualViewport`, zodat het paneel altijd binnen het zichtbare
 * gebied valt en de tik-detectie klopt. Op desktop (geen keyboard) is de visuele
 * viewport gelijk aan de layout-viewport → geen zichtbaar effect.
 */
export function useVisualViewportOverlay<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    const update = () => {
      // bottom:auto nodig: met inset:0 fixeren top+bottom de hoogte en wordt de
      // expliciete hoogte genegeerd.
      el.style.bottom = 'auto';
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return ref;
}
