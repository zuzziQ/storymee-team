const isServer = typeof window === 'undefined';
// dev-hub.storymee.com → Nginx → core-admin-api:4503 (direct, không qua Hub Go Gateway)
// dev-hub.storymee.com → Hub Go Gateway (chỉ dùng cho LLM/AI routes)
const defaultBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://dev-hub.storymee.com';

// Cả server lẫn client đều gọi thẳng vào API backend
// Không có Next.js proxy, dùng empty string sẽ gọi vào Vercel routes → lỗi ROUTER_EXTERNAL
const baseURL = defaultBaseUrl;

export class CoreApiClient {
    private baseURL: string;

    constructor(config: { baseURL: string }) {
        let url = config.baseURL;
        if (!url.endsWith('/internal/v1/team') && !url.endsWith('/internal/v1/team/')) {
            url = url.replace(/\/+$/, '') + '/internal/v1/team';
        }
        this.baseURL = url;
    }

    private async resolveBaseUrl() {
        if (typeof window !== 'undefined') {
            const match = document.cookie.match(new RegExp('(^| )hub_connection_url=([^;]+)'));
            if (match) return decodeURIComponent(match[2]) + '/internal/v1/team';
            return this.baseURL;
        } else {
            try {
                const { cookies } = await import('next/headers');
                const cookieStore = await cookies();
                const val = cookieStore.get('hub_connection_url')?.value;
                if (val) return decodeURIComponent(val) + '/internal/v1/team';
            } catch (e) {}
            return this.baseURL;
        }
    }

    public async get<T = any>(url: string): Promise<T> {
        try {
            const baseUrl = await this.resolveBaseUrl();
            const res = await fetch(`${baseUrl}${url}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(60000)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw { status: res.status, data };
            return data;
        } catch (error: any) {
            throw { message: error.message || 'fetch failed', status: error.status || 500, data: error.data };
        }
    }

    public async post<T = any>(url: string, body: any): Promise<T> {
        try {
            const baseUrl = await this.resolveBaseUrl();
            const res = await fetch(`${baseUrl}${url}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(60000)
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
            const res = await fetch(`${baseUrl}${url}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(60000)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw { status: res.status, data };
            return data;
        } catch (error: any) {
            throw { message: error.message || 'fetch failed', status: error.status || 500, data: error.data };
        }
    }

    public async delete<T = any>(url: string): Promise<T> {
        try {
            const baseUrl = await this.resolveBaseUrl();
            const res = await fetch(`${baseUrl}${url}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(60000)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw { status: res.status, data };
            return data;
        } catch (error: any) {
            throw { message: error.message || 'fetch failed', status: error.status || 500, data: error.data };
        }
    }
}

export const coreApiClient = new CoreApiClient({
    baseURL, enforceApiPrefix: false
});

export const API_ROUTES = {
    HR: {
        TEAM_MEMBERS: '/hr/team-members',
        ATTENDANCE: '/hr/attendance',
        ATTENDANCE_CHECKIN: '/hr/attendance/checkin',
        ATTENDANCE_CHECKOUT: '/hr/attendance/checkout',
        LEAVE_REQUESTS: '/hr/leave-requests',
        SUBTASKS: '/hr/subtasks',
        TASKS: '/hr/tasks',
        PROJECTS: '/hr/projects'
    },
    OMNITASK: {
        ROOT: '/omnitask/'
    }
};
