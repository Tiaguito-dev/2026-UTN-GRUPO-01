/**
 * The block a heading titles: its largest ancestor that holds no other heading of the same level.
 * Lets a spec scope queries to "the card of Materias" or "the 1.º año group" without depending on
 * whether the markup uses `<section>`, `<article>` or a `<div>`.
 */
export function regionOf(heading: HTMLElement): HTMLElement {
  const tag = heading.tagName;
  let region = heading;
  while (region.parentElement && region.parentElement.getElementsByTagName(tag).length === 1) region = region.parentElement;
  return region;
}
