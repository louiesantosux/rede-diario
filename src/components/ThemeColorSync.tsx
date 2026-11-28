'use client';

import { useEffect } from 'react';

/**
 * Mantém a cor das barras do navegador (status do iPhone, barra do Safari e
 * Chrome no Android) igual ao papel de parede do tema atual, inclusive quando
 * o tema muda sem recarregar a página.
 */
export function ThemeColorSync() {
  useEffect(() => {
    const root = document.documentElement;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    const probe = document.createElement('span');
    probe.style.display = 'none';
    probe.style.color = 'var(--bg)';
    document.body.appendChild(probe);

    const update = () => {
      const color = getComputedStyle(probe).color;
      if (color && meta && meta.content !== color) meta.content = color;
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['style', 'data-theme'] });
    return () => {
      observer.disconnect();
      probe.remove();
    };
  }, []);
  return null;
}
