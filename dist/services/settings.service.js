"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const redis_1 = require("../config/redis");
const SETTINGS_FILE_PATH = path_1.default.join(__dirname, '../config/global_settings.json');
const DEFAULT_SETTINGS = {
    hubUrl: process.env.STORYMEE_HUB_URL || 'http://storymee-hub:5100',
    hubApiKey: process.env.HUB_API_KEY || 'world-asset',
    sdkUrl: 'https://bapi.vidtory.net',
    sdkApiKey: '',
    promptProvider: 'cliproxy',
    mediaProvider: 'auto',
    universalNegativePrompt: '',
    gatewayType: 'hub',
    geminiApiKey: '',
    zlproxyKey: process.env.ZLPROXY_KEY || process.env.ZLPROXY_API_KEY || '',
    useZlproxyForGflow: false,
    useZlproxyForAIWorkers: true,
    activeProvider: 'google-native',
    llmProvider: 'google-native',
    imageProvider: 'hub',
    videoProvider: 'hub',
    hubLlmModel: 'gpt-5.4-mini',
    hubImageModel: 'google-flow',
    hubVideoModel: 'auto',
    sdkLlmModel: 'gemini-3-flash-preview',
    sdkImageModel: 'imagen-3',
    sdkVideoModel: 'veo-3.1-fast-generate-001',
    googleLlmModel: 'gemini-2.5-flash',
    googleImageModel: 'imagen-3.0-fast-002',
    googleVideoModel: 'veo-2.0-generate-001',
    disabledModels: [],
    mediaPool: 'internal',
    disableBullMqFallback: false,
    useLettaMemory: true,
    useLangGraphWorkflow: true
};
const DEFAULT_GEMINI_KEY = '';
class SettingsService {
    /**
     * Lấy cấu hình Global Settings hiện tại (ưu tiên Redis, fallback sang File cục bộ)
     */
    static async getSettings() {
        try {
            // 1. Thử đọc từ Redis cache để đạt tốc độ tối đa (với Timeout 2s để chống treo)
            const cached = await Promise.race([
                redis_1.redis.get('global:settings'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 2000))
            ]);
            if (cached) {
                const parsed = JSON.parse(cached);
                const merged = { ...DEFAULT_SETTINGS, ...parsed };
                // Override với biến môi trường để tránh conflict giữa Local và Prod dùng chung Redis
                if (process.env.STORYMEE_HUB_URL) {
                    merged.hubUrl = process.env.STORYMEE_HUB_URL;
                }
                return merged;
            }
        }
        catch (redisErr) {
            console.warn('[SettingsService] Failed to read from Redis, falling back to local file...', redisErr);
        }
        // 2. Fallback: Đọc từ tệp tin JSON cục bộ
        try {
            if (fs_1.default.existsSync(SETTINGS_FILE_PATH)) {
                const fileData = fs_1.default.readFileSync(SETTINGS_FILE_PATH, 'utf8');
                const parsed = JSON.parse(fileData);
                const merged = { ...DEFAULT_SETTINGS, ...parsed };
                // Cập nhật lại Redis cache
                try {
                    await redis_1.redis.set('global:settings', JSON.stringify(merged));
                }
                catch (redisWriteErr) {
                    console.warn('[SettingsService] Failed to cache settings in Redis:', redisWriteErr);
                }
                // Override với biến môi trường để tránh conflict giữa Local và Prod dùng chung Redis
                if (process.env.STORYMEE_HUB_URL) {
                    merged.hubUrl = process.env.STORYMEE_HUB_URL;
                }
                return merged;
            }
        }
        catch (fileErr) {
            console.error('[SettingsService] Failed to read local config file:', fileErr);
        }
        // 3. Fallback cuối cùng: Trả về giá trị mặc định từ biến môi trường
        return DEFAULT_SETTINGS;
    }
    /**
     * Cập nhật cấu hình Global Settings (lưu đồng thời vào Redis và File cục bộ)
     */
    static async updateSettings(newSettings) {
        const current = await this.getSettings();
        // Tự động map và đồng bộ các trường legacy
        const llmProvider = newSettings.llmProvider || current.llmProvider || newSettings.activeProvider || current.activeProvider || 'hub';
        const imageProvider = newSettings.imageProvider || current.imageProvider || newSettings.activeProvider || current.activeProvider || 'hub';
        const videoProvider = newSettings.videoProvider || current.videoProvider || newSettings.activeProvider || current.activeProvider || 'hub';
        const activeProvider = newSettings.activeProvider || current.activeProvider || llmProvider;
        let gatewayType = current.gatewayType;
        let promptProvider = current.promptProvider;
        let mediaProvider = current.mediaProvider;
        if (llmProvider === 'hub') {
            promptProvider = 'cliproxy';
        }
        else if (llmProvider === 'sdk') {
            promptProvider = 'vidtory-sdk';
        }
        else if (llmProvider === 'google-native') {
            promptProvider = 'gemini-native';
        }
        if (imageProvider === 'sdk' || videoProvider === 'sdk') {
            gatewayType = 'sdk';
            mediaProvider = 'vidtory-sdk';
        }
        else if (imageProvider === 'hub' || videoProvider === 'hub') {
            gatewayType = 'hub';
            mediaProvider = (newSettings.hubImageModel || current.hubImageModel || 'google-flow');
        }
        const updated = {
            hubUrl: newSettings.hubUrl || current.hubUrl,
            hubApiKey: newSettings.hubApiKey || current.hubApiKey,
            sdkUrl: newSettings.sdkUrl !== undefined ? newSettings.sdkUrl : current.sdkUrl,
            sdkApiKey: newSettings.sdkApiKey !== undefined ? newSettings.sdkApiKey : current.sdkApiKey,
            promptProvider,
            mediaProvider,
            universalNegativePrompt: newSettings.universalNegativePrompt !== undefined ? newSettings.universalNegativePrompt : current.universalNegativePrompt,
            gatewayType,
            geminiApiKey: newSettings.geminiApiKey || current.geminiApiKey || '',
            zlproxyKey: newSettings.zlproxyKey !== undefined ? newSettings.zlproxyKey : current.zlproxyKey,
            useZlproxyForGflow: newSettings.useZlproxyForGflow !== undefined ? newSettings.useZlproxyForGflow : current.useZlproxyForGflow,
            useZlproxyForAIWorkers: newSettings.useZlproxyForAIWorkers !== undefined ? newSettings.useZlproxyForAIWorkers : current.useZlproxyForAIWorkers,
            activeProvider,
            llmProvider,
            imageProvider,
            videoProvider,
            hubLlmModel: newSettings.hubLlmModel || current.hubLlmModel || 'gpt-5.4-mini',
            hubImageModel: newSettings.hubImageModel || current.hubImageModel || 'auto',
            hubVideoModel: newSettings.hubVideoModel || current.hubVideoModel || 'auto',
            sdkLlmModel: newSettings.sdkLlmModel || current.sdkLlmModel || 'gemini-3-flash-preview',
            sdkImageModel: newSettings.sdkImageModel || current.sdkImageModel || 'imagen-3',
            sdkVideoModel: newSettings.sdkVideoModel || current.sdkVideoModel || 'veo-3.1-fast-generate-001',
            googleLlmModel: newSettings.googleLlmModel || current.googleLlmModel || 'gemini-2.5-flash',
            googleImageModel: newSettings.googleImageModel || current.googleImageModel || 'imagen-3.0-fast-002',
            googleVideoModel: newSettings.googleVideoModel || current.googleVideoModel || 'veo-2.0-generate-001',
            disabledModels: newSettings.disabledModels !== undefined ? newSettings.disabledModels : (current.disabledModels || []),
            disableBullMqFallback: newSettings.disableBullMqFallback !== undefined ? newSettings.disableBullMqFallback : current.disableBullMqFallback,
            useLettaMemory: newSettings.useLettaMemory !== undefined ? newSettings.useLettaMemory : (current.useLettaMemory !== undefined ? current.useLettaMemory : true),
            useLangGraphWorkflow: newSettings.useLangGraphWorkflow !== undefined ? newSettings.useLangGraphWorkflow : (current.useLangGraphWorkflow !== undefined ? current.useLangGraphWorkflow : true)
        };
        // 1. Lưu vào tệp tin JSON cục bộ để persist bền vững
        try {
            const dir = path_1.default.dirname(SETTINGS_FILE_PATH);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), 'utf8');
        }
        catch (fileErr) {
            console.error('[SettingsService] Failed to write local config file:', fileErr);
        }
        // 2. Lưu vào Redis để truyền dữ liệu realtime cho microservices
        try {
            await Promise.race([
                redis_1.redis.set('global:settings', JSON.stringify(updated)),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Redis set timeout')), 2000))
            ]);
            console.log('[SettingsService] Global settings synchronized to Redis successfully');
        }
        catch (redisErr) {
            console.error('[SettingsService] Failed to set settings in Redis:', redisErr);
        }
        return updated;
    }
}
exports.SettingsService = SettingsService;
