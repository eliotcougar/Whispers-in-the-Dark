/**
 * @file useMapInteractions.ts
 * @description Hook providing pan and zoom handlers for the map display.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL } from '../utils/mapConstants';
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
  const viewBoxRef = useRef(initialViewBox);
  const rafId = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const updateViewBox = (box: string) => {
    setViewBox(box);
    if (onViewBoxChange) onViewBoxChange(box);
  };

  const flushViewBoxAttr = useCallback(() => {
    if (svgRef.current) svgRef.current.setAttribute('viewBox', viewBoxRef.current);
    rafId.current = null;
  }, []);

  const setViewBoxAttr = useCallback(
    (box: string) => {
      viewBoxRef.current = box;
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(flushViewBoxAttr);
      }
    },
    [flushViewBoxAttr]
  );

  const isDragging = useRef(false);
  const lastScreenDragPoint = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistance = useRef<number | null>(null);

  useEffect(() => {
    setViewBox(prev => (prev === initialViewBox ? prev : initialViewBox));
    setViewBoxAttr(initialViewBox);
  }, [initialViewBox, setViewBoxAttr]);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  /** Starts drag panning. */
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest('.map-node')) return;
    isDragging.current = true;
    lastScreenDragPoint.current = { x: e.clientX, y: e.clientY };
    if (svgRef.current) svgRef.current.style.cursor = 'grabbing';
  };

  /** Pans the map on mouse move. */
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging.current || !lastScreenDragPoint.current || !svgRef.current) return;

    const svgEl = svgRef.current;
    const prevSVGPoint = getSVGCoordinates(
      svgEl,
      lastScreenDragPoint.current.x,
      lastScreenDragPoint.current.y
    );
    const currentSVGPoint = getSVGCoordinates(svgEl, e.clientX, e.clientY);

    const deltaViewBoxX = prevSVGPoint.x - currentSVGPoint.x;
    const deltaViewBoxY = prevSVGPoint.y - currentSVGPoint.y;

    const [vx, vy, vw, vh] = viewBoxRef.current.split(' ').map(parseFloat);
    setViewBoxAttr(`${vx + deltaViewBoxX} ${vy + deltaViewBoxY} ${vw} ${vh}`);
    lastScreenDragPoint.current = { x: e.clientX, y: e.clientY };
  };

  /** Stops drag panning. */
  const handleMouseUp = () => {
    isDragging.current = false;
    lastScreenDragPoint.current = null;
    if (svgRef.current) svgRef.current.style.cursor = 'grab';
    updateViewBox(viewBoxRef.current);
  };

  /** Ends drag if the mouse leaves the SVG. */
  const handleMouseLeave = () => {
    if (isDragging.current) handleMouseUp();
  };

  /**
   * Zooms the viewBox with the mouse wheel. The event may be marked as
   * passive by the browser, so first check if it is cancelable before calling
   * `preventDefault` to avoid console warnings.
   */
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (e.cancelable) e.preventDefault();
    if (!svgRef.current) return;

    const [vx, vy, vw, vh] = viewBoxRef.current.split(' ').map(parseFloat);
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

    setViewBoxAttr(`${newVx} ${newVy} ${newVw} ${newVh}`);
    updateViewBox(viewBoxRef.current);
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
      isDragging.current = true;
      lastScreenDragPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPinchDistance.current = null;
      svgRef.current.style.cursor = 'grabbing';
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      lastPinchDistance.current = getTouchDistance(e.touches[0], e.touches[1]);
      lastScreenDragPoint.current = null;
    }
  };

  /** Handles touch movement for panning or pinch zooming. */
  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (e.cancelable) e.preventDefault();

    if (e.touches.length === 1 && isDragging.current && lastScreenDragPoint.current) {
      const touch = e.touches[0];
      const svgEl = svgRef.current;
      const prevSVGPoint = getSVGCoordinates(
        svgEl,
        lastScreenDragPoint.current.x,
        lastScreenDragPoint.current.y
      );
      const currentSVGPoint = getSVGCoordinates(
        svgEl,
        touch.clientX,
        touch.clientY
      );

      const deltaViewBoxX = prevSVGPoint.x - currentSVGPoint.x;
      const deltaViewBoxY = prevSVGPoint.y - currentSVGPoint.y;

      const [vx, vy, vw, vh] = viewBoxRef.current.split(' ').map(parseFloat);
      setViewBoxAttr(`${vx + deltaViewBoxX} ${vy + deltaViewBoxY} ${vw} ${vh}`);
      lastScreenDragPoint.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2 && lastPinchDistance.current !== null) {
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (currentDistance === 0 || lastPinchDistance.current === 0) return;

      const scaleFactor = currentDistance / lastPinchDistance.current;
      const [vx, vy, vw, vh] = viewBoxRef.current.split(' ').map(parseFloat);

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

      setViewBoxAttr(`${newVx} ${newVy} ${newVw} ${newVh}`);
      lastPinchDistance.current = currentDistance;
    }
  };

  /** Resets state on touch end. */
  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (svgRef.current) svgRef.current.style.cursor = 'grab';
    if (e.touches.length < 2) lastPinchDistance.current = null;
    if (e.touches.length < 1) {
      isDragging.current = false;
      lastScreenDragPoint.current = null;
      updateViewBox(viewBoxRef.current);
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

export default useMapInteractions;
