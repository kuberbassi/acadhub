import { format, parseISO, formatDistance } from 'date-fns';

export const formatDate = (date: string | Date, pattern: string = 'MMM dd, yyyy'): string => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, pattern);
};

export const formatDateTime = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'MMM dd, yyyy HH:mm');
};

export const formatRelative = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistance(dateObj, new Date(), { addSuffix: true });
};

export const formatNumber = (num: number, decimals: number = 1): string => {
    return num.toFixed(decimals);
};

export const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
};

export const formatTeacherName = (name: string): string => {
    if (!name) return 'Unknown';
    return name.trim();
};

