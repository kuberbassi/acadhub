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

    const formatTime = (log: SystemLog) => {
        try {
            const dateObj = typeof log.timestamp === 'string'
                ? new Date(log.timestamp)
                : new Date((log.timestamp as any)?.$date || log.timestamp);
            return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    if (loading) {
        return <div className="h-48 flex items-center justify-center"><Loader size={20} /></div>;
    }

    const dates = Object.keys(groupedLogs);

    return (
        <div className="space-y-6">
            {dates.length === 0 ? (
                <div className="border border-outline rounded-xl bg-surface p-12 flex flex-col items-center justify-center text-center">
                    <Clock size={28} className="text-on-surface-variant/20 mb-3" />
                    <h3 className="text-xs font-bold text-on-surface tracking-wide uppercase mb-1">System Logs</h3>
                    <p className="text-[11px] text-on-surface-variant/50 max-w-xs">No activity has been logged in your profile yet.</p>
                </div>
            ) : (
                dates.map((date) => (
                    <div key={date} className="border border-outline rounded-xl overflow-hidden bg-surface">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-outline bg-surface-container/50">
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-on-surface-variant/50" />
                                <span className="text-xs font-semibold text-on-surface">{date}</span>
                            </div>
                        </div>

                        <div className="divide-y divide-outline/30">
                            {groupedLogs[date].map((log, index) => (
                                <div key={index} className="flex gap-4 p-5 hover:bg-surface-container/10 transition-colors">
                                    <div className="w-9 h-9 rounded-lg bg-surface-container border border-outline/65 flex items-center justify-center shrink-0">
                                        {getLogIcon(log.action)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <h4 className="text-xs font-bold text-on-surface tracking-tight uppercase">{log.action}</h4>
                                            <span className="text-[10px] font-semibold text-on-surface-variant/40">
                                                {formatTime(log)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-on-surface-variant/60 font-medium leading-relaxed">{log.description}</p>
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

