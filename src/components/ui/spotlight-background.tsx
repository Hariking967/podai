"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export function SpotlightBackground() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handleClick = (event: MouseEvent) => {
        const newRipple = { x: event.clientX, y: event.clientY, id: Date.now() };
        setRipples((prev) => [...prev, newRipple]);
        setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
        }, 1000); // Remove ripple after animation
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <div 
        ref={containerRef}
        className="fixed inset-0 z-[-1] overflow-hidden bg-neutral-950"
    >
      {/* Horizontal & Vertical Lines Grid - Neon City Style */}
      <div 
        className="absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(circle at center, black 40%, transparent 100%)" // Fade out at edges slightly
        }}
      />
      {/* Floating View Perspective Grid (Optional enhancement) */}
       <div 
        className="absolute inset-0 opacity-[0.1] pointer-events-none"
        style={{
            background: "linear-gradient(rgb(74 222 128 / 0.1) 1px, transparent 1px)",
            backgroundSize: "100% 120px",
            transform: "perspective(500px) rotateX(60deg) translateY(-100px) scale(2)",
            transformOrigin: "top"
        }}
      />


      {/* Spotlight Effect */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(
              600px circle at ${mousePosition.x}px ${mousePosition.y}px,
              rgba(74, 222, 128, 0.1),
              transparent 40%
            )
          `,
        }}
      />
      
      {/* Ripples */}
      {ripples.map((ripple) => (
        <motion.div
            key={ripple.id}
            initial={{ width: 0, height: 0, opacity: 0.8 }}
            animate={{ width: 600, height: 600, opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute rounded-full border border-neon-green/50 bg-neon-green/10 shadow-[0_0_20px_rgba(74,222,128,0.3)] pointer-events-none"
            style={{
                left: ripple.x,
                top: ripple.y,
                transform: "translate(-50%, -50%)"
            }}
        />
      ))}
      
       {/* Ambient Glows */}
       <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-neon-green/5 rounded-full blur-[128px] opacity-20 pointer-events-none" />
       <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-neon-green/5 rounded-full blur-[128px] opacity-20 pointer-events-none" />
    </div>
  );
}
