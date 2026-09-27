import { useEffect } from 'react';
import { DEFAULT_CONFIG, useAppState } from '../state/store';

/** The part of a CSSStyleDeclaration the colours need. */
interface StyleTarget {
  setProperty(prop: string, value: string): void;
  removeProperty(prop: string): void;
}

/**
 * Sets the --read or --write highlight colour. Only a colour the user picked goes inline; the
 * default one is removed, so the light or dark theme supplies it.
 */
export function applyHighlightColor(style: StyleTarget, prop: '--read' | '--write', color: string, defaultColor: string): void {
  if (color.toLowerCase() === defaultColor.toLowerCase()) style.removeProperty(prop);
  else style.setProperty(prop, color);
}

/** Keeps the page's highlight colours in step with Configurar. */
export function useHighlightColors(): void {
  const readColor = useAppState((s) => s.config.readColor);
  const writeColor = useAppState((s) => s.config.writeColor);
  useEffect(() => {
    applyHighlightColor(document.documentElement.style, '--read', readColor, DEFAULT_CONFIG.readColor);
  }, [readColor]);
  useEffect(() => {
    applyHighlightColor(document.documentElement.style, '--write', writeColor, DEFAULT_CONFIG.writeColor);
  }, [writeColor]);
}
