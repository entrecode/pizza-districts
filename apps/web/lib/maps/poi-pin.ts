/**
 * DOM for AdvancedMarker `content`. Kept pure (no React) so Vitest can assert labels cheaply.
 */
export function buildPoiPinElement(label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className =
    "flex max-w-[10rem] items-center justify-center rounded-pill bg-brand-primary px-2 py-0.5 text-center text-caption text-brand-primary-ink shadow-elevation-sm";
  el.textContent = label;
  return el;
}
