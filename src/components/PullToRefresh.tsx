'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowDown, Check, RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 65;
const MAX_PULL = 90;

export function PullToRefresh({
  onRefresh,
  isRefreshing,
  children,
  disabled = false,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasRefreshingRef = useRef(isRefreshing);

  // Detect when refresh finishes to show a quick success checkmark
  useEffect(() => {
    if (wasRefreshingRef.current && !isRefreshing) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
    wasRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (window.scrollY <= 2) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || disabled || isRefreshing) return;
    if (window.scrollY > 2) {
      isDraggingRef.current = false;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      // Damped pull distance
      const distance = Math.min(MAX_PULL, Math.pow(diff, 0.85) * 1.6);
      setPullDistance(distance);
      setIsPulling(true);
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      onRefresh();
    }
    setPullDistance(0);
  };

  // Mouse drag support for desktop/testing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || isRefreshing) return;
    if (window.scrollY <= 2) {
      startYRef.current = e.clientY;
      isDraggingRef.current = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || disabled || isRefreshing) return;
    if (window.scrollY > 2) {
      isDraggingRef.current = false;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    const diff = e.clientY - startYRef.current;
    if (diff > 0) {
      const distance = Math.min(MAX_PULL, Math.pow(diff, 0.85) * 1.6);
      setPullDistance(distance);
      setIsPulling(true);
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      onRefresh();
    }
    setPullDistance(0);
  };

  const isThresholdReached = pullDistance >= PULL_THRESHOLD;
  const activeHeight = isRefreshing ? 56 : showSuccess ? 48 : pullDistance;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative select-none touch-pan-y"
    >
      {/* Pull-To-Refresh Indicator (Instagram style) */}
      <div
        className="fixed top-14 sm:top-16 left-0 right-0 z-40 flex justify-center pointer-events-none transition-all duration-200"
        style={{
          transform: `translateY(${Math.max(0, activeHeight - 20)}px)`,
          opacity: isPulling || isRefreshing || showSuccess ? 1 : 0,
        }}
      >
        <div
          className={`flex items-center space-x-2 px-4 py-2 rounded-full shadow-xl border backdrop-blur-md transition-all ${
            showSuccess
              ? 'bg-emerald-500/95 text-white border-emerald-400 shadow-emerald-500/20'
              : isRefreshing
              ? 'bg-slate-900/90 text-white border-blue-500/40 shadow-blue-500/20'
              : isThresholdReached
              ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30 scale-105'
              : 'bg-white/95 text-slate-700 border-slate-200 shadow-slate-400/20'
          }`}
        >
          {showSuccess ? (
            <>
              <Check className="w-4 h-4 text-white stroke-[3]" />
              <span className="text-xs font-semibold">Atualizado!</span>
            </>
          ) : isRefreshing ? (
            <>
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-xs font-semibold">Sincronizando dados...</span>
            </>
          ) : (
            <>
              <div
                className="transition-transform duration-100"
                style={{
                  transform: `rotate(${Math.min(180, (pullDistance / PULL_THRESHOLD) * 180)}deg)`,
                }}
              >
                <ArrowDown
                  className={`w-4 h-4 ${
                    isThresholdReached ? 'text-white' : 'text-blue-600'
                  }`}
                />
              </div>
              <span className="text-xs font-medium">
                {isThresholdReached ? 'Solte para sincronizar' : 'Puxe para sincronizar'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content wrapper with gentle transform when pulling */}
      <div
        style={{
          transform: isPulling ? `translateY(${pullDistance * 0.4}px)` : 'none',
          transition: isPulling ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
