import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import BottomNav from './BottomNav';
import AIChat from './AIChat';
import PageTransition from '../ui/PageTransition';

// Main application layout wrapper
const AppLayout: React.FC = () => {
    const [showScrollTop, setShowScrollTop] = useState(false);

    // Scroll-to-top display trigger - triggers as soon as scroll starts (>10px)
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 10) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-background font-sans text-on-background flex relative overflow-x-hidden">
            {/* Main Content Area */}
            <div className="flex-1 min-w-0 flex flex-col min-h-screen">
                {/* Content Container - No header, starts from top, padded for sidebar */}
                <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 pt-10 pb-28 md:px-8 md:pt-12 md:pb-12 relative z-10">
                    <PageTransition>
                        <Outlet />
                    </PageTransition>
                </main>
            </div>

            {/* Bottom Nav for Mobile & Desktop */}
            <BottomNav />

            {/* Neural AI Assistant */}
            <AIChat />

            {/* Scroll to Top Floating Button (positioned cleanly above AI button) */}
            <AnimatePresence>
                {showScrollTop && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 15 }}
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="fixed bottom-[92px] right-8 lg:right-10 z-40 w-10 h-10 rounded-full bg-on-surface text-surface hover:opacity-90 shadow-2xl flex items-center justify-center border border-outline/10 cursor-pointer active:scale-95 transition-all"
                        title="Scroll to Top"
                    >
                        <ArrowUp size={16} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AppLayout;
