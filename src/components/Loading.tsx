import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
  onComplete: () => void;
}

export const Loading: React.FC<LoadingProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500); // 2.5 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-persian-900 via-persian-800 to-persian-900 flex items-center justify-center overflow-hidden">
      {/* Background animated circles */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-persian-600/20 blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-persian-400/20 blur-2xl"
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1, 0.8, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
      </div>

      <div className="relative z-10 text-center">
        {/* Logo and spinning gradient circle */}
        <motion.div
          className="relative mb-8"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          {/* Rotating gradient ring */}
          <motion.div
            className="w-32 h-32 mx-auto rounded-full bg-gradient-to-r from-persian-400 via-persian-300 to-persian-500 p-1"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <div className="w-full h-full rounded-full bg-persian-900 flex items-center justify-center">
              {/* Inner logo/icon */}
              <motion.div
                className="w-16 h-16 rounded-full bg-gradient-to-br from-persian-300 to-persian-500 flex items-center justify-center"
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(14, 165, 233, 0.5)",
                    "0 0 40px rgba(14, 165, 233, 0.8)",
                    "0 0 20px rgba(14, 165, 233, 0.5)",
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* App title with animated entrance */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mb-6"
        >
          <h1 className="text-4xl font-bold text-white mb-2 font-vazir">
            <motion.span
              className="bg-gradient-to-r from-persian-300 via-white to-persian-300 bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ["0%", "100%", "0%"]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              Persian Legal AI
            </motion.span>
          </h1>
          <motion.p
            className="text-persian-200 text-lg font-light"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            Intelligent Document Management
          </motion.p>
        </motion.div>

        {/* Loading dots animation */}
        <motion.div
          className="flex justify-center space-x-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="w-3 h-3 bg-persian-400 rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: index * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.div>

        {/* Loading text */}
        <motion.p
          className="text-persian-300 text-sm mt-4 font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
        >
          Initializing your workspace...
        </motion.p>
      </div>

      {/* Bottom progress indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-64 h-1 bg-persian-800 rounded-full overflow-hidden"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 1.8 }}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-persian-400 to-persian-300 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 2.5, ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  );
};