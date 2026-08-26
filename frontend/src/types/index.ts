export interface User {
    _id: string;
    name: string;
    email: string;
    pfp?: string;
    picture?: string;
    bio?: string;
    college?: string;
    course?: string;
    branch?: string;
    semester?: number;
    current_semester?: number;
    enrollment_number?: string;
    batch?: string;
    verified?: boolean;
    created_at?: string;
    attendance_threshold?: number;
    warning_threshold?: number;
    phone_number?: string;
}

export interface SystemLog {
    action: string;
    description: string;
    timestamp: string | { $date: string };
    user_email: string;
}

export interface AttendanceRecord {
    _id?: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    subject_id: string;
    semester: number;
}

export interface Subject {
    _id: string;
    name: string;
    code: string;
    credits: number;
    semester: number;
    color?: string;
    attendance?: {
        present: number;
        absent: number;
        total: number;
        percentage: number;
        required: number;
        status: string;
    };
    category?: string;
    categories?: string[];
    professor?: string;
    classroom?: string;
    syllabus?: string;
    attended?: number; // legacy support
    total?: number;    // legacy support
    attendance_percentage?: number; // chart/dashboard support
    practicals?: {
        total: number;
        completed: number;
        hardcopy: boolean;
    };
    assignments?: {
        total: number;
        completed: number;
        hardcopy?: boolean;
    };
}

export interface DashboardData {
    overall_attendance: number;
    attendance_without_medical?: number;
    medical_leave_count?: number;
    total_classes: number;
    total_subjects: number;
    attendance_status: string;
    subjects: any[];
    recent_logs: any[];
    next_class?: {
        subject: string;
        time: string;
        room: string;
    };
    daily_attendance: any[];
    weekly_overview: any[];
    summary?: any;
}

export interface Notice {
    _id: string;
    title: string;
    content: string;
    date: string;
    category: string;
    link?: string;
}

export interface AcademicResult {
    _id: string;
    semester: number;
    gpa: number;
    cgpa?: number;
    subjects: {
        name: string;
        grade: string;
        credits: number;
        points: number;
    }[];
}

export interface Skill {
    _id?: string;
    name: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    category: string;
    progress: number;
    notes?: string;
}

export interface TimetableSlot {
    _id?: string;
    id?: string;       // backend stores slots with 'id' field
    day: string;
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
    subject_id?: string;
    type?: 'class' | 'break' | 'free' | 'custom';
    label?: string;     // Optional override label
    professor?: string;
    classroom?: string;
}

export type TimetableSchedule = Record<string, TimetableSlot[]>;

export interface GridPeriod {
    id: string;
    name: string;
    startTime: string; // HH:MM
    endTime: string;   // HH:MM
}

export interface TimetableData {
    schedule: TimetableSchedule;
    periods: GridPeriod[];
    semester: number;
}

export interface Preferences {
    accent_color?: string;
    theme?: 'light' | 'dark';
    compact_mode?: boolean;
    attendance_threshold?: number;
    warning_threshold?: number;
    notifications_enabled?: boolean;
}

export interface ReportsData {
    kpis: {
        best_subject_name: string;
        best_subject_percent: string;
        worst_subject_name: string;
        worst_subject_percent: string;
        total_absences: number;
        overall_percentage?: number;
        attendance_streak?: number;
        at_risk_count?: number;
        total_subjects?: number;
        target_threshold?: number;
        safe_bunks_remaining?: number;
        consistency_score?: number;
        attendance_momentum?: number;
        achievement_level?: string;
        focus_label?: string;
        cgpa?: number;
        academic_score?: number;
        academic_standing?: number;
    };
    subject_breakdown: any[];
    heatmap_data?: Record<string, string[]>;
}

export interface AcademicRecord {
    _id?: string;
    semester: number;
    gpa: number;
}

export interface SemesterResult {
    _id?: string;
    semester: number;
    semester_label?: string;
    sgpa: number;
    cgpa?: number;
    subjects: any[];
    timestamp?: string | { $date: string };
}

export interface Experience {
    _id?: string;
    company: string;
    role: string;
    start_date: string;
    end_date?: string;
    current: boolean;
    description?: string;
    location?: string;
}

export interface Certification {
    _id?: string;
    name: string;
    issuer: string;
    issue_date?: string;
    url?: string;
    credential_id?: string;
}

export interface Project {
    _id?: string;
    name: string;
    description: string;
    url?: string;
    github_url?: string;
    start_date?: string;
    end_date?: string;
    current: boolean;
    technologies: string[];
}
