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
};

const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 180;
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
  canvas: HTMLCanvasElement
) {
  const context = preparaCanvas(canvas);

  if (!context) {
    return;
  }

  context.clearRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  );
  context.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  );
}

function getPoint({
  canvas,
  event,
}: {
  canvas: HTMLCanvasElement;
  event: PointerEvent<HTMLCanvasElement>;
}) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;

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

    resetCanvas(canvas);

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

      context.drawImage(
        image,
        0,
        0,
        CANVAS_WIDTH,
        CANVAS_HEIGHT
      );
    };

    image.src = value;

    return () => {
      annullato = true;
      image.onload = null;
    };
  }, [value]);

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
      resetCanvas(canvas);
    }

    hasDrawnRef.current = false;
    lastPointRef.current = null;
    setDrawing(false);
    onChange(null);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-industrial-muted">
          {label}
        </span>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || !value}
          className="rounded-xl border border-industrial-border bg-industrial-control px-3 py-2 text-xs font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange disabled:cursor-not-allowed disabled:text-industrial-muted-strong"
        >
          {clearLabel}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        className="h-[180px] w-full touch-none rounded-xl border border-industrial-border bg-industrial-surface shadow-inner"
      />
    </div>
  );
}
