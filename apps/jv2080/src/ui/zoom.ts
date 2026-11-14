// Copied from apps/tb3/src/ui/zoom.ts.
// The editor's fit zoom: CSS `zoom` on the root, set by editor/useFitZoom.ts. Pointer events
// report viewport px, so drags divide their movement by it to work in the layout's own px.
let current = 1;

export const getZoom = () => current;
export const setZoom = (z: number) => {
  current = z;
};
