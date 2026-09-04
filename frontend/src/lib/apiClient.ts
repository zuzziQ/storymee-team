// dev-hub.storymee.com → Nginx → core-admin-api:4503 (direct, không qua Hub Go Gateway)
// dev-hub.storymee.com → Hub Go Gateway (chỉ dùng cho LLM/AI routes)
let defaultBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://dev-hub.storymee.com';
if (defaultBaseUrl === '/api' || defaultBaseUrl === '/' || defaultBaseUrl.includes('//hub.storymee.com')) {
    defaultBaseUrl = 'https://dev-hub.storymee.com';
}

// Cả server lẫn client đều gọi thẳng vào API backend
// Không có Next.js proxy, dùng empty string sẽ gọi vào Vercel routes → lỗi ROUTER_EXTERNAL
const baseURL = defaultBaseUrl;

export class CoreApiClient {
    private baseURL: string;
    private token?: string;

    constructor(config: { baseURL: string; token?: string }) {
        let url = config.baseURL;
        if (!url.endsWith('/api/v1/team') && !url.endsWith('/api/v1/team/')) {
            url = url.replace(/\/+$/, '') + '/api/v1/team';
        }
        this.baseURL = url;
        this.token = config.token;
    }

    private async resolveBaseUrl() {
        return this.baseURL;
    }

    private headers(): Record<string, string> {
        const token = this.token || (typeof window !== 'undefined' ? localStorage.getItem('st_team_token') : null);
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }

    public async get<T = any>(url: string): Promise<T> {
        try {
            const baseUrl = await this.resolveBaseUrl();
            const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
            const fullUrl = baseUrl.endsWith('/') ? `${baseUrl}${cleanUrl}` : `${baseUrl}/${cleanUrl}`;
            console.log('[CoreApiClient] GET Fetching:', fullUrl);
            const res = await fetch(fullUrl, {
                method: 'GET',
                headers: this.headers(),
                signal: AbortSignal.timeout(60000),
                cache: 'no-store'
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw { status: res.status, data };
            return data;
        } catch (error: any) {
            console.error('[CoreApiClient] GET Error:', error);
            throw { message: error.message || 'fetch failed', status: error.status || 500, data: error.data };
        }
    }

    public async post<T = any>(url: string, body?: any): Promise<T> {
        try {
            const baseUrl = await this.resolveBaseUrl();
            const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
            const fullUrl = baseUrl.endsWith('/') ? `${baseUrl}${cleanUrl}` : `${baseUrl}/${cleanUrl}`;
            console.log('[CoreApiClient] POST Fetching:', fullUrl);
            const res = await fetch(fullUrl, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(60000),
                cache: 'no-store'
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw { status: res.status, data };
            return data;
        } catch (error: any) {
            throw { message: error.message || 'fetch failed', status: error.status || 500, data: error.data };
        }
    }

    public async patch<T = any>(url: string, body: any): Promise<T> {
        try {
            const baseUrl = await this.resolveBaseUrl();
            const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
            const fullUrl = baseUrl.endsWith('/') ? `${baseUrl}${cleanUrl}` : `${baseUrl}/${cleanUrl}`;
            console.log('[CoreApiClient] PATCH Fetching:', fullUrl);
            const res = await fetch(fullUrl, {
                method: 'PATCH',
                headers: this.headers(),
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(60000),
                cache: 'no-store'
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw { status: res.status, data };
            return data;
        } catch (error: any) {
            console.error('[CoreApiClient] PATCH Error:', error);
            throw { message: error.message || 'fetch failed', status: error.status || 500, data: error.data };
        }
    }

    public async delete<T = any>(url: string, body?: any): Promise<T> {
        try {
            const baseUrl = await this.resolveBaseUrl();
            const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
            const fullUrl = baseUrl.endsWith('/') ? `${baseUrl}${cleanUrl}` : `${baseUrl}/${cleanUrl}`;
            console.log('[CoreApiClient] DELETE Fetching:', fullUrl);
            const res = await fetch(fullUrl, {
                method: 'DELETE',
                headers: this.headers(),
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(60000),
                cache: 'no-store'
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw { status: res.status, data };
            return data;
        } catch (error: any) {
            console.error('[CoreApiClient] DELETE Error:', error);
            throw { message: error.message || 'fetch failed', status: error.status || 500, data: error.data };
        }
    }
}

export const coreApiClient = new CoreApiClient({
    baseURL
});

export const API_ROUTES = {
    AUTH: {
        EXCHANGE: '/auth/one-time/exchange',
        ME: '/auth/me',
    },
    HR: {
        TEAM_MEMBERS: '/hr/team-members',
        /** Self-register → pending (admin must approve) */
        TEAM_MEMBERS_REGISTER: '/hr/team-members/register',
        /** Login gate: only active accounts */
        AUTH_LOOKUP: '/hr/auth/lookup',
        memberApprove: (id: string) => `/hr/team-members/${id}/approve`,
        memberReject: (id: string) => `/hr/team-members/${id}/reject`,
        memberSuspend: (id: string) => `/hr/team-members/${id}/suspend`,
        memberDelete: (id: string, hard = false) =>
            `/hr/team-members/${id}${hard ? '?hard=true' : ''}`,
        memberSetAdmin: (id: string) => `/hr/team-members/${id}/set-admin`,
        SETTINGS_PRIVACY: '/hr/settings/privacy',
        ATTENDANCE: '/hr/attendance',
        ATTENDANCE_CHECKIN: '/hr/attendance/checkin',
        ATTENDANCE_CHECKOUT: '/hr/attendance/checkout',
        LEAVE_REQUESTS: '/hr/leave-requests',
        SUBTASKS: '/hr/subtasks',
        TASKS: '/hr/tasks',
        PROJECTS: '/hr/projects',
        MEETINGS: '/hr/meetings',
        ANNOUNCEMENTS: '/hr/announcements',
        announcementRead: (id: string) => `/hr/announcements/${id}/read`,
    },
    PLANE: {
        ISSUES: '/plane/issues',
        PROJECTS: '/plane/projects',
        /** POST /plane/issues/:id/review — admin approve|reject (SSOT) */
        issueReview: (id: string) => `/plane/issues/${id}/review`,
        /** POST /plane/issues/:id/request-archive — employee xin lưu trữ */
        issueRequestArchive: (id: string) => `/plane/issues/${id}/request-archive`,
        /** DELETE /plane/issues/:id — hard-delete (assignee|admin) */
        issueDelete: (id: string) => `/plane/issues/${id}`,
    }
};
