import React from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, AlertTriangle, UserCheck, XCircle, RefreshCw, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sections = [
    {
        icon: FileText,
        title: 'Acceptance of Terms',
        content: 'By accessing and using Semester, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use this application.'
    },
    {
        icon: UserCheck,
        title: 'Description of Service',
        content: 'Semester provides an academic management dashboard that integrates with your Google account to track attendance, assignments, and schedules. You understand and agree that the Service is provided "AS-IS" and we make no warranties regarding its availability, accuracy, or reliability.'
    },
    {
        icon: AlertTriangle,
        title: 'User Conduct',
        content: 'You agree to use the Service only for lawful purposes. You are responsible for all activities that occur under your account.',
        list: [
            'Do not attempt to gain unauthorized access to our systems.',
            'Do not use the service to distribute malicious software.',
            'Do not harass, abuse, or harm other users.',
            'Do not use automated scripts to access the service.',
        ]
    },
    {
        icon: XCircle,
        title: 'Termination',
        content: 'We reserve the right to terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.'
    },
    {
        icon: RefreshCw,
        title: 'Changes to Terms',
        content: 'We reserve the right, at our sole discretion, to modify or replace these Terms at any time. Continued use of the Service after changes constitutes acceptance of the modified terms.'
    },
    {
        icon: Mail,
        title: 'Contact Us',
        content: 'If you have any questions about these Terms, please contact us at me@kuberbassi.com.'
    },
];

const TermsOfService: React.FC = () => {
    const navigate = useNavigate();

    usePageMeta({
        title: 'Terms of Service | Semester',
        description: 'Read the Semester terms of service. Understand your rights and responsibilities as a user.',
        indexable: false,
    });

    return (
        <div className="min-h-screen bg-background text-on-background selection:bg-primary-container selection:text-primary font-sans">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-outline">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="w-9 h-9 rounded-lg border border-outline bg-surface text-on-surface flex items-center justify-center hover:bg-surface-container transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                        title="Go back"
                    >
                        <ArrowLeft size={15} />
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-on-surface">Terms of Service</h1>
                        <p className="text-[10px] text-on-surface-variant/50 font-medium">Last updated: June 7, 2026</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sections.map((section, i) => (
                        <motion.div
                            key={section.title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.4 }}
                            className="rounded-xl bg-surface border border-outline p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] flex flex-col justify-between select-none"
                        >
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 rounded-lg border border-outline bg-surface-variant flex items-center justify-center">
                                        <section.icon size={15} className="text-on-surface-variant" />
                                    </div>
                                    <h2 className="text-sm font-bold text-on-surface">{i + 1}. {section.title}</h2>
                                </div>

                                <p className="text-xs text-on-surface-variant/80 leading-relaxed select-text font-medium">{section.content}</p>

                                {section.list && (
                                    <div className="mt-4 space-y-2 select-text">
                                        {section.list.map((item) => (
                                            <div key={item} className="flex gap-3 items-center rounded-lg border border-outline bg-surface-variant/20 p-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/30 flex-shrink-0" />
                                                <span className="text-xs text-on-surface-variant/75 font-medium">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Disclaimer */}
                <div className="rounded-xl bg-amber-500/[0.02] dark:bg-amber-500/[0.04] border border-amber-500/15 p-6 text-center select-none">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 leading-relaxed">
                        By using Semester, you acknowledge that you have read, understood, and agree to these Terms of Service.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;

