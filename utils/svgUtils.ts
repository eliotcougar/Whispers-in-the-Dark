/**
 * @file svgUtils.ts
 * @description Helper utilities for working with SVG coordinates.
 */

/**
 * Converts screen coordinates to SVG coordinates using the given SVG element's
 * current transformation matrix. If the matrix cannot be obtained, the input
 * coordinates are returned.
 */
export const getSVGCoordinates = (
  svgEl: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } => {
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const ctmInverse = ctm.inverse();
  const svgPoint = svgEl.createSVGPoint();
  svgPoint.x = clientX;
  svgPoint.y = clientY;
  const transformed = svgPoint.matrixTransform(ctmInverse);
  return { x: transformed.x, y: transformed.y };
};
