import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AppPreloaderProps {
  onComplete?: () => void;
}

const AppPreloader: React.FC<AppPreloaderProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Set to 1.5s - fast but enough time to see the polish
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            scale: 1.05,
            transition: { duration: 0.5, ease: "easeInOut" }
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center relative z-10"
          >
            {/* Unique Animated Logo with Ripple */}
            <div className="relative w-20 h-20 mb-8 flex items-center justify-center">
              {/* Ripple 1 */}
              <motion.div 
                className="absolute inset-0 border-2 border-indigo-400 rounded-full"
                animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
              />
              {/* Ripple 2 */}
              <motion.div 
                className="absolute inset-0 border-2 border-indigo-400 rounded-full"
                animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.75 }}
              />
              
              <motion.div 
                className="absolute inset-0 bg-indigo-600 shadow-xl shadow-indigo-300 dark:shadow-indigo-900/40"
                animate={{
                  borderRadius: ["30%", "50%", "30%"],
                  rotate: [0, 90, 180],
                }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              />
              <motion.i 
                className="fas fa-graduation-cap text-3xl text-white relative z-10"
                animate={{ 
                  scale: [0.9, 1.15, 0.9],
                }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              />
            </div>

            {/* Text */}
            <motion.h1 
              className="text-3xl font-black tracking-tight mb-5 text-slate-900 dark:text-white"
            >
              EDUOPS <span className="text-indigo-600">360</span>
            </motion.h1>

            {/* Premium Dots */}
            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                  animate={{ scale: [1, 1.8, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
          
          {/* Subtle Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppPreloader;
