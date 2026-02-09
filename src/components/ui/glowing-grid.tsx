"use client";

import { useEffect, useRef } from "react";

export const GlowingGrid = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const gridSize = 40;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { x: mouseX, y: mouseY } = mousePos.current;

      ctx.lineWidth = 1;

      // Draw mild neon spotlight
      const gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 600);
      gradient.addColorStop(0, "rgba(74, 222, 128, 0.06)"); // Inner color (very subtle neon green)
      gradient.addColorStop(0.5, "rgba(74, 222, 128, 0.02)"); // Middle
      gradient.addColorStop(1, "rgba(74, 222, 128, 0)"); // Outer transparent

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let x = -20; x <= canvas.width + 20; x += gridSize) {
        for (let y = -20; y <= canvas.height + 20; y += gridSize) {
          const dx = x - mouseX;
          const dy = y - mouseY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          let alpha = 0.05;
          let r = 1.0;

          if (distance < 400) {
            const intensity = 1 - distance / 400;
            alpha += intensity * 0.4;
            r += intensity * 1.5;

            // Draw subtle connecting lines if very close
            if (distance < 120) {
              ctx.beginPath();
              // Neon Green: 74, 222, 128
              ctx.strokeStyle = `rgba(74, 222, 128, ${
                0.15 * (1 - distance / 120)
              })`;
              ctx.moveTo(x, y);
              ctx.lineTo(mouseX, mouseY);
              ctx.stroke();
            }
          }

          // Dot Color - slightly muted neon green base
          ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameId.current)
        cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: -1, // Behind everything
      }}
      className="opacity-50" 
    />
  );
};
