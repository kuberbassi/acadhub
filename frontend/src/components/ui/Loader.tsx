import React from 'react';
import { motion } from 'framer-motion';

export const Loader: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => {
    return (
        <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            {/* Outer soft breathing glow */}
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-lg animate-pulse" />
            
            {/* Sleek rotating ring */}
            <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            />
        </div>
    );
};

export default Loader;
