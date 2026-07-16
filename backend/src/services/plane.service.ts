export class PlaneService {
    static async deleteIssue(workspaceSlug: string, projectId: string, issueId: string) {
        if (!process.env.PLANE_API_KEY || !process.env.PLANE_URL) {
            console.log('[PlaneService] PLANE_API_KEY or PLANE_URL is missing. Skipping real Plane API call.');
            return null;
        }

        try {
            const planeUrl = process.env.PLANE_URL.replace(/\/$/, '');
            const url = `${planeUrl}/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/`;
            
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'x-api-key': process.env.PLANE_API_KEY
                }
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Plane API error: ${response.status} ${text}`);
            }

            if (response.status !== 204 && response.headers.get('content-type')?.includes('application/json')) {
                return await response.json();
            }
            return null;
        } catch (error: any) {
            console.error('[PlaneService] Error deleting issue on Plane API:', error.message);
            throw error;
        }
    }
}
