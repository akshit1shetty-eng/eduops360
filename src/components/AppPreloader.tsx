import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UpGradWordmark } from './UpGradLogo';

interface AppPreloaderProps {
  onComplete?: () => void;
}

const DURATION_MS = 1500;

/**
 * Launch screen: upGrad Word Mark, product name and a slim progress bar on a clean surface.
 * The logo itself is never animated or decorated (brand rule); only the surrounding UI moves.
 */
const AppPreloader: React.FC<AppPreloaderProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: 'easeInOut' } }}
          role="status"
          aria-live="polite"
          aria-label="Loading EduOps360"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="flex flex-col items-center"
          >
            {/* upGrad Word Mark — clear space below equals the logo height */}
            <UpGradWordmark color="red" className="h-10 w-auto block" />

            <div className="mt-10 h-px w-16 bg-slate-200" />

            <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-slate-900">
              EduOps<span className="text-brand-500">360</span>
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-500">Learner operations &amp; analytics</p>

            {/* Slim determinate progress bar tied to the launch duration */}
            <div className="mt-8 h-[3px] w-48 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="h-full rounded-full bg-brand-500"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: DURATION_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Preparing your workspace</p>
          </motion.div>

          <p className="absolute bottom-8 text-[11px] text-slate-400">© {new Date().getFullYear()} upGrad Education Private Limited</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppPreloader;
