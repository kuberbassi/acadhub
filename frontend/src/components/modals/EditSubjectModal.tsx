import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import { BookOpen, User, MapPin, Hash, FileText, Save } from 'lucide-react';


interface EditSubjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    subject: any; // Accommodate SubjectOverview (id) and Subject (_id)
    onSuccess: () => void;
}

const EditSubjectModal: React.FC<EditSubjectModalProps> = ({ isOpen, onClose, subject, onSuccess }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        professor: '',
        classroom: '',
        syllabus: '',
        semester: 1,
        credits: 3,
        attended: 0,
        total: 0,
        practical_total: 10,
        assignment_total: 4
    });

    useEffect(() => {
        if (subject && isOpen) {
            setFormData({
                name: subject.name || '',
                code: subject.code || '',
                professor: subject.professor || '',
                classroom: subject.classroom || '',
                syllabus: subject.syllabus || '',
                semester: subject.semester || 1,
                credits: subject.credits !== undefined ? Number(subject.credits) : 3,
                attended: subject.attended || 0,
                total: subject.total || 0,
                practical_total: 10,
                assignment_total: 4
            });

            // Fetch latest details
            const id = subject.id || subject._id;

            if (id) fetchDetails(id);
        }
    }, [subject, isOpen]);

    const fetchDetails = async (id: string) => {
        try {
            const details = await attendanceService.getSubjectDetails(id);
            if (details) {
                setFormData(prev => ({
                    ...prev,
                    code: details.code || prev.code,
                    categories: details.categories || (prev as any).categories || ['Theory'],
                    professor: details.professor || prev.professor,
                    classroom: details.classroom || prev.classroom,
                    syllabus: details.syllabus || prev.syllabus,
                    semester: details.semester || prev.semester,
                    credits: details.credits !== null && details.credits !== undefined ? Number(details.credits) : prev.credits,
                    attended: details.attended ?? prev.attended,
                    total: details.total ?? prev.total,
                    practical_total: details.practicals?.total ?? 10,
                    assignment_total: details.assignments?.total ?? 4
                }));
            }
        } catch (error) {
            console.error(error);
            showToast('error', 'Subject not found or has been deleted');
            onClose();
        }
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['credits', 'attended', 'total', 'practical_total', 'assignment_total'].includes(name);
        setFormData(prev => ({ ...prev, [name]: isNumeric ? parseInt(value) || 0 : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject) return;

        setLoading(true);

        try {
            const id = subject.id || subject._id;

            await attendanceService.updateSubjectFullDetails(id, formData);

            showToast('success', 'Subject details updated successfully');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            showToast('error', 'Failed to update subject details');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Subject Details"
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Subject Name */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Subject Name</label>
                    <div className="relative">
                        <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/40" />
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-primary focus:outline-none transition-all text-on-surface placeholder:text-on-surface-variant/30"
                            placeholder="e.g. Data Structures"
                            required
                        />
                    </div>
                </div>

                {/* Categories, Code, & Credits Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(5.5rem,0.55fr)] gap-4 items-start">
                    {/* Categories Multi-Select */}
                    <div className="space-y-2 sm:col-span-2 md:col-span-1">
                        <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Categories</label>
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 p-2 bg-surface-container border border-outline rounded-lg min-h-[46px]">
                            {['Theory', 'Practical', 'Assignment'].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        const current = (formData as any).categories || [];
                                        let nextCats;
                                        if (current.includes(cat)) {
                                            nextCats = current.filter((c: string) => c !== cat);
                                        } else {
                                            nextCats = [...current, cat];
                                        }
                                        
                                        // Auto-assign credits based on category selection change action
                                        let nextCredits = formData.credits;
                                        if (nextCats.includes('Theory') && !nextCats.includes('Practical')) {
                                            nextCredits = 3;
                                        } else if (nextCats.includes('Practical') && !nextCats.includes('Theory')) {
                                            nextCredits = 1;
                                        } else if (nextCats.includes('Theory') && nextCats.includes('Practical')) {
                                            nextCredits = 4;
                                        }
                                        
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            categories: nextCats, 
                                            credits: nextCredits 
                                        }));
                                    }}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold border transition-all
                                        ${((formData as any).categories || []).includes(cat)
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-surface border-transparent text-on-surface-variant/50 hover:bg-surface-container hover:text-on-surface'
                                        }
                                    `}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject Code */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Subject Code</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/40" />
                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-primary focus:outline-none transition-all text-on-surface placeholder:text-on-surface-variant/30"
                                placeholder="e.g. CS-101"
                            />
                        </div>
                    </div>

                    {/* Credits */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Credits</label>
                        <div className="relative">
                            <input
                                type="number"
                                name="credits"
                                value={formData.credits}
                                onChange={handleChange}
                                min="0"
                                max="10"
                                className="w-full px-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-primary focus:outline-none transition-all text-on-surface placeholder:text-on-surface-variant/30"
                                placeholder="Credits (e.g. 3)"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Professor */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Professor</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/40" />
                            <input
                                type="text"
                                name="professor"
                                value={formData.professor}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-primary focus:outline-none transition-all text-on-surface placeholder:text-on-surface-variant/30"
                                placeholder="Prof. Name"
                            />
                        </div>
                    </div>

                    {/* Classroom */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Classroom</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/40" />
                            <input
                                type="text"
                                name="classroom"
                                value={formData.classroom}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-primary focus:outline-none transition-all text-on-surface placeholder:text-on-surface-variant/30"
                                placeholder="Room 301"
                            />
                        </div>
                    </div>
                </div>

                {/* Syllabus */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Syllabus / Notes</label>
                    <div className="relative">
                        <FileText className="absolute left-3 top-3 w-5 h-5 text-on-surface-variant/40" />
                        <textarea
                            name="syllabus"
                            value={formData.syllabus}
                            onChange={handleChange}
                            rows={3}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-primary focus:outline-none transition-all text-on-surface placeholder:text-on-surface-variant/30 resize-none"
                            placeholder="Enter syllabus topics or important notes..."
                        />
                    </div>
                </div>

                {/* Attendance Count Override */}
                <div className="p-4 rounded-lg bg-orange-500/10 dark:bg-orange-500/5 border border-orange-500/20">
                    <label className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-2 block">⚠️ Manual Attendance Override</label>
                    <p className="text-xs text-on-surface-variant/60 mb-3">Use this to fix incorrect counts. Be careful!</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Classes Attended</label>
                            <input
                                type="number"
                                name="attended"
                                value={formData.attended}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-orange-500/50 focus:outline-none transition-all text-on-surface text-center font-bold text-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Total Classes</label>
                            <input
                                type="number"
                                name="total"
                                value={formData.total}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-orange-500/50 focus:outline-none transition-all text-on-surface text-center font-bold text-lg"
                            />
                        </div>

                        {/* Assignment & Practical Totals Override */}
                        <div className="col-span-1 sm:col-span-2 p-4 rounded-lg bg-surface-container/30 border border-outline">
                            <label className="text-xs font-bold text-on-surface-variant/80 uppercase mb-2 block">🎯 Target Totals</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {((formData as any).categories?.includes('Practical')) && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Practical Total</label>
                                        <input
                                            type="number"
                                            name="practical_total"
                                            value={(formData as any).practical_total || 10}
                                            onChange={handleChange}
                                            min="1"
                                            className="w-full px-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-primary/50 focus:outline-none transition-all text-on-surface text-center font-bold text-lg"
                                        />
                                    </div>
                                )}
                                {((formData as any).categories?.includes('Assignment')) && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-on-surface-variant/70 uppercase ml-1">Assignment Total</label>
                                        <input
                                            type="number"
                                            name="assignment_total"
                                            value={(formData as any).assignment_total || 4}
                                            onChange={handleChange}
                                            min="1"
                                            className="w-full px-4 py-2.5 rounded-lg bg-surface border border-outline focus:border-primary/50 focus:outline-none transition-all text-on-surface text-center font-bold text-lg"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full"
                        icon={!loading && <Save size={18} />}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default EditSubjectModal;
