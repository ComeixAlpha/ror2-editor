/**
 * URLs for files that ship in `public/`.
 *
 * Always built from `import.meta.env.BASE_URL` rather than a bare leading `/`. The editor is
 * deployed under a sub-path (GitHub Pages serves it from `/ror2-editor/`), and a hand-written
 * absolute path would resolve against the domain root and 404. Vite rewrites the paths it generates
 * itself for the same reason; these are the ones it cannot see.
 */
export function publicUrl(path: string): string {
  // `BASE_URL` is always `/` or a `/`-terminated prefix, so no separator handling is needed.
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
