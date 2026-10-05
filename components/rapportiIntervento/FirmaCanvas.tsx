"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { PointerEvent } from "react";

type Props = {
  label: string;
  clearLabel: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  width?: number;
  height?: number;
};

const CANVAS_WIDTH_DEFAULT = 560;
const CANVAS_HEIGHT_DEFAULT = 180;
const LINE_WIDTH = 2.4;

function preparaCanvas(
  canvas: HTMLCanvasElement
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.lineWidth = LINE_WIDTH;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#24262b";
  context.fillStyle = "#fffdf9";

  return context;
}

function resetCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
) {
  const context = preparaCanvas(canvas);

  if (!context) {
    return;
  }

  context.clearRect(0, 0, width, height);
  context.fillRect(0, 0, width, height);
}

function getPoint({
  canvas,
  event,
  width,
  height,
}: {
  canvas: HTMLCanvasElement;
  event: PointerEvent<HTMLCanvasElement>;
  width: number;
  height: number;
}) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = width / rect.width;
  const scaleY = height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function FirmaCanvas({
  label,
  clearLabel,
  value,
  onChange,
  disabled = false,
  width = CANVAS_WIDTH_DEFAULT,
  height = CANVAS_HEIGHT_DEFAULT,
}: Props) {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{
    x: number;
    y: number;
  } | null>(null);
  const hasDrawnRef = useRef(false);
  const [drawing, setDrawing] =
    useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    resetCanvas(canvas, width, height);

    if (!value) {
      return;
    }

    const image = new Image();
    let annullato = false;

    image.onload = () => {
      if (annullato) {
        return;
      }

      const context = preparaCanvas(canvas);

      if (!context) {
        return;
      }

      context.drawImage(image, 0, 0, width, height);
    };

    image.src = value;

    return () => {
      annullato = true;
      image.onload = null;
    };
  }, [value, width, height]);

  const esportaFirma = () => {
    const canvas = canvasRef.current;

    if (!canvas || !hasDrawnRef.current) {
      return;
    }

    onChange(canvas.toDataURL("image/png"));
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLCanvasElement>
  ) => {
    if (disabled) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    const context = preparaCanvas(canvas);

    if (!context) {
      return;
    }

    const point = getPoint({
      canvas,
      event,
      width,
      height,
    });

    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.1, point.y + 0.1);
    context.stroke();

    lastPointRef.current = point;
    hasDrawnRef.current = true;
    setDrawing(true);
  };

  const handlePointerMove = (
    event: PointerEvent<HTMLCanvasElement>
  ) => {
    if (disabled || !drawing) {
      return;
    }

    const canvas = canvasRef.current;
    const lastPoint = lastPointRef.current;

    if (!canvas || !lastPoint) {
      return;
    }

    const context = preparaCanvas(canvas);

    if (!context) {
      return;
    }

    const point = getPoint({
      canvas,
      event,
      width,
      height,
    });

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    lastPointRef.current = point;
    hasDrawnRef.current = true;
  };

  const handlePointerEnd = () => {
    if (!drawing) {
      return;
    }

    setDrawing(false);
    lastPointRef.current = null;
    esportaFirma();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;

    if (canvas) {
      resetCanvas(canvas, width, height);
    }

    hasDrawnRef.current = false;
    lastPointRef.current = null;
    setDrawing(false);
    onChange(null);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-muted">
          {label}
        </span>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || !value}
          className="rounded-md border border-border bg-bg-card px-3 py-2 text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          {clearLabel}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        style={{ aspectRatio: `${width} / ${height}` }}
        className="w-full touch-none rounded-md border border-border bg-bg-card shadow-inner"
      />
    </div>
  );
}
