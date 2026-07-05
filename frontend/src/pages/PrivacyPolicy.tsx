import React from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Eye, Database, Lock, Globe, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sections = [
    {
        icon: Eye,
        title: 'Introduction',
        content: 'Welcome to Semester ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience while using our application.'
    },
    {
        icon: Database,
        title: 'Information We Collect',
        content: 'We collect only the information necessary to provide our services:',
        list: [
            { label: 'Google Account Information', desc: 'When you sign in with Google, we collect your email address, name, and profile picture.' },
            { label: 'Profile Metadata', desc: 'We collect user-provided details like college, branch, and semester to enhance your profile.' },
        ]
    },
    {
        icon: Shield,
        title: 'How We Use Your Information',
        content: 'We use your information solely to:',
        list: [
            { label: 'Dashboard', desc: 'Provide and personalize the Semester dashboard and attendance tracking.' },
            { label: 'Profile Optimization', desc: 'Display your academic status and stats on your profile.' },
        ],
        note: 'We do not sell your personal data to third parties.'
    },
    {
        icon: Lock,
        title: 'Data Security',
        content: 'We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.'
    },
    {
        icon: Globe,
        title: 'Google User Data',
        content: 'Semester\'s use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.',
        link: { text: 'Google API Services User Data Policy', url: 'https://developers.google.com/terms/api-services-user-data-policy' }
    },
    {
        icon: Mail,
        title: 'Contact Us',
        content: 'If you have any questions about this Privacy Policy, please contact us at me@kuberbassi.com.'
    },
];

const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();

    usePageMeta({
        title: 'Privacy Policy | Semester',
        description: 'Read the Semester privacy policy to understand how we collect, use, and protect your data.',
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
                        <h1 className="text-sm font-bold text-on-surface">Privacy Policy</h1>
                        <p className="text-[10px] text-on-surface-variant/50 font-medium">Last updated: June 7, 2026</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-12">
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
                                            <div key={item.label} className="flex gap-3 items-start rounded-lg border border-outline bg-surface-variant/20 p-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/30 mt-2 flex-shrink-0" />
                                                <div>
                                                    <span className="text-xs font-bold text-on-surface-variant/90">{item.label}</span>
                                                    <span className="text-xs text-on-surface-variant/60 ml-1.5">— {item.desc}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                {section.note && (
                                    <div className="mt-4 rounded-lg bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04] border border-emerald-500/15 px-4 py-3 select-text">
                                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{section.note}</p>
                                    </div>
                                )}

                                {section.link && (
                                    <a href={section.link.url} target="_blank" rel="noreferrer" className="inline-block mt-4 text-xs font-semibold text-primary hover:underline transition-colors">
                                        {section.link.text} &rarr;
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;

