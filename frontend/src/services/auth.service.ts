import api from './api';
import type { User } from '@/types';
import { attendanceService } from './attendance.service';

export interface AuthSessionSummary {
    id: string;
    device_id?: string | null;
    ip: string;
    country_code?: string | null;
    user_agent: string;
    refresh_issued_at: number;
    last_active_at: number;
    is_current: boolean;
}

export const authService = {
    // Initiate Google OAuth login
    initiateLogin: () => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        window.location.href = `${baseUrl}/api/auth/login`;
    },

    loginWithGoogle: async (credential: string): Promise<User | null> => {
        try {
            // Send the Google ID token to our Node backend for verification
            const response = await api.post('/api/auth/google', { credential });

            // Backend wraps response in { success, data: { user } } and sets auth cookies.
            const payload = response.data?.data ?? response.data;
            const user = payload?.user;

            return user || null;
        } catch (error) {
            console.error('Google login error:', error);
            throw error;
        }
    },

    // Get current user
    getCurrentUser: async (): Promise<User | null> => {
        const response = await api.get('/api/auth/me');
        return response.data.data;
    },

    clearLocalSession: (): void => {
        attendanceService.clearAllLocalCaches();
        localStorage.removeItem('user');
    },

    // Logout
    logout: async (): Promise<void> => {
        try {
            await api.post('/api/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            attendanceService.clearAllLocalCaches();
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    },

    deleteAccount: async (confirmationEmail: string): Promise<void> => {
        await api.delete('/api/profile/account', {
            data: {
                confirmation_email: confirmationEmail,
                confirmation_text: 'DELETE',
            },
        });
        attendanceService.clearAllLocalCaches();
        localStorage.removeItem('user');
    },

    // Check if user is authenticated
    isAuthenticated: (): boolean => {
        const user = localStorage.getItem('user');
        return !!user;
    },

    // Get stored user
    getStoredUser: (): User | null => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                return null;
            }
        }
        return null;
    },

    // Fetch active sessions
    getActiveSessions: async (): Promise<AuthSessionSummary[]> => {
        // This screen already exposes an explicit failure state. Avoid turning
        // one server failure into four requests and tripping rate limits.
        const response = await api.get('/api/auth/sessions', { _skipRetry: true });
        return response.data.data ?? response.data;
    },

    // Revoke a specific session
    revokeSession: async (sessionId: string): Promise<void> => {
        await api.delete(`/api/auth/sessions/${sessionId}`);
    },

    // Revoke all other sessions
    revokeOtherSessions: async (): Promise<void> => {
        await api.delete('/api/auth/sessions');
    },

    // Store user
    storeUser: (user: User): void => {
        localStorage.setItem('user', JSON.stringify(user));
    },
};
