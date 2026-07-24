"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LettaMemoryService = void 0;
// @ts-nocheck
const prisma_1 = require("../config/prisma");
const settings_service_1 = require("./settings.service");
const api_client_1 = require("@storymee/api-client");
class LettaMemoryService {
    static activeApiUrl = null;
    static lastHealthCheckTime = 0;
    static HEALTH_CHECK_INTERVAL = 30000; // 30s
    static toolIdsCache = {};
    static async getHealthyUrl() {
        const settings = await settings_service_1.SettingsService.getSettings();
        const configUrl = settings.lettaUrl || process.env.LETTA_API_URL;
        const candidates = [];
        if (configUrl)
            candidates.push(configUrl);
        candidates.push("http://localhost:8888");
        candidates.push("http://173.249.19.167:8888");
        const uniqueCandidates = Array.from(new Set(candidates.map(url => url.replace(/\/$/, ""))));
        const now = Date.now();
        if (this.activeApiUrl && (now - this.lastHealthCheckTime < this.HEALTH_CHECK_INTERVAL)) {
            return this.activeApiUrl;
        }
        if (this.activeApiUrl) {
            const idx = uniqueCandidates.indexOf(this.activeApiUrl);
            if (idx > -1) {
                uniqueCandidates.splice(idx, 1);
                uniqueCandidates.unshift(this.activeApiUrl);
            }
        }
        for (const url of uniqueCandidates) {
            try {
                console.log(`[LettaMemory] Checking health of Letta server: ${url}/v1/agents`);
                const client = new api_client_1.CoreApiClient({ baseURL: url, enforceApiPrefix: false });
                await client.get("/v1/agents", { timeout: 2000 });
                this.activeApiUrl = url;
                this.lastHealthCheckTime = now;
                console.log(`[LettaMemory] Healthy Letta server found and selected: ${url}`);
                return url;
            }
            catch (err) {
                console.log(`[LettaMemory] Letta server health check failed for ${url}: ${err.message}`);
            }
        }
        const fallbackUrl = uniqueCandidates[0] || "http://localhost:8888";
        console.warn(`[LettaMemory] All Letta servers failed health check. Fallback to default: ${fallbackUrl}`);
        return fallbackUrl;
    }
    /**
     * Helper gọi HTTP request tới Letta Server với cơ chế phòng vệ và HA Fallback
     */
    static async callLetta(endpoint, options = {}) {
        let baseUrl = await this.getHealthyUrl();
        const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        const settings = await settings_service_1.SettingsService.getSettings();
        const apiKey = settings.lettaApiKey || process.env.LETTA_API_KEY;
        const headers = {
            "Content-Type": "application/json",
        };
        if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
        }
        if (options.headers) {
            Object.assign(headers, options.headers);
        }
        const client = new api_client_1.CoreApiClient({ baseURL: baseUrl, enforceApiPrefix: false });
        try {
            const method = options.method?.toLowerCase() || "get";
            let response;
            if (method === "get") {
                response = await client.get(cleanEndpoint, { headers, timeout: 90000 });
            }
            else if (method === "post") {
                response = await client.post(cleanEndpoint, typeof options.body === 'string' ? JSON.parse(options.body) : options.body, { headers, timeout: 90000 });
            }
            else if (method === "patch") {
                response = await client.patch(cleanEndpoint, typeof options.body === 'string' ? JSON.parse(options.body) : options.body, { headers, timeout: 90000 });
            }
            else if (method === "delete") {
                response = await client.delete(cleanEndpoint, { headers, timeout: 90000 });
            }
            else {
                throw new Error(`Unsupported HTTP method: ${method}`);
            }
            return response;
        }
        catch (err) {
            console.error(`[LettaMemory] Letta API call to ${cleanEndpoint} failed:`, err.message);
            // Thử fallback sang server khác
            console.log(`[LettaMemory] Attempting to fallback and retry...`);
            this.activeApiUrl = null;
            this.lastHealthCheckTime = 0;
            const newBaseUrl = await this.getHealthyUrl();
            if (newBaseUrl !== baseUrl) {
                console.log(`[LettaMemory] Retrying with fallback server: ${newBaseUrl}`);
                const retryClient = new api_client_1.CoreApiClient({ baseURL: newBaseUrl, enforceApiPrefix: false });
                try {
                    const method = options.method?.toLowerCase() || "get";
                    let response;
                    if (method === "get") {
                        response = await retryClient.get(cleanEndpoint, { headers, timeout: 90000 });
                    }
                    else if (method === "post") {
                        response = await retryClient.post(cleanEndpoint, typeof options.body === 'string' ? JSON.parse(options.body) : options.body, { headers, timeout: 90000 });
                    }
                    else if (method === "patch") {
                        response = await retryClient.patch(cleanEndpoint, typeof options.body === 'string' ? JSON.parse(options.body) : options.body, { headers, timeout: 90000 });
                    }
                    else if (method === "delete") {
                        response = await retryClient.delete(cleanEndpoint, { headers, timeout: 90000 });
                    }
                    return response;
                }
                catch (retryErr) {
                    console.error(`[LettaMemory] Fallback Letta API call also failed:`, retryErr.message);
                    throw new Error(`Letta API call failed after fallback retry: ${retryErr.message}`);
                }
            }
            throw new Error(`Letta API call failed (${cleanEndpoint}): ${err.message}`);
        }
    }
    /**
     * Tạo Letta Agent chuyên biệt để làm bộ nhớ dài hạn cho một Universe Project
     */
    static async createAgentForProject(projectId, projectName) {
        console.log(`[LettaMemory] Đang khởi tạo Letta Agent cho Project: ${projectName} (${projectId})...`);
        const systemInstruction = `You are the Memory Vault Agent for the universe project "${projectName}". 
Your job is to store and maintain the World Bible, characters, settings, and props. 
When asked, retrieve details from your archival memory to ensure creative consistency.`;
        const payload = {
            name: `StoryMee_Universe_${projectId.slice(0, 8)}`,
            system: systemInstruction,
            model: "letta/letta-free", // Model mặc định dùng cho Letta Memory Agent
            memory: {
                blocks: [
                    {
                        label: "persona",
                        value: `You are the Memory Vault Agent for the universe project "${projectName}".`
                    },
                    {
                        label: "human",
                        value: "No human profile set."
                    }
                ]
            }
        };
        // Gọi Letta API tạo Agent (Hỗ trợ cả endpoint v1 và api)
        const result = await this.callLetta("/v1/agents", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        if (result && result.id) {
            console.log(`[LettaMemory] Đã tạo Letta Agent thành công. Agent ID: ${result.id}`);
            return result.id;
        }
        return null;
    }
    /**
     * Lấy hoặc khởi tạo tự động Letta Agent ID của Project (Lưu trong mô tả JSON metadata của Project)
     */
    static async getOrInitProjectAgentId(projectId) {
        try {
            const project = await prisma_1.prisma.project.findUnique({ where: { id: projectId } });
            if (!project)
                return null;
            let meta = {};
            if (project.description && project.description.trim().startsWith("{")) {
                try {
                    meta = JSON.parse(project.description);
                }
                catch (e) { }
            }
            else if (project.description) {
                meta.textDescription = project.description;
            }
            if (meta.lettaAgentId) {
                // Tự động attach tools để đảm bảo đầy đủ
                await this.attachToolsToAgent(meta.lettaAgentId);
                return meta.lettaAgentId;
            }
            // Nếu chưa có, tự động tạo Letta Agent mới
            const newAgentId = await this.createAgentForProject(projectId, project.name);
            if (newAgentId) {
                meta.lettaAgentId = newAgentId;
                // Cập nhật lại metadata vào description
                await prisma_1.prisma.project.update({
                    where: { id: projectId },
                    data: { description: JSON.stringify(meta, null, 2) },
                });
                await this.attachToolsToAgent(newAgentId);
                return newAgentId;
            }
        }
        catch (err) {
            console.error("[LettaMemory] Failed to get or init Letta Agent ID:", err.message);
        }
        return null;
    }
    /**
     * Xóa Agent ID đã lỗi thời khỏi metadata của Project trong database
     */
    static async clearStaleAgentId(projectId) {
        try {
            const project = await prisma_1.prisma.project.findUnique({ where: { id: projectId } });
            if (!project)
                return;
            let meta = {};
            if (project.description && project.description.trim().startsWith("{")) {
                try {
                    meta = JSON.parse(project.description);
                }
                catch (e) { }
            }
            else if (project.description) {
                meta.textDescription = project.description;
            }
            delete meta.lettaAgentId;
            await prisma_1.prisma.project.update({
                where: { id: projectId },
                data: { description: JSON.stringify(meta, null, 2) },
            });
            console.log(`[LettaMemory] Đã xóa stale Letta Agent ID của Project: ${projectId}`);
        }
        catch (err) {
            console.error("[LettaMemory] Failed to clear stale agent ID:", err.message);
        }
    }
    /**
     * Lưu trữ ký ức (Asset DNA) của Nhân vật, Bối cảnh hoặc Đạo cụ vào Letta Archival Memory
     */
    static async addAssetMemory(projectId, assetType, assetName, description) {
        let agentId = await this.getOrInitProjectAgentId(projectId);
        if (!agentId) {
            console.log(`[LettaMemory] Letta server offline hoặc không thể lấy Agent ID cho project. Bỏ qua lưu ký ức.`);
            return;
        }
        const memoryContent = `[WORLD BIBLE ASSET - ${assetType.toUpperCase()}]\n` +
            `Name: ${assetName}\n` +
            `Description/DNA:\n${description}\n` +
            `Timestamp: ${new Date().toISOString()}`;
        console.log(`[LettaMemory] Đang lưu ký ức cho asset "${assetName}" vào Letta Agent: ${agentId}`);
        try {
            // Ghi ký ức vào archival-memory của Agent
            await this.callLetta(`/v1/agents/${agentId}/archival-memory`, {
                method: "POST",
                body: JSON.stringify({ text: memoryContent }),
            });
        }
        catch (err) {
            // Tự phục hồi: Nếu lỗi 404 (Agent không tồn tại trên server)
            if (err.message.includes("status: 404") || err.message.includes("404")) {
                console.warn(`[LettaMemory] Agent ${agentId} trả về 404 (không tồn tại trên Letta Server). Tiến hành khởi tạo lại...`);
                await this.clearStaleAgentId(projectId);
                const newAgentId = await this.getOrInitProjectAgentId(projectId);
                if (newAgentId) {
                    console.log(`[LettaMemory] Đang thử lại lưu ký ức với Agent mới: ${newAgentId}`);
                    await this.callLetta(`/v1/agents/${newAgentId}/archival-memory`, {
                        method: "POST",
                        body: JSON.stringify({ text: memoryContent }),
                    });
                    return;
                }
            }
            throw err;
        }
    }
    /**
     * Truy vấn thông tin liên quan từ Letta Archival Memory (phục vụ cho viết truyện/kịch bản nhất quán)
     */
    static async queryProjectMemory(projectId, query) {
        const agentId = await this.getOrInitProjectAgentId(projectId);
        if (!agentId)
            return [];
        console.log(`[LettaMemory] Đang tìm kiếm ký ức cho dự án với query: "${query}"`);
        // Gửi yêu cầu tìm kiếm tới Letta archival-memory
        const result = await this.callLetta(`/v1/agents/${agentId}/archival-memory?query=${encodeURIComponent(query)}`, {
            method: "GET",
        });
        if (result && Array.isArray(result.results)) {
            return result.results.map((r) => r.text || "");
        }
        return [];
    }
    /**
     * Trò chuyện trực tiếp với Letta Agent để suy luận, thẩm định (QC)
     */
    static async chatWithAgent(projectId, message) {
        let agentId = await this.getOrInitProjectAgentId(projectId);
        if (!agentId) {
            throw new Error("Không thể khởi tạo hoặc tìm thấy Agent ID cho project.");
        }
        const payload = {
            messages: [
                {
                    role: "user",
                    content: message
                }
            ]
        };
        console.log(`[LettaMemory] Gửi tin nhắn chat tới Agent ${agentId}...`);
        try {
            const result = await this.callLetta(`/v1/agents/${agentId}/messages`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            let assistantReply = "";
            if (Array.isArray(result)) {
                const replies = result
                    .filter((msg) => msg.role === "assistant" && msg.content)
                    .map((msg) => msg.content);
                assistantReply = replies.join("\n");
            }
            else if (result && Array.isArray(result.messages)) {
                const replies = result.messages
                    .filter((msg) => msg.role === "assistant" && msg.content)
                    .map((msg) => msg.content);
                assistantReply = replies.join("\n");
            }
            else if (result && typeof result === "object") {
                assistantReply = result.content || result.text || JSON.stringify(result);
            }
            return assistantReply.trim();
        }
        catch (err) {
            // Tự phục hồi: Nếu lỗi 404 (Agent bị xóa hoặc mất trên server)
            if (err.message.includes("status: 404") || err.message.includes("404")) {
                console.warn(`[LettaMemory] Agent ${agentId} trả về 404 trong lúc chat. Đang khởi tạo lại...`);
                await this.clearStaleAgentId(projectId);
                const newAgentId = await this.getOrInitProjectAgentId(projectId);
                if (newAgentId) {
                    console.log(`[LettaMemory] Thử lại gửi tin nhắn chat tới Agent mới: ${newAgentId}`);
                    const retryResult = await this.callLetta(`/v1/agents/${newAgentId}/messages`, {
                        method: "POST",
                        body: JSON.stringify(payload)
                    });
                    let assistantReply = "";
                    if (Array.isArray(retryResult)) {
                        const replies = retryResult
                            .filter((msg) => msg.role === "assistant" && msg.content)
                            .map((msg) => msg.content);
                        assistantReply = replies.join("\n");
                    }
                    else if (retryResult && Array.isArray(retryResult.messages)) {
                        const replies = retryResult.messages
                            .filter((msg) => msg.role === "assistant" && msg.content)
                            .map((msg) => msg.content);
                        assistantReply = replies.join("\n");
                    }
                    else if (retryResult && typeof retryResult === "object") {
                        assistantReply = retryResult.content || retryResult.text || JSON.stringify(retryResult);
                    }
                    return assistantReply.trim();
                }
            }
            throw err;
        }
    }
    /**
     * Đăng ký 2 custom tools check_location_flow và audit_unregistered_assets lên Letta Server
     */
    static async registerCustomTools() {
        try {
            console.log("[LettaMemory] Checking and registering custom tools on Letta...");
            let existingTools = [];
            try {
                const res = await this.callLetta("/v1/tools", { method: "GET" });
                if (Array.isArray(res)) {
                    existingTools = res;
                }
                else if (res && Array.isArray(res.tools)) {
                    existingTools = res.tools;
                }
                else if (res && Array.isArray(res.results)) {
                    existingTools = res.results;
                }
            }
            catch (err) {
                console.warn(`[LettaMemory] Failed to list existing tools, will try to register anyway: ${err.message}`);
            }
            const toolsToRegister = [
                {
                    name: "check_location_flow",
                    description: "Check if the character can move directly from from_loc to to_loc based on the spatial graph.",
                    source_code: `def check_location_flow(from_loc: str, to_loc: str) -> str:
    """
    Check if the character can move directly from from_loc to to_loc based on the spatial graph.

    Args:
        from_loc (str): The starting location name.
        to_loc (str): The target location name.

    Returns:
        str: Instruction for the LLM to verify against the [SPATIAL_GRAPH] block in the core memory.
    """
    return f"Please check the [SPATIAL_GRAPH] block in your core memory (persona block) to verify if '{from_loc}' and '{to_loc}' are directly adjacent (connected). If they are not connected or if one of them is missing, return a detailed location drift error explaining that the character cannot move directly between these two locations. Otherwise, return 'LOCATION_OK'."`
                },
                {
                    name: "audit_unregistered_assets",
                    description: "Identify character, location, or prop entities in the scene text and verify if they are registered assets.",
                    source_code: `def audit_unregistered_assets(scene_text: str) -> str:
    """
    Identify character, location, or prop entities in the scene text and verify if they are registered assets.

    Args:
        scene_text (str): The text content of the scene.

    Returns:
        str: Instruction for the LLM to verify entities against the registered assets in core memory or archival memory.
    """
    return f"Please extract all characters, locations, and props mentioned in the following scene text: '{scene_text}'. Then, cross-reference them with the registered assets in your memory. If you find any unregistered assets, list them clearly. Otherwise, return 'ASSETS_OK'."`
                },
                {
                    name: "search_cinematic_knowledge",
                    description: "Search the Cinematic Knowledge Base (RAG) for camera angles, lighting presets, lore, or scripts.",
                    source_code: `def search_cinematic_knowledge(query: str, project_id: str, category: str = None) -> str:
    """
    Search the Cinematic Knowledge Base for camera angles, lighting, lore, or characters.

    Args:
        query (str): The search query (e.g., 'low angle lighting').
        project_id (str): The project ID to search within.
        category (str, optional): The category to filter (e.g., 'lore', 'character', 'shot_matrix').

    Returns:
        str: The search results from the RAG database.
    """
    import urllib.request
    import json
    
    url = "http://127.0.0.1:4500/api/agent/knowledge/cinematic/search"
    data = {"query": query, "projectId": project_id, "category": category}
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            if result.get("success"):
                return json.dumps(result.get("data", []))
            return "No results found."
    except Exception as e:
        return f"Error searching knowledge: {str(e)}"`
                }
            ];
            for (const t of toolsToRegister) {
                let existing = existingTools.find((et) => et.name === t.name);
                if (existing) {
                    console.log(`[LettaMemory] Tool "${t.name}" already registered on Letta server. ID: ${existing.id}`);
                    this.toolIdsCache[t.name] = existing.id;
                }
                else {
                    console.log(`[LettaMemory] Registering tool "${t.name}" on Letta server...`);
                    try {
                        const created = await this.callLetta("/v1/tools", {
                            method: "POST",
                            body: JSON.stringify({ source_code: t.source_code }),
                        });
                        if (created && created.id) {
                            console.log(`[LettaMemory] Successfully registered tool "${t.name}". ID: ${created.id}`);
                            this.toolIdsCache[t.name] = created.id;
                        }
                    }
                    catch (err) {
                        console.error(`[LettaMemory] Error registering tool "${t.name}":`, err.message);
                    }
                }
            }
        }
        catch (err) {
            console.error("[LettaMemory] Failed to register custom tools:", err.message);
        }
    }
    /**
     * Gán các custom tools vào Agent
     */
    static async attachToolsToAgent(agentId) {
        try {
            console.log(`[LettaMemory] Attaching custom tools to agent: ${agentId}`);
            if (Object.keys(this.toolIdsCache).length === 0) {
                await this.registerCustomTools();
            }
            for (const [toolName, toolId] of Object.entries(this.toolIdsCache)) {
                try {
                    console.log(`[LettaMemory] Attaching tool "${toolName}" (ID: ${toolId}) to agent ${agentId}...`);
                    await this.callLetta(`/v1/agents/${agentId}/tools/attach/${toolId}`, {
                        method: "PATCH",
                    });
                }
                catch (err) {
                    // Tránh bắn error làm gãy luồng nếu đã attach rồi
                    if (err.message.includes("already attached") || err.message.includes("409") || err.message.includes("400")) {
                        console.log(`[LettaMemory] Tool "${toolName}" already attached to agent ${agentId}.`);
                    }
                    else {
                        console.error(`[LettaMemory] Failed to attach tool ${toolName} to agent ${agentId}:`, err.message);
                    }
                }
            }
        }
        catch (err) {
            console.error(`[LettaMemory] Failed to attach tools to agent ${agentId}:`, err.message);
        }
    }
    /**
     * Cập nhật trực tiếp phân vùng Core Memory block (ví dụ: persona) của Letta Agent
     */
    static async updateAgentCoreMemory(projectId, blockLabel, value) {
        const agentId = await this.getOrInitProjectAgentId(projectId);
        if (!agentId) {
            console.warn(`[LettaMemory] Letta server offline hoặc không thể lấy Agent ID cho project. Bỏ qua update memory block.`);
            return null;
        }
        console.log(`[LettaMemory] Đang cập nhật Core Memory Block "${blockLabel}" cho Agent ${agentId}...`);
        try {
            return await this.callLetta(`/v1/agents/${agentId}/core-memory/blocks/${blockLabel}`, {
                method: "PATCH",
                body: JSON.stringify({ value }),
            });
        }
        catch (err) {
            console.error(`[LettaMemory] Lỗi khi cập nhật Core Memory Block ${blockLabel}:`, err.message);
            throw err;
        }
    }
}
exports.LettaMemoryService = LettaMemoryService;
