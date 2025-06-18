/**
 * @file useMapInteractions.ts
 * @description Hook providing pan and zoom handlers for the map display.
 */

import { useState, useRef, useEffect } from 'react';
import { VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL } from '../constants';
import { getSVGCoordinates } from '../utils/svgUtils';

export interface UseMapInteractionsResult {
  viewBox: string;
  svgRef: React.RefObject<SVGSVGElement | null>;
  handleMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
  handleWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
  handleTouchStart: (e: React.TouchEvent<SVGSVGElement>) => void;
  handleTouchMove: (e: React.TouchEvent<SVGSVGElement>) => void;
  handleTouchEnd: (e: React.TouchEvent<SVGSVGElement>) => void;
}

/** Provides pan and zoom interaction handlers for a map SVG element. */
export const useMapInteractions = (
  initialViewBox: string = `${-VIEWBOX_WIDTH_INITIAL / 2} ${-VIEWBOX_HEIGHT_INITIAL / 2} ${VIEWBOX_WIDTH_INITIAL} ${VIEWBOX_HEIGHT_INITIAL}`,
  onViewBoxChange?: (viewBox: string) => void
): UseMapInteractionsResult => {
  const [viewBox, setViewBox] = useState(initialViewBox);
  const updateViewBox = (box: string) => {
    setViewBox(box);
    if (onViewBoxChange) onViewBoxChange(box);
  };
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastScreenDragPoint, setLastScreenDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);

  useEffect(() => {
    setViewBox(prev => (prev === initialViewBox ? prev : initialViewBox));
  }, [initialViewBox]);

  /** Starts drag panning. */
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest('.map-node')) return;
    setIsDragging(true);
    setLastScreenDragPoint({ x: e.clientX, y: e.clientY });
    if (svgRef.current) svgRef.current.style.cursor = 'grabbing';
  };

  /** Pans the map on mouse move. */
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !lastScreenDragPoint || !svgRef.current) return;

    const svgEl = svgRef.current;
    const prevSVGPoint = getSVGCoordinates(
      svgEl,
      lastScreenDragPoint.x,
      lastScreenDragPoint.y
    );
    const currentSVGPoint = getSVGCoordinates(svgEl, e.clientX, e.clientY);

    const deltaViewBoxX = prevSVGPoint.x - currentSVGPoint.x;
    const deltaViewBoxY = prevSVGPoint.y - currentSVGPoint.y;

    const [vx, vy, vw, vh] = viewBox.split(' ').map(parseFloat);
    updateViewBox(`${vx + deltaViewBoxX} ${vy + deltaViewBoxY} ${vw} ${vh}`);
    setLastScreenDragPoint({ x: e.clientX, y: e.clientY });
  };

  /** Stops drag panning. */
  const handleMouseUp = () => {
    setIsDragging(false);
    setLastScreenDragPoint(null);
    if (svgRef.current) svgRef.current.style.cursor = 'grab';
  };

  /** Ends drag if the mouse leaves the SVG. */
  const handleMouseLeave = () => {
    if (isDragging) handleMouseUp();
  };

  /**
   * Zooms the viewBox with the mouse wheel. The event may be marked as
   * passive by the browser, so first check if it is cancelable before calling
   * `preventDefault` to avoid console warnings.
   */
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (e.cancelable) e.preventDefault();
    if (!svgRef.current) return;

    const [vx, vy, vw, vh] = viewBox.split(' ').map(parseFloat);
    const zoomFactor = 1.1;
    const newVw = e.deltaY < 0 ? vw / zoomFactor : vw * zoomFactor;
    const newVh = e.deltaY < 0 ? vh / zoomFactor : vh * zoomFactor;

    const minDim = Math.min(VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL) * 0.1;
    const maxDim = Math.min(VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL) * 10;

    if (newVw < minDim || newVw > maxDim || newVh < minDim || newVh > maxDim) return;

    const svgEl = svgRef.current;
    const svgPoint = getSVGCoordinates(svgEl, e.clientX, e.clientY);

    const newVx = svgPoint.x - (svgPoint.x - vx) * (newVw / vw);
    const newVy = svgPoint.y - (svgPoint.y - vy) * (newVh / vh);

    updateViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
  };

  /** Returns the distance between two touch points. */
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
  };

  /** Starts touch interactions for panning or pinch zoom. */
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (e.cancelable) e.preventDefault();

    if (e.touches.length === 1) {
      if ((e.target as SVGElement).closest('.map-node')) return;
      setIsDragging(true);
      setLastScreenDragPoint({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setLastPinchDistance(null);
      svgRef.current.style.cursor = 'grabbing';
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      setLastPinchDistance(getTouchDistance(e.touches[0], e.touches[1]));
      setLastScreenDragPoint(null);
    }
  };

  /** Handles touch movement for panning or pinch zooming. */
  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (e.cancelable) e.preventDefault();

    if (e.touches.length === 1 && isDragging && lastScreenDragPoint) {
      const touch = e.touches[0];
      const svgEl = svgRef.current;
      const prevSVGPoint = getSVGCoordinates(
        svgEl,
        lastScreenDragPoint.x,
        lastScreenDragPoint.y
      );
      const currentSVGPoint = getSVGCoordinates(
        svgEl,
        touch.clientX,
        touch.clientY
      );

      const deltaViewBoxX = prevSVGPoint.x - currentSVGPoint.x;
      const deltaViewBoxY = prevSVGPoint.y - currentSVGPoint.y;

      const [vx, vy, vw, vh] = viewBox.split(' ').map(parseFloat);
      updateViewBox(`${vx + deltaViewBoxX} ${vy + deltaViewBoxY} ${vw} ${vh}`);
      setLastScreenDragPoint({ x: touch.clientX, y: touch.clientY });
    } else if (e.touches.length === 2 && lastPinchDistance !== null) {
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (currentDistance === 0 || lastPinchDistance === 0) return;

      const scaleFactor = currentDistance / lastPinchDistance;
      const [vx, vy, vw, vh] = viewBox.split(' ').map(parseFloat);

      let newVw = vw / scaleFactor;
      let newVh = vh / scaleFactor;

      const minDim = Math.min(VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL) * 0.1;
      const maxDim = Math.min(VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL) * 10;

      if (newVw < minDim || newVw > maxDim || newVh < minDim || newVh > maxDim) {
        if (newVw < minDim) {
          newVh *= minDim / newVw;
          newVw = minDim;
        }
        if (newVh < minDim) {
          newVw *= minDim / newVh;
          newVh = minDim;
        }
        if (newVw > maxDim) {
          newVh *= maxDim / newVw;
          newVw = maxDim;
        }
        if (newVh > maxDim) {
          newVw *= maxDim / newVh;
          newVh = maxDim;
        }
      }

      const clientMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const clientMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const svgEl = svgRef.current;
      const svgPinchCenter = getSVGCoordinates(svgEl, clientMidX, clientMidY);

      const newVx = svgPinchCenter.x - (svgPinchCenter.x - vx) * (newVw / vw);
      const newVy = svgPinchCenter.y - (svgPinchCenter.y - vy) * (newVh / vh);

      updateViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
      setLastPinchDistance(currentDistance);
    }
  };

  /** Resets state on touch end. */
  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (svgRef.current) svgRef.current.style.cursor = 'grab';
    if (e.touches.length < 2) setLastPinchDistance(null);
    if (e.touches.length < 1) {
      setIsDragging(false);
      setLastScreenDragPoint(null);
    }
  };

  return {
    viewBox,
    svgRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};
