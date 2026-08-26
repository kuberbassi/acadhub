import React, { useState, useEffect, useRef } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useDashboard, useMarkAttendance, useDeleteSubject } from '@/hooks/useDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Edit2, Check, X,
    Activity, Target, Flame, ChevronRight, ChevronsUpDown, Settings as SettingsIcon
} from 'lucide-react';
import AddSubjectModal from '@/components/modals/AddSubjectModal';
import EditSubjectModal from '@/components/modals/EditSubjectModal';
import AttendanceModal from '@/components/modals/AttendanceModal';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import useLongPress from '@/hooks/useLongPress';
import { useSemester } from '@/contexts/SemesterContext';
import { Link } from 'react-router-dom';
import { formatTeacherName } from '@/utils/formatters';
import { useConfirm } from '@/contexts/ConfirmContext';

/* ── Helpers for Timetable slot subject mapping ── */
const normalizeId = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());

const findSubjectForSlot = (subjects: any[], slot: any) => {
    const explicitType = String(slot?.type || '').trim().toLowerCase();
    
    if (['break', 'lunch', 'gap', 'free', 'custom'].includes(explicitType)) return undefined;

    const slotSubjectId = normalizeId(slot?.subject_id || slot?.subjectId || slot?.subject?._id || slot?.subject?.id);
    if (slotSubjectId) {
        const matchedById = subjects.find((sub: any) => normalizeId(sub._id || sub.id) === slotSubjectId);
        if (matchedById) return matchedById;
    }

    const subjectField = slot?.subject;
    if (typeof subjectField === 'string' && subjectField.trim()) {
        const needle = subjectField.trim().toLowerCase();
        const matchedByName = subjects.find((sub: any) => String(sub?.name || '').trim().toLowerCase() === needle);
        if (matchedByName) return matchedByName;
    }

    if (subjectField && typeof subjectField === 'object') {
        const subObj = subjectField as Record<string, unknown>;
        const objId = normalizeId(subObj._id || subObj.id);
        if (objId) {
            const matchedByObjId = subjects.find((sub: any) => normalizeId(sub._id || sub.id) === objId);
            if (matchedByObjId) return matchedByObjId;
        }
        const objName = String(subObj.name || '').trim().toLowerCase();
        if (objName) {
            const matchedByObjName = subjects.find((sub: any) => String(sub?.name || '').trim().toLowerCase() === objName);
            if (matchedByObjName) return matchedByObjName;
        }
    }

    const slotLabel = String(
        slot?.label
        || slot?.subject_name
        || slot?.subjectName
        || slot?.name
        || slot?.subject?.name
        || slot?.subject?.code
        || ''
    ).trim().toLowerCase();
    if (!slotLabel || slotLabel === 'break' || slotLabel === 'lunch' || slotLabel === 'gap') return undefined;

    return subjects.find((sub: any) => {
        const subName = String(sub?.name || '').trim().toLowerCase();
        const subCode = String(sub?.code || '').trim().toLowerCase();
        
        if (subName === slotLabel || subCode === slotLabel) return true;
        
        const acronym = subName.split(/\s+/).map(w => w[0]).join('');
        if (acronym === slotLabel) return true;
        
        if (subName.includes(slotLabel)) return true;
        if (subCode && (subCode.includes(slotLabel) || slotLabel.includes(subCode))) return true;

        return false;
    });
};

const SubjectRow: React.FC<{
    subject: any;
    targetThreshold: number;
    classesNeeded: (attended: number, total: number) => number;
    classesCanSkip: (attended: number, total: number) => number;
    triggerBubbleMenu: (subjectId: string, e: any) => void;
    setEditingSubject: (subject: any) => void;
    handleDeleteSubject: (subjectId: string, subjectName: string) => void;
}> = ({
    subject,
    targetThreshold,
    classesNeeded,
    classesCanSkip,
    triggerBubbleMenu,
    setEditingSubject,
    handleDeleteSubject,
}) => {
    const pct = subject.attendance_percentage || 0;
    const isCritical = pct < targetThreshold;
    const needed = classesNeeded(subject.attended || 0, subject.total || 0);
    const canSkip = classesCanSkip(subject.attended || 0, subject.total || 0);
    const longPressHandlers = useLongPress((e) => triggerBubbleMenu(subject._id, e), {
        threshold: 600,
        onCancel: () => {}
    });

    return (
        <tr
            {...longPressHandlers}
            className="hover:bg-surface-container/20 transition-colors group cursor-default border-b border-outline/10 last:border-b-0"
        >
            <td className="px-6 py-3.5 font-mono text-xs font-semibold text-on-surface-variant/40">{subject.code || 'COURSE'}</td>
            <td className="px-6 py-3.5 font-bold text-on-surface">
                <div>
                    <p className="truncate max-w-[200px] leading-tight text-xs">{subject.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[8px] font-semibold text-on-surface-variant/40 uppercase tracking-widest">
                            {(subject.categories?.includes('Practical') || subject.type?.toLowerCase() === 'practical' || subject.type?.toLowerCase() === 'lab' || subject.name?.toLowerCase().includes('lab')) ? 'Practical' : 'Theory'}
                        </span>
                        {subject.credits !== null && subject.credits !== undefined && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-on-surface-variant/20" />
                                <span className="text-[8px] font-bold text-primary/70 uppercase tracking-widest">{subject.credits} Credits</span>
                            </>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-6 py-3.5 text-on-surface-variant/50 font-medium text-xs">
                <p className="truncate max-w-[150px] leading-tight">{formatTeacherName(subject.professor)}</p>
            </td>
            <td className="px-6 py-3.5 text-center font-semibold text-on-surface text-xs">{subject.attended || 0} / {subject.total || 0}</td>
            <td className="px-6 py-3.5 text-center">
                <div className="flex flex-col items-center gap-1">
                    <span className={`font-bold text-xs ${isCritical ? 'text-red-500' : 'text-on-surface'}`}>{Math.round(pct)}%</span>
                    <div className="w-12 h-0.5 bg-on-surface/5 rounded-full overflow-hidden shrink-0">
                        <div className={`h-full ${isCritical ? 'bg-red-500' : 'bg-on-surface'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                </div>
            </td>
            <td className="px-6 py-3.5 text-center whitespace-nowrap">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap tracking-wide ${
                    isCritical 
                        ? 'bg-red-500/5 border-red-500/10 text-red-500' 
                        : 'bg-primary/5 border-outline/30 text-on-surface-variant/80'
                }`}>
                    {isCritical ? `Need ${needed} cls` : `${canSkip} Bunks`}
                </span>
            </td>

            <td className="px-6 py-3.5 text-right">
                <div className="flex justify-end gap-1.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                        onClick={() => setEditingSubject(subject)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-transparent text-on-surface-variant/60 hover:border-outline/60 hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all cursor-pointer"
                        title={`Edit ${subject.name}`}
                        aria-label={`Edit ${subject.name}`}
                    >
                        <Edit2 size={14} strokeWidth={1.8} />
                    </button>
                    <button
                        onClick={() => handleDeleteSubject(subject._id, subject.name)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-transparent text-on-surface-variant/60 hover:border-red-500/20 hover:bg-red-500/5 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 transition-all cursor-pointer"
                        title={`Delete ${subject.name}`}
                        aria-label={`Delete ${subject.name}`}
                    >
                        <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

const Dashboard: React.FC = () => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const { currentSemester, setCurrentSemester } = useSemester();
    const { data: dashboardData, isLoading, refetch: loadDashboard } = useDashboard();
    const [semDropOpen, setSemDropOpen] = useState(false);
    const semRef = useRef<HTMLDivElement>(null);

    // Close mobile semester dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (semRef.current && !semRef.current.contains(e.target as Node)) {
                setSemDropOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const markAttendanceMutation = useMarkAttendance();
    const deleteSubjectMutation = useDeleteSubject();

    usePageMeta({
        title: 'Dashboard | Semester',
        description: 'Your academic overview — attendance, upcoming classes, and performance at a glance.',
    });

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<any | null>(null);
    const [markingSubjectId, setMarkingSubjectId] = useState<string | null>(null);
    const [bubbleMenu, setBubbleMenu] = useState<{
        subjectId: string;
        x: number;
        y: number;
    } | null>(null);

    const [todayClasses, setTodayClasses] = useState<any[]>([]);
    const confirm = useConfirm();

    const [categoryFilter, setCategoryFilter] = useState<'Theory' | 'Practical' | 'All'>(() => {
        const saved = localStorage.getItem('semester_dashboard_subject_filter');
        return (saved === 'Theory' || saved === 'Practical' || saved === 'All') ? saved : 'All';
    });
    const targetThreshold = user?.attendance_threshold || 75;

    useEffect(() => {
        const fetchTimetable = async () => {
            try {
                const data = await attendanceService.getTimetable(currentSemester);
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const currentDay = dayNames[new Date().getDay()];
                const daySlots = data?.schedule?.[currentDay] || [];
                
                const parseTimeForSort = (time12h: string) => {
                    if (!time12h) return 0;
                    try {
                        const parts = time12h.split(' ');
                        const time = parts[0];
                        const modifier = parts[1] || '';
                        let [hours, minutes] = time.split(':');
                        let h = parseInt(hours, 10);
                        if (modifier) {
                            if (h === 12) h = 0;
                            if (modifier.toLowerCase() === 'pm') h += 12;
                        }
                        return h * 60 + parseInt(minutes, 10);
                    } catch { return 0; }
                };

                const sortedSlots = [...daySlots].sort((a: any, b: any) => {
                    const getSlotStartTime = (slot: any) => String(slot?.start_time || slot?.startTime || '').trim();
                    return parseTimeForSort(getSlotStartTime(a)) - parseTimeForSort(getSlotStartTime(b));
                });
                setTodayClasses(sortedSlots);
            } catch (err) {
                console.error("Failed to load timetable for dashboard", err);
            }
        };

        if (user) {
            void fetchTimetable();
        }
    }, [currentSemester, user]);

    const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
        const isConfirmed = await confirm({
            title: 'Delete Subject',
            message: `Are you sure you want to delete "${subjectName}"? This will permanently remove all its classes and attendance records.`,
        });
        if (!isConfirmed) return;
        try {
            await deleteSubjectMutation.mutateAsync(subjectId);
            showToast('success', `Deleted ${subjectName}`);
        } catch {
            showToast('error', 'Failed to delete subject');
        }
    };

    const handleQuickMark = async (subjectId: string, status: 'present' | 'absent') => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(15);
        }
        try {
            await markAttendanceMutation.mutateAsync({ subjectId, status });
            showToast('success', `Marked ${status}`);
        } catch {
            showToast('error', 'Failed to mark attendance');
        }
    };

    const classesNeeded = (attended: number, total: number) => {
        if (total === 0) return 0;
        if ((attended / total) * 100 >= targetThreshold) return 0;
        return Math.ceil((targetThreshold * total - attended * 100) / (100 - targetThreshold));
    };

    const classesCanSkip = (attended: number, total: number) => {
        if (total === 0) return 0;
        return Math.max(0, Math.floor((attended * 100 - targetThreshold * total) / targetThreshold));
    };

    const att = dashboardData?.overall_attendance || 0;
    const attendanceWithoutMedical = dashboardData?.attendance_without_medical ?? att;
    const medicalLeaveCount = dashboardData?.medical_leave_count ?? 0;
    const subjects = dashboardData?.subjects || [];
    const totalClasses = subjects.reduce((a, c) => a + (c.total || 0), 0) || 0;
    const safeCount = subjects.filter(s => (s.attendance_percentage || 0) >= targetThreshold).length || 0;
    const riskCount = subjects.filter(s => (s.attendance_percentage || 0) < targetThreshold).length || 0;
    const subjectCount = dashboardData?.total_subjects || subjects.length || 0;
    const totalAttended = subjects.reduce((sum, subject) => sum + (subject.attended || 0), 0);
    const safeBunks = dashboardData?.summary?.safe_bunks_remaining ?? 0;

    const sortSubs = (subs: any[]) => {
        if (!subs) return [];
        return [...subs].sort((a, b) => {
            const p = (s: any) => { const c = s.categories || []; return c.includes('Theory') ? 0 : c.includes('Lab') ? 1 : 2; };
            return p(a) - p(b);
        });
    };

    // Bubble menu trigger
    const triggerBubbleMenu = (subjectId: string, e: any) => {
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        
        const menuWidth = 160;
        const menuHeight = 145;
        const boundedX = Math.max(12, Math.min(clientX, window.innerWidth - menuWidth - 12));
        const boundedY = Math.max(12, Math.min(clientY, window.innerHeight - menuHeight - 12));

        setBubbleMenu({
            subjectId,
            x: boundedX,
            y: boundedY
        });
    };

    return (
        <div className="pb-24 w-full select-none">
            {/* Header Section */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">
                        System / Overview
                    </p>
                    <h1 className="text-2xl font-bold text-on-surface tracking-tight">Dashboard</h1>
                    <p className="text-xs text-on-surface-variant/40 mt-0.5">
                        Manage and track subject attendance.
                    </p>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                    {/* Semester Selector */}
                    <div ref={semRef} className="relative z-20">
                        <button
                            onClick={() => setSemDropOpen(!semDropOpen)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline bg-surface hover:bg-surface-container-high transition-colors text-xs font-semibold text-on-surface-variant hover:text-on-surface whitespace-nowrap cursor-pointer"
                        >
                            Sem {currentSemester}
                            <ChevronsUpDown size={14} aria-hidden="true" />
                        </button>
                        <AnimatePresence>
                            {semDropOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.1 }}
                                    className="absolute left-0 top-full mt-2 w-32 bg-surface border border-outline rounded-lg p-1 shadow-lg z-50 text-on-surface"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setCurrentSemester(s); setSemDropOpen(false); }}
                                            className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer flex justify-between items-center ${s === currentSemester
                                                ? 'bg-on-surface text-surface font-bold'
                                                : 'text-on-surface-variant hover:bg-surface-container'
                                                }`}
                                        >
                                            <span>Sem {s}</span>
                                            {s === currentSemester && <Check size={10} aria-hidden="true" />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-on-surface text-surface text-xs font-bold transition-all hover:bg-on-surface/90 cursor-pointer"
                    >
                        <Plus size={14} /> Add Subject
                    </button>
                </div>
            </div>

            {isLoading && !dashboardData ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="animate-pulse h-48 bg-surface-container border border-outline rounded-lg md:col-span-2" />
                        <div className="animate-pulse h-48 bg-surface-container border border-outline rounded-lg" />
                    </div>
                    <div className="animate-pulse h-64 bg-surface-container border border-outline rounded-lg" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Bento Card 1: Academic Health */}
                        <div className="rounded-xl border border-outline/50 bg-surface p-5 sm:p-6 flex flex-col justify-between hover:border-on-surface/20 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Overall Academic Health</span>
                                <Activity size={13} className="text-on-surface-variant/40" />
                            </div>
                            
                            <div className="flex flex-col justify-between gap-6 my-2">
                                <div>
                                    <p className="text-5xl md:text-6xl font-black tracking-tighter text-on-surface leading-none">{att.toFixed(1)}%</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/40 mt-3">Overall Conducted Classes</p>
                                    <div className="mt-3 inline-flex items-baseline gap-1.5 rounded-md border border-outline/50 bg-surface-container/50 px-2 py-1">
                                        <span className="text-xs font-black text-on-surface">{attendanceWithoutMedical.toFixed(1)}%</span>
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant/50">
                                            Medical as absent{medicalLeaveCount > 0 ? ` · ${medicalLeaveCount}` : ''}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="w-full space-y-4">
                                    <div>
                                        <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-2">
                                            <span>Conduct Progress</span>
                                            <span>{totalAttended} / {totalClasses} classes</span>
                                        </div>
                                        <div className="w-full h-1 bg-on-surface/5 border border-outline/35 rounded-full overflow-hidden">
                                            <div className="h-full bg-on-surface" style={{ width: `${Math.min(100, totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0)}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 border-t border-outline/40 pt-4 mt-8">
                                <div className="text-left">
                                    <span className="block text-[8px] font-bold text-on-surface-variant/45 uppercase tracking-wider">Deficit Risk</span>
                                    <span className={`text-sm md:text-base font-bold ${riskCount > 0 ? 'text-red-500' : 'text-on-surface'}`}>{riskCount} {riskCount === 1 ? 'Subject' : 'Subjects'}</span>
                                </div>
                                <div className="text-left">
                                    <span className="block text-[8px] font-bold text-on-surface-variant/45 uppercase tracking-wider">Safe Bunks</span>
                                    <span className="text-sm md:text-base font-bold text-on-surface">{safeBunks} Left</span>
                                </div>
                                <div className="text-left">
                                    <span className="block text-[8px] font-bold text-on-surface-variant/45 uppercase tracking-wider">Total Tracked</span>
                                    <span className="text-sm md:text-base font-bold text-on-surface">{safeCount}/{subjectCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Bento Card 2: Student Target */}
                        <div className="rounded-xl border border-outline/50 bg-surface p-5 sm:p-6 flex flex-col justify-between hover:border-on-surface/20 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Academic Target</span>
                                    <Target size={13} className="text-on-surface-variant/40" />
                                </div>
                                
                                <div className="space-y-4 my-2">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40">Student Name</p>
                                        <p className="text-sm font-bold text-on-surface">{user?.name || 'Student'}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40 font-mono">Enrollment</p>
                                            <p className="text-xs font-semibold text-on-surface truncate font-mono">{user?.enrollment_number || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40">Batch</p>
                                            <p className="text-xs font-semibold text-on-surface truncate">{user?.batch || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40">Target Goal</p>
                                            <p className="text-xs font-semibold text-on-surface">{targetThreshold}% Minimum</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40">Current Semester</p>
                                            <p className="text-xs font-semibold text-on-surface">Semester {currentSemester}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-outline/40 pt-4 mt-6">
                                <Link
                                    to="/settings"
                                    className="w-full h-10 flex items-center justify-center gap-2 border border-outline hover:border-on-surface/20 hover:bg-surface-container rounded-md text-xs font-semibold text-on-surface transition-all cursor-pointer shadow-sm"
                                >
                                    <SettingsIcon size={12} />
                                    Configure Settings
                                </Link>
                            </div>
                        </div>

                        {/* Bento Card 3: Today's Schedule */}
                        <div className="rounded-xl border border-outline/50 bg-surface p-5 sm:p-6 flex flex-col justify-between hover:border-on-surface/20 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Today's Schedule</span>
                                    <Flame size={13} className="text-on-surface-variant/40" />
                                </div>
                                
                                <div className="space-y-3 my-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                                    {todayClasses.length > 0 ? (
                                        todayClasses.map((cls, idx) => {
                                            const sub = findSubjectForSlot(subjects, cls);
                                            return (
                                                <div key={idx} className="flex items-center gap-3 py-1.5 border-b border-outline/30 last:border-b-0">
                                                    <div className="text-center bg-surface-container border border-outline/40 rounded-md px-2 py-0.5 shrink-0 min-w-[55px]">
                                                        <span className="block text-[8px] font-bold text-on-surface-variant/50 leading-none">{cls.start_time || cls.startTime || '—'}</span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-on-surface truncate leading-tight">{sub?.name || cls.subject_name || cls.subjectName || cls.label || cls.name || 'Break'}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-8 text-center">
                                            <p className="text-xs font-semibold text-on-surface-variant/30 italic">No classes today. Enjoy your day!</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-outline/40 pt-4 mt-6 shrink-0">
                                <Link
                                    to="/timetable"
                                    className="w-full h-10 flex items-center justify-center gap-1 border border-outline hover:border-on-surface/20 hover:bg-surface-container rounded-md text-xs font-semibold text-on-surface transition-all cursor-pointer shadow-sm"
                                >
                                    View Full Timetable
                                    <ChevronRight size={12} />
                                </Link>
                            </div>
                        </div>


                        {/* Bento Card 5: Courses Breakdown */}
                        <div className="rounded-xl border border-outline/50 bg-surface overflow-hidden md:col-span-3 hover:border-on-surface/20 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.01)] mt-2">
                            <div className="px-6 py-5 border-b border-outline/30 bg-surface-container/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Courses Breakdown</span>
                                {/* Category filter tabs */}
                                <div className="flex items-center gap-1 p-0.5 bg-surface border border-outline/50 rounded-md self-start sm:self-auto">
                                    {(['Theory', 'Practical', 'All'] as const).map(cat => {
                                        const count = cat === 'All'
                                            ? subjects.length
                                            : subjects.filter((s: any) => {
                                                const isPractical = s.categories?.includes('Practical') || 
                                                                    s.type?.toLowerCase() === 'practical' || 
                                                                    s.type?.toLowerCase() === 'lab' || 
                                                                    s.name?.toLowerCase().includes('lab');
                                                return cat === 'Theory' ? !isPractical : isPractical;
                                            }).length;
                                        return (
                                            <button
                                                key={cat}
                                                onClick={() => {
                                                    setCategoryFilter(cat);
                                                    localStorage.setItem('semester_dashboard_subject_filter', cat);
                                                }}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                                    categoryFilter === cat
                                                        ? 'bg-on-surface text-surface'
                                                        : 'text-on-surface-variant/50 hover:text-on-surface'
                                                }`}
                                            >
                                                {cat}
                                                <span className={`text-[8px] ${categoryFilter === cat ? 'opacity-60' : 'opacity-40'}`}>{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {(() => {
                                const filteredSubjects = categoryFilter === 'All'
                                    ? subjects
                                    : subjects.filter((s: any) => {
                                        const isPractical = s.categories?.includes('Practical') || 
                                                            s.type?.toLowerCase() === 'practical' || 
                                                            s.type?.toLowerCase() === 'lab' || 
                                                            s.name?.toLowerCase().includes('lab');
                                        return categoryFilter === 'Theory' ? !isPractical : isPractical;
                                    });
                                return filteredSubjects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-surface">
                                    <Target size={24} className="text-on-surface-variant/20 mb-4" />
                                    <p className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest">No subjects tracked yet</p>
                                </div>
                                ) : (
                                <>
                                    {/* Desktop View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs select-none min-w-[650px]">
                                            <thead>
                                                <tr className="border-b border-outline/30 bg-surface-container/20 text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
                                                    <th className="px-6 py-3.5">Code</th>
                                                    <th className="px-6 py-3.5">Subject Name</th>
                                                    <th className="px-6 py-3.5">Professor</th>
                                                    <th className="px-6 py-3.5 text-center">Attended</th>
                                                    <th className="px-6 py-3.5 text-center">Percentage</th>
                                                    <th className="px-6 py-3.5 text-center">Can Bunk / Needed</th>
                                                    <th className="px-6 py-3.5 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-outline/20">
                                                {sortSubs(filteredSubjects).map((subject) => (
                                                    <SubjectRow
                                                        key={subject._id}
                                                        subject={subject}
                                                        targetThreshold={targetThreshold}
                                                        classesNeeded={classesNeeded}
                                                        classesCanSkip={classesCanSkip}
                                                        triggerBubbleMenu={triggerBubbleMenu}
                                                        setEditingSubject={setEditingSubject}
                                                        handleDeleteSubject={handleDeleteSubject}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile/Tablet Card-list View */}
                                    <div className="block md:hidden divide-y divide-outline/20">
                                        {sortSubs(filteredSubjects).map((subject) => {
                                            const pct = subject.attendance_percentage || 0;
                                            const isCritical = pct < targetThreshold;
                                            const needed = classesNeeded(subject.attended || 0, subject.total || 0);
                                            const canSkip = classesCanSkip(subject.attended || 0, subject.total || 0);

                                            return (
                                                <div
                                                    key={subject._id}
                                                    className="p-5 flex flex-col gap-3 hover:bg-surface-container/10 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                <span className="font-mono text-[9px] font-bold text-on-surface-variant/40 tracking-wider">
                                                                    {subject.code || 'COURSE'}
                                                                </span>
                                                                <span className="px-1.5 py-0.5 text-[8px] font-semibold tracking-wider rounded border border-outline bg-surface-container-low text-on-surface-variant/50 uppercase">
                                                                    {(subject.categories?.includes('Practical') || subject.type?.toLowerCase() === 'practical' || subject.type?.toLowerCase() === 'lab' || subject.name?.toLowerCase().includes('lab')) ? 'Practical' : 'Theory'}
                                                                </span>
                                                                {subject.credits !== null && subject.credits !== undefined && (
                                                                    <span className="px-1.5 py-0.5 text-[8px] font-bold tracking-wider rounded border border-outline bg-surface-container-low text-primary/70 uppercase">
                                                                        {subject.credits} Credits
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h4 className="text-xs font-bold text-on-surface truncate max-w-[220px]">
                                                                {subject.name}
                                                            </h4>
                                                            {subject.professor && (
                                                                <p className="text-[10px] text-on-surface-variant/50 font-medium mt-0.5 truncate max-w-[200px]">
                                                                    Prof. {formatTeacherName(subject.professor)}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                                            <span className={`text-sm font-bold ${isCritical ? 'text-red-500' : 'text-on-surface'}`}>
                                                                {Math.round(pct)}%
                                                            </span>
                                                            <span className="text-[10px] font-semibold text-on-surface-variant/40 leading-none">
                                                                {subject.attended || 0}/{subject.total || 0} classes
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="w-full h-1 bg-on-surface/5 border border-outline/35 rounded-full overflow-hidden">
                                                        <div className={`h-full ${isCritical ? 'bg-red-500' : 'bg-on-surface'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                                    </div>

                                                    <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-outline/10">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border tracking-wide whitespace-nowrap ${
                                                            isCritical 
                                                                ? 'bg-red-500/5 border-red-500/10 text-red-500' 
                                                                : 'bg-primary/5 border-outline/30 text-on-surface-variant/80'
                                                        }`}>
                                                            {isCritical ? `Need ${needed} cls` : `${canSkip} Bunks`}
                                                        </span>

                                                        <div className="flex gap-2 shrink-0">
                                                            <button
                                                                onClick={() => setEditingSubject(subject)}
                                                                className="h-7 px-3 border border-outline hover:bg-surface-container rounded-lg flex items-center justify-center text-[10px] font-semibold text-on-surface transition-all cursor-pointer whitespace-nowrap"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSubject(subject._id, subject.name)}
                                                                className="h-7 px-3 border border-red-500/20 hover:bg-red-500/5 rounded-lg flex items-center justify-center text-[10px] font-semibold text-red-500 transition-all cursor-pointer whitespace-nowrap"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}


            {/* Float Hold Bubble Menu */}
            <AnimatePresence>
                {bubbleMenu && (
                    <>
                        <div
                            className="fixed inset-0 z-50"
                            onClick={() => setBubbleMenu(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={{ top: bubbleMenu.y, left: bubbleMenu.x }}
                            className="fixed z-50 bg-surface border border-outline rounded-lg p-1.5 shadow-xl min-w-[150px] text-on-surface flex flex-col"
                        >
                            <button
                                onClick={() => { handleQuickMark(bubbleMenu.subjectId, 'present'); setBubbleMenu(null); }}
                                className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-container rounded-md transition-colors cursor-pointer"
                            >
                                <Check size={12} className="text-primary" />
                                Mark Present
                            </button>
                            <button
                                onClick={() => { handleQuickMark(bubbleMenu.subjectId, 'absent'); setBubbleMenu(null); }}
                                className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-container rounded-md transition-colors cursor-pointer"
                            >
                                <X size={12} className="text-red-500" />
                                Mark Absent
                            </button>
                            <div className="h-px bg-outline my-1" />
                            {(() => {
                                const targetSub = subjects.find(s => s._id === bubbleMenu.subjectId);
                                if (!targetSub) return null;
                                return (
                                    <>
                                        <button
                                            onClick={() => { setEditingSubject(targetSub); setBubbleMenu(null); }}
                                            className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-container rounded-md transition-colors cursor-pointer"
                                        >
                                            <Edit2 size={12} />
                                            Edit Details
                                        </button>
                                        <button
                                            onClick={() => { handleDeleteSubject(targetSub._id, targetSub.name); setBubbleMenu(null); }}
                                            className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/5 rounded-md transition-colors cursor-pointer"
                                        >
                                            <Trash2 size={12} />
                                            Delete Course
                                        </button>
                                    </>
                                );
                            })()}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AddSubjectModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={loadDashboard} currentSemester={currentSemester} />
            {editingSubject && <EditSubjectModal isOpen={!!editingSubject} onClose={() => setEditingSubject(null)} subject={editingSubject} onSuccess={loadDashboard} />}
            {markingSubjectId && <AttendanceModal isOpen={!!markingSubjectId} onClose={() => setMarkingSubjectId(null)} onSuccess={loadDashboard} />}
        </div>
    );
};

export default Dashboard;



