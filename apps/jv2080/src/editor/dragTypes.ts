// Copied from apps/tb3/src/editor/dragTypes.ts.
// Drag-and-drop data types shared by the library browser and the slots.
export const PATCH_DRAG_TYPE = "application/x-jv-patch"; // a library patch, droppable on a slot
export const SLOT_DRAG_TYPE = "application/x-jv-slot"; // a slot's index, dropped on another slot to swap them
export const MOVE_DRAG_TYPE = "application/x-jv-move"; // a library entry, droppable on a folder
