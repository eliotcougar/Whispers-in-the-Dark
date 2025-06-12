/**
 * @file useMapInteractions.ts
 * @description Hook providing pan and zoom handlers for the map display using CSS transforms.
 */

import { useState, useRef, useEffect } from 'react';
import type { MapTransform } from '../types';
import { DEFAULT_MAP_TRANSFORM } from '../utils/mapConstants';

export interface UseMapInteractionsResult {
  transform: MapTransform;
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
  initialTransform: MapTransform = DEFAULT_MAP_TRANSFORM,
  onTransformChange?: (t: MapTransform) => void
): UseMapInteractionsResult => {
  const [transform, setTransform] = useState<MapTransform>(initialTransform);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastScreenDragPoint, setLastScreenDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);

  useEffect(() => {
    setTransform(prev => (prev === initialTransform ? prev : initialTransform));
  }, [initialTransform]);

  const updateTransform = (t: MapTransform) => {
    setTransform(t);
    if (onTransformChange) onTransformChange(t);
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest('.map-node')) return;
    setIsDragging(true);
    setLastScreenDragPoint({ x: e.clientX, y: e.clientY });
    if (svgRef.current) svgRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !lastScreenDragPoint) return;
    const dx = e.clientX - lastScreenDragPoint.x;
    const dy = e.clientY - lastScreenDragPoint.y;
    updateTransform({
      translateX: transform.translateX + dx,
      translateY: transform.translateY + dy,
      scale: transform.scale,
    });
    setLastScreenDragPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setLastScreenDragPoint(null);
    if (svgRef.current) svgRef.current.style.cursor = 'grab';
  };

  const handleMouseLeave = () => {
    if (isDragging) handleMouseUp();
  };

  const applyScale = (newScale: number, centerX: number, centerY: number) => {
    const currentScale = transform.scale;
    const offsetX = centerX - transform.translateX;
    const offsetY = centerY - transform.translateY;
    const newTranslateX = centerX - (offsetX * newScale) / currentScale;
    const newTranslateY = centerY - (offsetY * newScale) / currentScale;
    updateTransform({ translateX: newTranslateX, translateY: newTranslateY, scale: newScale });
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (e.cancelable) e.preventDefault();
    if (!svgRef.current) return;
    const zoomFactor = 1.1;
    const newScale = e.deltaY < 0 ? transform.scale * zoomFactor : transform.scale / zoomFactor;
    const minScale = 0.1;
    const maxScale = 10;
    if (newScale < minScale || newScale > maxScale) return;
    const containerRect = svgRef.current.parentElement?.getBoundingClientRect();
    if (!containerRect) return;
    applyScale(newScale, e.clientX - containerRect.left, e.clientY - containerRect.top);
  };

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
  };

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

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (e.cancelable) e.preventDefault();
    if (e.touches.length === 1 && isDragging && lastScreenDragPoint) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastScreenDragPoint.x;
      const dy = touch.clientY - lastScreenDragPoint.y;
      updateTransform({
        translateX: transform.translateX + dx,
        translateY: transform.translateY + dy,
        scale: transform.scale,
      });
      setLastScreenDragPoint({ x: touch.clientX, y: touch.clientY });
    } else if (e.touches.length === 2 && lastPinchDistance !== null) {
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (currentDistance === 0 || lastPinchDistance === 0) return;
      const scaleFactor = currentDistance / lastPinchDistance;
      const newScale = transform.scale * scaleFactor;
      const minScale = 0.1;
      const maxScale = 10;
      const boundedScale = Math.min(Math.max(newScale, minScale), maxScale);
      const containerRect = svgRef.current.parentElement?.getBoundingClientRect();
      if (!containerRect) return;
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - containerRect.left;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - containerRect.top;
      applyScale(boundedScale, centerX, centerY);
      setLastPinchDistance(currentDistance);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (svgRef.current) svgRef.current.style.cursor = 'grab';
    if (e.touches.length < 2) setLastPinchDistance(null);
    if (e.touches.length < 1) {
      setIsDragging(false);
      setLastScreenDragPoint(null);
    }
  };

  return {
    transform,
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
