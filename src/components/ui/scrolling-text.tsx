"use client";

import { motion } from "framer-motion";

export const ScrollingText = () => {
  const words = [
    "AI Database Control",
    "Natural Language SQL",
    "Visual Data Insights",
    "Safe Execution",
    "Python Data Lab",
    "Automated Workflows"
  ];

  return (
    <div className="w-full overflow-hidden bg-black/50 border-y border-neon-green/20 py-4 backdrop-blur-sm relative z-20">
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: [0, -1000] }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: 20,
        }}
      >
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex items-center">
            {words.map((word, index) => (
              <div key={index} className="flex items-center">
                <span className="text-neon-green text-sm md:text-base font-bold tracking-widest uppercase mx-8 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]">
                  {word}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
              </div>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
};
