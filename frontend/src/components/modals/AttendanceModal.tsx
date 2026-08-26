import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { useSemester } from '@/contexts/SemesterContext';
import { attendanceService } from '@/services/attendance.service';
import api from '@/services/api';
import { formatLocalDate } from '@/lib/date';
import { Check, X, MoreHorizontal, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { useConfirm } from '@/contexts/ConfirmContext';


interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    // If provided, default to this date, otherwise today
    defaultDate?: Date;
    onSuccess?: () => void;
    onLogsUpdate?: (dateStr: string, logs: any[]) => void;
}

const ATTENDANCE_STATUS_META: Record<string, { label: string; className: string }> = {
    present: { label: 'Present', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
    absent: { label: 'Absent', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
    late: { label: 'Late', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    medical: { label: 'Medical', className: 'bg-surface-container text-on-surface-variant border-outline' },
    approved_medical: { label: 'Medical', className: 'bg-surface-container text-on-surface-variant border-outline' },
    duty: { label: 'Duty', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    cancelled: { label: 'Cancelled', className: 'bg-surface-container/50 text-on-surface-variant/70 border-outline' },
    substituted: { label: 'Substituted', className: 'bg-primary/10 text-primary border-primary/20' },
};

const attendanceStatusMeta = (status: unknown) => ATTENDANCE_STATUS_META[String(status)] || {
    label: String(status || 'Pending').replaceAll('_', ' '),
    className: 'bg-surface-container text-on-surface-variant border-outline',
};

const AttendanceModal: React.FC<AttendanceModalProps> = ({ isOpen, onClose, defaultDate, onSuccess, onLogsUpdate }) => {
    const confirm = useConfirm();
    const { showToast } = useToast();
    const { currentSemester } = useSemester();
    const [selectedDate, setSelectedDate] = useState<Date>(defaultDate || new Date());
    const [loading, setLoading] = useState(false);
    const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [isMarkAllOpen, setIsMarkAllOpen] = useState(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const markAllRef = React.useRef<HTMLDivElement>(null);

    const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedOnSuccess = React.useCallback(() => {
        if (!onSuccess) return;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => onSuccess(), 500);
    }, [onSuccess]);

    // Detailed marking state
    const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
    const [detailStatus, setDetailStatus] = useState<string>('present');
    const [detailNotes, setDetailNotes] = useState('');
    const [detailSubstitutedBy, setDetailSubstitutedBy] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setSelectedDate(defaultDate || new Date());
            loadClassesForDate(defaultDate || new Date());
            fetchAttendanceLogs(defaultDate || new Date());
        }
    }, [isOpen, defaultDate]);

    useEffect(() => {
        if (!isMarkAllOpen) return;
        const closeMenu = (event: MouseEvent) => {
            if (markAllRef.current && !markAllRef.current.contains(event.target as Node)) {
                setIsMarkAllOpen(false);
            }
        };
        document.addEventListener('mousedown', closeMenu);
        return () => document.removeEventListener('mousedown', closeMenu);
    }, [isMarkAllOpen]);

    // Instantly sync our local (optimistic & fetched) logs to the parent Calendar view
    useEffect(() => {
        if (onLogsUpdate && selectedDate) {
            const dateStr = formatLocalDate(selectedDate);
            onLogsUpdate(dateStr, attendanceLogs);
        }
    }, [attendanceLogs, selectedDate, onLogsUpdate]);

    const loadClassesForDate = async (date: Date, silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Fix timezone issue: Avoid toISOString() which shifts day for regions like India
            const dateStr = formatLocalDate(date);

            const [scheduled, subjects] = await Promise.all([
                attendanceService.getClassesForDate(dateStr, currentSemester),
                attendanceService.getSubjects(currentSemester)
            ]);
            setScheduledClasses(scheduled);
            setAllSubjects(subjects);
        } catch (error) {
            console.error(error);
            showToast('error', 'Failed to load classes');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);
        if (!isNaN(newDate.getTime())) {
            setSelectedDate(newDate);
            loadClassesForDate(newDate);
            fetchAttendanceLogs(newDate);
        }
    };

    const fetchAttendanceLogs = async (date: Date) => {
        try {
            const dateStr = formatLocalDate(date);
            const response = await api.get(`/api/attendance/logs?date=${dateStr}&limit=100&semester=${currentSemester}`);

            // Backend returns success_response({"logs": [...], ...}) 
            // So response.data.data is the payload we want
            const data = response.data.data;
            setAttendanceLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to fetch attendance logs:', error);
        }
    };



    const applyOptimisticMark = (subject: any, status: 'present' | 'absent', dateStr: string) => {
        const prevScheduled = [...scheduledClasses];
        const prevLogs = [...attendanceLogs];
        const subjectId = String(subject?._id || subject?.id || subject?.subject_id || '');
        const attendanceType = String(subject?.attendance_type || subject?.type || 'Lecture');
        const logId = String(subject?.log_id || `optimistic-${subjectId}-${dateStr}-${attendanceType}`);
        const subjectName = String(subject?.name || subject?.subject_name || 'Unknown Subject');

        setScheduledClasses((prev) => prev.map((row) => {
            const rowId = String(row?._id || row?.id || row?.subject_id || '');
            const rowAttendanceType = String(row?.attendance_type || row?.type || 'Lecture');
            if (rowId !== subjectId || rowAttendanceType !== attendanceType) return row;
            return {
                ...row,
                marked: true,
                marked_status: status,
                log_id: row?.log_id || logId,
            };
        }));

        setAttendanceLogs((prev) => {
            // Check by both log_id and subject_id to prevent duplicates on the same date
            const existingIndex = prev.findIndex((l: any) => 
                (subject?.log_id && String(l?._id || l?.id) === String(subject?.log_id)) ||
                (String(l?.subject_id) === subjectId && l?.date === dateStr && String(l?.type || '') === attendanceType)
            );
            if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = { ...next[existingIndex], status };
                return next;
            }
            return [{
                _id: logId,
                subject_id: subjectId,
                subject_name: subjectName,
                date: dateStr,
                status,
                type: attendanceType,
            }, ...prev];
        });

        return { prevScheduled, prevLogs };
    };

    const deleteLog = async (logId: string, subjectId?: string) => {
        if (subjectId && processingIds.has(subjectId)) return;
        if (subjectId) setProcessingIds(prev => new Set(prev).add(subjectId));
        
        try {
            await attendanceService.deleteAttendance(logId);
            showToast('success', 'Log deleted');
            await Promise.all([
                fetchAttendanceLogs(selectedDate),
                loadClassesForDate(selectedDate, true),
            ]);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            showToast('error', error.response?.data?.error || 'Failed to delete log');
        } finally {
            if (subjectId) {
                setProcessingIds(prev => {
                    const next = new Set(prev);
                    next.delete(subjectId);
                    return next;
                });
            }
        }
    };

    const markSimple = async (subject: any, status: 'present' | 'absent') => {
        const subjectId = String(subject?._id || subject?.id || subject?.subject_id || '');
        if (processingIds.has(subjectId)) return;
        setProcessingIds(prev => new Set(prev).add(subjectId));
        const dateStr = formatLocalDate(selectedDate);
        const snapshot = applyOptimisticMark(subject, status, dateStr);
        try {
            let res;
            if (subject.log_id && !subject.log_id.startsWith('optimistic-')) {
                res = await attendanceService.editAttendance(subject.log_id, status, undefined, dateStr);
                showToast('success', `Updated to ${status}`);
            } else {
                res = await attendanceService.markAttendance(subjectId, status, dateStr, undefined, undefined, currentSemester, subject.attendance_type);
                if (res?.duplicate && res?.log?._id && res.log.status !== status) {
                    res = await attendanceService.editAttendance(String(res.log._id), status, undefined, dateStr);
                }
                showToast('success', `Marked ${status}`);
            }
            if (res?.log?._id) {
                const realId = String(res.log._id);
                setScheduledClasses(prev => prev.map(r => String(r._id) === subjectId && String(r.attendance_type) === String(subject.attendance_type) ? { ...r, log_id: realId, marked: true, marked_status: status } : r));
                setAttendanceLogs(prev => prev.map(l => (String(l.subject_id) === subjectId && l.date === dateStr && String(l.type) === String(subject.attendance_type)) ? { ...l, _id: realId, status } : l));
            }
            debouncedOnSuccess();
        } catch (error: any) {
            setScheduledClasses(snapshot.prevScheduled);
            setAttendanceLogs(snapshot.prevLogs);
            showToast('error', error.response?.data?.error || 'Failed to mark');
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(subjectId);
                return next;
            });
        }
    };

    const markAllScheduled = async (status: 'present' | 'absent' | 'approved_medical' | 'cancelled') => {
        if (isMarkingAll || processingIds.size > 0 || scheduledClasses.length === 0) return;

        setIsMarkAllOpen(false);
        setIsMarkingAll(true);
        const dateStr = formatLocalDate(selectedDate);
        const classes = groupConsecutiveClasses(scheduledClasses).map(subject =>
            subject.isMerged ? subject.originalClasses[0] : subject
        );

        try {
            let failed = 0;
            for (const subject of classes) {
                const subjectId = String(subject?._id || subject?.id || subject?.subject_id || '');
                try {
                    if (!subjectId) throw new Error('Scheduled class has no subject ID');

                    if (subject.log_id && !String(subject.log_id).startsWith('optimistic-')) {
                        await attendanceService.editAttendance(String(subject.log_id), status, undefined, dateStr);
                        continue;
                    }

                    const result = await attendanceService.markAttendance(
                        subjectId,
                        status,
                        dateStr,
                        undefined,
                        undefined,
                        currentSemester,
                        String(subject.attendance_type || subject.type || 'Lecture')
                    );

                    // The create endpoint returns the existing block on a uniqueness race.
                    // Explicitly edit it when its stored status differs from the bulk choice.
                    if (result?.duplicate && result?.log?._id && result.log.status !== status) {
                        await attendanceService.editAttendance(String(result.log._id), status, undefined, dateStr);
                    }
                } catch {
                    failed += 1;
                }
            }

            await Promise.all([fetchAttendanceLogs(selectedDate), loadClassesForDate(selectedDate, true)]);
            if (failed > 0) {
                showToast('error', `${failed} of ${classes.length} classes could not be updated`);
            } else {
                const label = status === 'approved_medical' ? 'medical leave' : status;
                showToast('success', `All scheduled classes marked ${label}`);
            }
            debouncedOnSuccess();
        } catch (error: any) {
            await Promise.all([fetchAttendanceLogs(selectedDate), loadClassesForDate(selectedDate, true)]);
            showToast('error', error.response?.data?.error || 'Failed to mark all classes');
        } finally {
            setIsMarkingAll(false);
        }
    };

    const unmarkAllScheduled = async () => {
        if (isMarkingAll || processingIds.size > 0) return;

        const dateStr = formatLocalDate(selectedDate);
        const visibleLogs = attendanceLogs.filter(log => log?.date === dateStr);
        const logIds = [...new Set(visibleLogs
            .map(log => String(log?._id || log?.id || ''))
            .filter(logId => logId && !logId.startsWith('optimistic-')))];
        setIsMarkAllOpen(false);
        if (logIds.length === 0) {
            showToast('error', 'No marked records to clear for this date');
            return;
        }

        const isConfirmed = await confirm({
            title: 'Unmark All Attendance',
            message: `Clear all ${logIds.length} marked record${logIds.length === 1 ? '' : 's'} shown for ${dateStr}? This cannot affect another date.`,
        });
        if (!isConfirmed) return;

        setIsMarkingAll(true);
        try {
            await attendanceService.unmarkAttendanceLogs(logIds, dateStr, currentSemester);
            await Promise.all([fetchAttendanceLogs(selectedDate), loadClassesForDate(selectedDate, true)]);
            showToast('success', `Cleared all ${logIds.length} marked record${logIds.length === 1 ? '' : 's'}`);
            debouncedOnSuccess();
        } catch (error: any) {
            await Promise.all([fetchAttendanceLogs(selectedDate), loadClassesForDate(selectedDate, true)]).catch(() => {});
            showToast('error', error.response?.data?.error || 'No records were cleared');
        } finally {
            setIsMarkingAll(false);
        }
    };

    const handleDelete = async (subject: any) => {
        const subjectId = String(subject?._id || subject?.id || subject?.subject_id || '');
        if (processingIds.has(subjectId)) return;
        if (!subject.log_id) {
            showToast('error', 'No attendance record found to delete.');
            return;
        }
        setProcessingIds(prev => new Set(prev).add(subjectId));
        const prevScheduled = [...scheduledClasses];
        const prevLogs = [...attendanceLogs];
        const logId = String(subject?.log_id || '');
        const attendanceType = String(subject?.attendance_type || subject?.type || 'Lecture');
        setScheduledClasses((prev) => prev.map((row) => {
            const rowId = String(row?._id || row?.id || row?.subject_id || '');
            const rowAttendanceType = String(row?.attendance_type || row?.type || 'Lecture');
            if (rowId !== subjectId || rowAttendanceType !== attendanceType) return row;
            return { ...row, marked: false, marked_status: 'pending', log_id: null };
        }));
        setAttendanceLogs((prev) => prev.filter((log: any) => String(log?._id || log?.id) !== logId));
        try {
            if (!logId.startsWith('optimistic-')) {
                await attendanceService.deleteAttendance(logId);
            }
            showToast('success', 'Attendance cleared');
            debouncedOnSuccess();
        } catch (error: any) {
            setScheduledClasses(prevScheduled);
            setAttendanceLogs(prevLogs);
            showToast('error', error.response?.data?.error || 'Failed to delete');
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(subjectId);
                return next;
            });
        }
    };

    const submitDetailedMark = async (subject: any) => {
        const subjectId = String(subject?._id || subject?.id || subject?.subject_id || '');
        if (processingIds.has(subjectId)) return;
        
        try {
            const dateStr = formatLocalDate(selectedDate);
            // If substituted, ensure we selected a substitute subject
            if (detailStatus === 'substituted' && !detailSubstitutedBy) {
                showToast('error', 'Please select the substituting subject');
                return;
            }

            setProcessingIds(prev => new Set(prev).add(subjectId));
            const isSubstitution = detailStatus === 'substituted' || (subject.marked_status === 'substituted');

            let res;
            if (subject.log_id && !subject.log_id.startsWith('optimistic-') && !isSubstitution) {
                res = await attendanceService.editAttendance(subject.log_id, detailStatus, detailNotes, dateStr);
                showToast('success', 'Attendance updated');
            } else {
                if (subject.log_id && !subject.log_id.startsWith('optimistic-') && isSubstitution) {
                    await attendanceService.deleteAttendance(subject.log_id);
                }
                res = await attendanceService.markAttendance(
                    subjectId, detailStatus, dateStr, detailNotes,
                    detailStatus === 'substituted' ? detailSubstitutedBy : undefined, currentSemester, subject.attendance_type
                );
                if (res?.duplicate && res?.log?._id) {
                    const existingLogId = String(res.log._id);
                    if (detailStatus === 'substituted') {
                        await attendanceService.deleteAttendance(existingLogId);
                        res = await attendanceService.markAttendance(
                            subjectId, detailStatus, dateStr, detailNotes,
                            detailSubstitutedBy, currentSemester, subject.attendance_type
                        );
                    } else if (res.log.status !== detailStatus) {
                        res = await attendanceService.editAttendance(existingLogId, detailStatus, detailNotes, dateStr);
                    }
                }
                showToast('success', 'Attendance marked successfully');
            }

            if (res?.log?._id) {
                const realId = String(res.log._id);
                setScheduledClasses(prev => prev.map(r => String(r._id) === subjectId && String(r.attendance_type) === String(subject.attendance_type) ? { ...r, log_id: realId, marked: true, marked_status: detailStatus } : r));
                setAttendanceLogs(prev => {
                    const existingIndex = prev.findIndex((l: any) => 
                        (subject.log_id && String(l?._id || l?.id) === String(subject.log_id)) ||
                        (String(l.subject_id) === subjectId && l.date === dateStr && String(l.type) === String(subject.attendance_type))
                    );
                    if (existingIndex >= 0) {
                        const next = [...prev];
                        next[existingIndex] = { ...next[existingIndex], _id: realId, status: detailStatus };
                        return next;
                    }
                    return [{
                        _id: realId,
                        subject_id: subjectId,
                        subject_name: subject.name || subject.subject_name || 'Unknown Subject',
                        date: dateStr,
                        status: detailStatus,
                        type: String(subject?.attendance_type || subject?.type || 'Lecture'),
                    }, ...prev];
                });
            }

            setExpandedSubjectId(null);
            resetDetailForm();
            debouncedOnSuccess();
        } catch (error: any) {
            showToast('error', error.response?.data?.error || 'Failed to mark');
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(subjectId);
                return next;
            });
        }
    };

    const resetDetailForm = () => {
        setDetailStatus('present');
        setDetailNotes('');
        setDetailSubstitutedBy('');
    };

    const openDetails = (subjectId: string, currentStatus?: string, currentNotes?: string) => {
        setExpandedSubjectId(subjectId);
        // Pre-fill if needed, mostly default
        setDetailStatus(currentStatus === 'pending' ? 'present' : currentStatus || 'present');
        setDetailNotes(currentNotes || '');
        setDetailSubstitutedBy('');
    };

    const scheduledOrder = new Map<string, number>();
    groupConsecutiveClasses(scheduledClasses).forEach((row: any, idx: number) => {
        const sid = String(row?.subject_id || row?.subjectId || row?._id || row?.id || '');
        if (sid && !scheduledOrder.has(sid)) scheduledOrder.set(sid, idx);
    });
    const sortedAttendanceLogs = [...attendanceLogs].sort((a: any, b: any) => {
        const aSid = String(a?.subject_id || a?.subjectId || '');
        const bSid = String(b?.subject_id || b?.subjectId || '');
        const aOrder = scheduledOrder.has(aSid) ? (scheduledOrder.get(aSid) as number) : Number.MAX_SAFE_INTEGER;
        const bOrder = scheduledOrder.has(bSid) ? (scheduledOrder.get(bSid) as number) : Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        const aTs = String(a?.timestamp || '');
        const bTs = String(b?.timestamp || '');
        return aTs.localeCompare(bTs);
    });
    const selectedDateStr = formatLocalDate(selectedDate);
    const markedRecordsCount = attendanceLogs.filter(log =>
        log?.date === selectedDateStr
        && (log?._id || log?.id)
        && !String(log?._id || log?.id).startsWith('optimistic-')
    ).length;



    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Mark Attendance"
            size="md"
        >
            <div className="space-y-5">
                {/* Date Picker - Theme-aware and compact */}
                <div className="flex items-center gap-3 p-2.5 bg-surface-container border border-outline rounded-xl">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary w-9 h-9 flex items-center justify-center shrink-0">
                        <CalendarIcon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <label className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest block mb-0.5">
                            Date Selection
                        </label>
                        <input
                            type="date"
                            className="bg-transparent border-none p-0 text-on-surface font-sans font-medium text-xs focus:ring-0 w-full"
                            value={formatLocalDate(selectedDate)}
                            onChange={handleDateChange}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="py-10 flex justify-center">
                        <LoadingSpinner size="sm" />
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Scheduled List */}
                        <div>
                            <div className="h-7 mb-2.5 px-1 flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">Scheduled Classes</h3>
                                {(scheduledClasses.length > 0 || markedRecordsCount > 0) && (
                                    <div ref={markAllRef} className="relative h-7">
                                        <button
                                            type="button"
                                            onClick={() => setIsMarkAllOpen(open => !open)}
                                            disabled={isMarkingAll || processingIds.size > 0}
                                            aria-label="Mark all scheduled classes"
                                            aria-expanded={isMarkAllOpen}
                                            className="h-7 w-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-50 transition-colors cursor-pointer"
                                            title="Mark all scheduled classes"
                                        >
                                            {isMarkingAll ? <LoadingSpinner size="sm" /> : <MoreHorizontal size={15} />}
                                        </button>
                                        {isMarkAllOpen && (
                                            <div className="absolute right-0 top-8 z-[70] w-44 overflow-hidden rounded-xl border border-outline bg-surface p-1.5 shadow-xl">
                                                <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">Mark all as</div>
                                                {[
                                                    { status: 'present', label: 'Present', dot: 'bg-green-500' },
                                                    { status: 'absent', label: 'Absent', dot: 'bg-red-500' },
                                                    { status: 'approved_medical', label: 'Medical Leave', dot: 'bg-blue-500' },
                                                    { status: 'cancelled', label: 'Cancelled', dot: 'bg-slate-400' },
                                                ].map(option => (
                                                    <button
                                                        key={option.status}
                                                        type="button"
                                                        onClick={() => markAllScheduled(option.status as 'present' | 'absent' | 'approved_medical' | 'cancelled')}
                                                        disabled={scheduledClasses.length === 0}
                                                        className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                                                    >
                                                        <span className={`h-2 w-2 rounded-full ${option.dot}`} />
                                                        {option.label}
                                                    </button>
                                                ))}
                                                <div className="my-1 border-t border-outline/60" />
                                                <button
                                                    type="button"
                                                    onClick={unmarkAllScheduled}
                                                    disabled={markedRecordsCount === 0}
                                                    className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                                                >
                                                    <Trash2 size={13} />
                                                    Unmark all
                                                    {markedRecordsCount > 0 && <span className="ml-auto text-[9px] opacity-60">{markedRecordsCount}</span>}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {scheduledClasses.length > 0 ? (
                                <div className={`space-y-2 ${isMarkingAll ? 'pointer-events-none opacity-60' : ''}`} aria-busy={isMarkingAll}>
                                    {groupConsecutiveClasses(scheduledClasses).map((subject, idx) => {
                                        const subId = subject._id;
                                        const rowId = `${subId}-${subject.attendance_type || idx}`;
                                        return (
                                            <SubjectRow
                                                key={`scheduled-${rowId}`}
                                                subject={subject}
                                                status={subject.marked_status}
                                                expanded={expandedSubjectId === rowId}
                                                onSimpleMark={(subj: any, status: string) => {
                                                    if (subject.isMerged) {
                                                        const primary = subject.originalClasses[0];
                                                        markSimple(primary, status as any);
                                                    } else {
                                                        markSimple(subj, status as any);
                                                    }
                                                }}
                                                onDelete={(subj: any) => {
                                                    const primary = subj.isMerged ? subj.originalClasses[0] : subj;
                                                    if (primary.log_id) {
                                                        handleDelete(primary);
                                                    } else {
                                                        showToast('error', 'No attendance record found to delete.');
                                                    }
                                                }}
                                                onOpenDetails={(_id: string, status: string) => openDetails(rowId, status, subject.notes)}
                                                onCloseDetails={() => setExpandedSubjectId(null)}
                                                detailStatus={detailStatus}
                                                setDetailStatus={setDetailStatus}
                                                detailNotes={detailNotes}
                                                setDetailNotes={setDetailNotes}
                                                detailSubstitutedBy={detailSubstitutedBy}
                                                setDetailSubstitutedBy={setDetailSubstitutedBy}
                                                allSubjects={allSubjects}
                                                onSubmitDetail={() => {
                                                    if (subject.isMerged) {
                                                        const primary = subject.originalClasses[0];
                                                        submitDetailedMark(primary);
                                                    } else {
                                                        submitDetailedMark(subject);
                                                    }
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-on-surface-variant/50 italic text-center py-4">No classes scheduled.</p>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-outline"></div>

                        {/* All Attendance Logs Section */}
                        <div>
                            <h3 className="text-[10px] font-bold text-on-surface-variant/50 mb-2.5 uppercase tracking-wider flex items-center gap-1.5 px-1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                Marked Records ({sortedAttendanceLogs.length})
                            </h3>
                            {sortedAttendanceLogs.length > 0 ? (
                                <div className="space-y-1.5">
                                    {sortedAttendanceLogs.map((log: any, idx: number) => {
                                        const logSubjectId = String(log.subject_id || '');
                                        const logSubject = allSubjects.find((s: any) => String(s._id || s.id) === logSubjectId);
                                        const statusMeta = attendanceStatusMeta(log.status);
                                        const logId = String(log._id || log.id || idx);

                                        return (
                                            <div
                                                key={`log-entry-${logId}-${idx}`}
                                                className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container/30 border border-outline"
                                            >
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <div className="font-bold text-xs text-on-surface truncate">{log.subject_name || log.subject_info?.name || logSubject?.name || 'Unknown Subject'}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${statusMeta.className}`}>
                                                            {statusMeta.label}
                                                        </span>
                                                        {log.notes && (
                                                            <span className="text-[10px] text-on-surface-variant truncate">• {log.notes}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        const subName = log.subject_name || log.subject_info?.name || logSubject?.name || 'this subject';
                                                        const isConfirmed = await confirm({
                                                            title: 'Delete Attendance Entry',
                                                            message: `Delete this ${log.status} entry for ${subName}?`,
                                                        });
                                                        if (isConfirmed) {
                                                            deleteLog(logId, logSubjectId);
                                                        }
                                                    }}
                                                    className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-on-surface-variant hover:text-red-500 shrink-0 cursor-pointer"
                                                    title="Delete this log entry"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-xs text-on-surface-variant/40 italic">No attendance marked for this date</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const SubjectRow = ({
    subject, status, expanded, onSimpleMark, onDelete, onOpenDetails, onCloseDetails,
    detailStatus, setDetailStatus, detailNotes, setDetailNotes, detailSubstitutedBy, setDetailSubstitutedBy, allSubjects, onSubmitDetail
}: any) => {

    const isMarked = status && status !== 'pending';
    const statusMeta = attendanceStatusMeta(status);

    if (expanded) {
        return (
            <div className="bg-surface border border-outline rounded-xl p-4 shadow-md">
                <div className="flex justify-between items-center mb-3 border-b border-outline pb-2">
                    <h4 className="font-bold text-on-surface text-sm">{subject.name}</h4>
                    <button onClick={onCloseDetails} className="text-on-surface-variant/40 hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-3">
                    {/* Status Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'present', label: 'Present', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' },
                            { id: 'absent', label: 'Absent', color: 'bg-red-500/10 text-red-500 border border-red-500/20' },
                            { id: 'medical', label: 'Medical Leave', color: 'bg-surface-container text-on-surface-variant border border-outline' },
                            { id: 'cancelled', label: 'Cancelled', color: 'bg-surface-container/50 text-on-surface-variant/70 border border-outline' },
                            { id: 'substituted', label: 'Substituted', color: 'bg-primary/10 text-primary border border-primary/20' },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setDetailStatus(opt.id === 'medical' ? 'approved_medical' : opt.id)}
                                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border ${(detailStatus === opt.id || (opt.id === 'medical' && detailStatus === 'approved_medical'))
                                    ? opt.color
                                    : 'bg-surface border-outline text-on-surface-variant/60 hover:bg-surface-container hover:text-on-surface'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Substitution Dropdown */}
                    {detailStatus === 'substituted' && (() => {
                        const filteredSubjects = allSubjects.filter((s: any) => {
                            const sId = String(s._id || s.id);
                            const currentId = String(subject._id || subject.id);
                            return sId !== currentId;
                        });
                        const selectedSub = filteredSubjects.find((s: any) => {
                            const sId = String(s._id || s.id);
                            return sId === detailSubstitutedBy;
                        });
                        return (
                            <div className="animate-fade-in p-2.5 bg-surface-container rounded-lg border border-outline">
                                <label className="text-[9px] font-bold text-on-surface-variant/40 uppercase block mb-1">
                                    Substituted By
                                </label>
                                <SubstitutionDropdown
                                    subjects={filteredSubjects}
                                    value={detailSubstitutedBy}
                                    selectedName={selectedSub?.name}
                                    onChange={setDetailSubstitutedBy}
                                />
                            </div>
                        );
                    })()}

                    {/* Notes */}
                    <div>
                        <label className="text-[9px] font-semibold text-on-surface-variant/50 uppercase block mb-1">
                            Notes (Optional)
                        </label>
                        <textarea
                            className="w-full bg-surface border border-outline focus:border-primary rounded-lg p-2 text-xs resize-none text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none transition-all"
                            placeholder="Add details..."
                            rows={2}
                            value={detailNotes}
                            onChange={(e) => setDetailNotes(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 pt-1">
                        {isMarked && (
                            <Button variant="text" className="text-red-500 hover:bg-red-500/10 hover:text-red-600 flex-1" onClick={() => onDelete(subject)}>
                                Clear Mark
                            </Button>
                        )}
                        <Button className="flex-1" onClick={() => onSubmitDetail(subject._id || subject.id)}>
                            Confirm Mark
                        </Button>
                    </div>
                </div>
            </div >
        );
    }

    // Collapsed View
    return (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container/30 border border-outline hover:bg-surface-container-high transition-colors group">
            <span className="font-bold text-xs text-on-surface">{subject.name}</span>
            <div className="flex items-center gap-1.5">
                {!isMarked ? (
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSimpleMark(subject, 'present')}
                            className="h-7 w-7 p-0 rounded-lg text-on-surface-variant hover:text-green-500 hover:bg-green-500/10 cursor-pointer"
                            title="Mark Present"
                        >
                            <Check size={14} />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSimpleMark(subject, 'absent')}
                            className="h-7 w-7 p-0 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                            title="Mark Absent"
                        >
                            <X size={14} />
                        </Button>
                    </>
                ) : (
                    <div className="flex items-center gap-1.5 mr-1">
                        <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded border font-bold ${statusMeta.className}`}>
                            {statusMeta.label}
                        </span>

                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(subject)}
                            className="h-7 w-7 p-0 rounded-lg text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                            title="Delete/Clear"
                        >
                            <Trash2 size={13} />
                        </Button>
                    </div>
                )}

                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenDetails(subject._id || subject.id, status, subject.notes)}
                    className="h-7 w-7 p-0 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
                >
                    <MoreHorizontal size={14} />
                </Button>
            </div>
        </div>
    );
};

const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return 0;
    let [_, h, m, ampm] = match;
    let hours = parseInt(h, 10);
    const minutes = parseInt(m, 10);
    if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

const groupConsecutiveClasses = (classes: any[]) => {
    if (!classes || classes.length === 0) return [];

    // Sort classes by starting time before grouping
    const sortedClasses = [...classes].sort((a, b) => {
        return parseTime(a.time) - parseTime(b.time);
    });

    const grouped: any[] = [];
    let currentGroup: any = null;

    sortedClasses.forEach((slot) => {
        const slotId = String(slot._id || slot.id || '');
        const subjectId = String(slot.subject_id || slot.subjectId || '');

        const currentGroupSubId = currentGroup ? String(currentGroup.subject_id || currentGroup.subjectId || '') : null;
        const hasSameAttendanceBlock = String(slot.attendance_type || '') === String(currentGroup?.attendance_type || '');

        // Merge Condition:
        // 1. Same Subject ID (if present)
        // 2. OR Same Name (Fallback if IDs missing/messy) - Strong signal for consecutive slots
        // 3. MUST be same Type
        const isSameSubject = (subjectId && currentGroupSubId && subjectId === currentGroupSubId) ||
            (slot.name === currentGroup?.name);

        if (currentGroup && isSameSubject && slot.type === currentGroup.type && hasSameAttendanceBlock) {
            // Merge
            currentGroup.originalClasses.push(slot);
            // Update time range
            if (slot.time && currentGroup.startTime) {
                const parts = slot.time.split(' - ');
                const end = parts[1] || parts[0];
                currentGroup.time = `${currentGroup.startTime} - ${end}`;
            }
            // Status Priority: Show first slot's status
            currentGroup.marked_status = currentGroup.originalClasses[0].marked_status;
            // Notes priority? First slot notes?
            currentGroup.notes = currentGroup.originalClasses[0].notes || currentGroup.notes; // Keep notes from first log

        } else {
            // New Group
            const timeParts = slot.time ? slot.time.split(' - ') : [];
            const startTime = timeParts[0] || '';

            currentGroup = {
                ...slot,
                _id: slotId,
                isMerged: true,
                originalClasses: [slot],
                startTime: startTime
            };
            grouped.push(currentGroup);
        }
    });

    return grouped.map(g => ({
        ...g,
        isMerged: g.originalClasses.length > 1,
    }));
};

const SubstitutionDropdown = ({ subjects, value, selectedName, onChange }: {
    subjects: any[];
    value: string;
    selectedName?: string;
    onChange: (val: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full bg-surface border border-outline text-on-surface rounded-lg px-3 py-2 text-xs text-left flex items-center justify-between hover:border-primary/50 transition-all"
            >
                <span className={value ? 'text-on-surface' : 'text-on-surface-variant/40'}>{selectedName || 'Select Subject...'}</span>
                <svg className={`w-4 h-4 text-on-surface-variant/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {open && (
                <div className="absolute left-0 right-0 z-[60] mt-1 rounded-xl border border-outline bg-surface shadow-lg overflow-hidden max-h-[180px] overflow-y-auto custom-scrollbar">
                    <button
                        type="button"
                        onClick={() => { onChange(''); setOpen(false); }}
                        className={`w-full px-4 py-2 text-left text-xs transition-colors ${!value ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                    >
                        Select Subject...
                    </button>
                    {subjects.map((s: any) => {
                        const sId = String(s._id || s.id);
                        const isSelected = sId === value;
                        return (
                            <button
                                key={`sub-drop-${sId}`}
                                type="button"
                                onClick={() => { onChange(sId); setOpen(false); }}
                                className={`w-full px-4 py-2 text-left text-xs transition-colors ${isSelected ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                            >
                                {s.name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AttendanceModal;
