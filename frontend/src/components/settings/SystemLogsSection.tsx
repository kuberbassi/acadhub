import React, { useEffect, useState } from 'react';
import { Activity, Clock, FileText, Settings as SettingsIcon, Trash2, User } from 'lucide-react';
import Loader from '@/components/ui/Loader';
import type { SystemLog } from '@/types';
import { attendanceService } from '@/services/attendance.service';

const SystemLogsSection: React.FC = () => {
    const [groupedLogs, setGroupedLogs] = useState<Record<string, SystemLog[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const data = await attendanceService.getSystemLogs();
            const grouped = data.reduce((acc: Record<string, SystemLog[]>, log) => {
                const date = typeof log.timestamp === 'string'
                    ? new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : new Date((log.timestamp as any).$date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                if (!acc[date]) acc[date] = [];
                acc[date].push(log);
                return acc;
            }, {});
            setGroupedLogs(grouped);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getLogIcon = (action: string) => {
        const value = action.toLowerCase();
        if (value.includes('profile')) return <User size={14} className="text-on-surface" />;
        if (value.includes('attendance') || value.includes('subject')) return <Activity size={14} className="text-on-surface" />;
        if (value.includes('delete') || value.includes('reset') || value.includes('wipe')) return <Trash2 size={14} className="text-red-500" />;
        if (value.includes('setting') || value.includes('preference')) return <SettingsIcon size={14} className="text-on-surface" />;
        return <FileText size={14} className="text-on-surface-variant/40" />;
    };

    if (loading) {
        return <div className="h-48 flex items-center justify-center"><Loader size={20} /></div>;
    }

    const dates = Object.keys(groupedLogs);

    return (
        <div className="space-y-6">
            {dates.length === 0 ? (
                <div className="rounded-xl border border-outline glass-panel p-12 flex flex-col items-center justify-center text-center">
                    <Clock size={32} className="text-on-surface-variant/20 mb-4" />
                    <h3 className="text-sm font-bold text-on-surface tracking-wide uppercase mb-1">System Logs</h3>
                    <p className="text-xs text-on-surface-variant/50 max-w-xs">No activity has been logged in your profile yet.</p>
                </div>
            ) : (
                dates.map((date) => (
                    <div key={date} className="space-y-3">
                        <div className="flex items-center gap-3 px-2">
                            <div className="h-px flex-1 bg-outline-variant" />
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/40">{date}</h3>
                            <div className="h-px flex-1 bg-outline-variant" />
                        </div>
                        <div className="rounded-xl border border-outline glass-panel overflow-hidden divide-y divide-outline-variant">
                            {groupedLogs[date].map((log, index) => (
                                <div key={index} className="flex gap-4 p-5 hover:bg-surface-container transition-colors group">
                                    <div className="w-10 h-10 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center shrink-0 group-hover:border-outline transition-all">
                                        {getLogIcon(log.action)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors uppercase tracking-tight">{log.action}</h4>
                                            <span className="text-[10px] font-semibold text-on-surface-variant/40">
                                                {typeof log.timestamp === 'string' ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs text-on-surface-variant/60 font-medium leading-relaxed">{log.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default SystemLogsSection;

