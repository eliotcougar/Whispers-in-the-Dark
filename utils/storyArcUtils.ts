import type { StoryArc } from '../types';

/**
 * Validates that a story arc contains a usable current act.
 * Returns true if the arc has a current act within bounds and
 * that act includes a side objectives array.
 */
export const isStoryArcValid = (arc: StoryArc | null | undefined): arc is StoryArc => {
  if (!arc) return false;
  if (!Array.isArray(arc.acts) || arc.acts.length === 0) return false;
  const index = arc.currentAct - 1;
  if (index < 0 || index >= arc.acts.length) return false;
  const act = arc.acts.at(index);
  if (!act) return false;
  if (!Array.isArray(act.sideObjectives)) return false;
  return true;
};
