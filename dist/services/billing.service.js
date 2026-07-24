"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const prisma_1 = require("../config/prisma");
const redis_1 = require("../config/redis");
class BillingService {
    static async getApiKeys() {
        return await prisma_1.prisma.hubApiKey.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }
    /**
     * Tạo một API Key mới trong Postgres và đồng bộ ngay sang Redis
     */
    static async createApiKey(name, quotaLimitUsd = 10.0, workerType, maxAccountSlots) {
        // Prefix theo loại khóa để phân biệt rõ ràng:
        // - sk-worker-{type}-  → Worker Key (cấp phát slots, không tính phí)
        // - sk-hub-            → Hub API Key (billing, tính phí)
        const randomSuffix = `${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
        const prefix = workerType ? `sk-worker-${workerType}-` : 'sk-hub-';
        const rawKey = `${prefix}${randomSuffix}`;
        const apiKeyRecord = await prisma_1.prisma.hubApiKey.create({
            data: {
                name,
                apiKey: rawKey,
                quotaLimitUsd,
                currentSpendUsd: 0.0,
                isActive: true,
                workerType,
                maxAccountSlots
            }
        });
        await this.syncKeyToRedis(apiKeyRecord);
        return apiKeyRecord;
    }
    /**
     * Helper: Đồng bộ 1 record sang Redis
     */
    static async syncKeyToRedis(apiKeyRecord) {
        const redisKey = `apikey:${apiKeyRecord.apiKey}`;
        if (!apiKeyRecord.isActive) {
            await redis_1.redis.del(redisKey);
        }
        else {
            await redis_1.redis.set(redisKey, JSON.stringify({
                id: apiKeyRecord.id,
                is_active: apiKeyRecord.isActive,
                quota_limit_usd: apiKeyRecord.quotaLimitUsd,
                current_spend_usd: apiKeyRecord.currentSpendUsd,
                worker_type: apiKeyRecord.workerType,
                max_account_slots: apiKeyRecord.maxAccountSlots
            }));
        }
    }
    /**
     * Bật / Tắt API Key
     */
    static async toggleApiKey(id, isActive) {
        const updatedKey = await prisma_1.prisma.hubApiKey.update({
            where: { id },
            data: { isActive }
        });
        await this.syncKeyToRedis(updatedKey);
        return updatedKey;
    }
    /**
     * Top-up tiền
     */
    static async topUpApiKey(id, amountUsd) {
        const updatedKey = await prisma_1.prisma.hubApiKey.update({
            where: { id },
            data: { quotaLimitUsd: { increment: amountUsd } }
        });
        await this.syncKeyToRedis(updatedKey);
        return updatedKey;
    }
    /**
     * Cập nhật maxAccountSlots
     */
    static async updateMaxSlots(id, maxAccountSlots) {
        const updatedKey = await prisma_1.prisma.hubApiKey.update({
            where: { id },
            data: { maxAccountSlots }
        });
        await this.syncKeyToRedis(updatedKey);
        return updatedKey;
    }
    /**
     * Xóa API Key
     */
    static async deleteApiKey(id) {
        const keyRecord = await prisma_1.prisma.hubApiKey.findUnique({ where: { id } });
        if (!keyRecord)
            throw new Error("API Key not found");
        await prisma_1.prisma.hubApiKey.delete({ where: { id } });
        await redis_1.redis.del(`apikey:${keyRecord.apiKey}`);
    }
    /**
     * Trừ tiền (deduct) credit sau khi chạy xong job
     */
    static async deductCredit(apiKeyStr, costUsd, logDetails) {
        const keyRecord = await prisma_1.prisma.hubApiKey.findUnique({
            where: { apiKey: apiKeyStr }
        });
        if (!keyRecord)
            throw new Error("API Key not found");
        const [updatedKey, usageLog] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.hubApiKey.update({
                where: { id: keyRecord.id },
                data: { currentSpendUsd: { increment: costUsd } }
            }),
            prisma_1.prisma.hubUsageLog.create({
                data: {
                    keyId: keyRecord.id,
                    costUsd,
                    ...logDetails
                }
            })
        ]);
        await this.syncKeyToRedis(updatedKey);
        return usageLog;
    }
    /**
     * Hàm dùng một lần (Script) để đồng bộ lại toàn bộ API Key từ DB sang Redis
     */
    static async syncAllKeysToRedis() {
        const allKeys = await prisma_1.prisma.hubApiKey.findMany({
            where: { isActive: true }
        });
        const pipeline = redis_1.redis.pipeline();
        // Clear all old keys first to avoid stale data (optional but safer if you want a clean sync)
        // Since we don't know the keys, we just overwrite active ones.
        for (const k of allKeys) {
            pipeline.set(`apikey:${k.apiKey}`, JSON.stringify({
                id: k.id,
                is_active: k.isActive,
                quota_limit_usd: Number(k.quotaLimitUsd),
                current_spend_usd: Number(k.currentSpendUsd),
                worker_type: k.workerType,
                max_account_slots: k.maxAccountSlots
            }));
        }
        await pipeline.exec();
        console.log(`[BillingService] Synced ${allKeys.length} active keys to Redis.`);
    }
    /**
     * Migrate keys from Supabase to Postgres (One-time use)
     */
    static async migrateSupabaseKeys() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
        }
        const response = await globalThis.fetch(`${supabaseUrl}/rest/v1/cp_hub_api_keys`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch from Supabase: ${response.statusText}`);
        }
        const supabaseKeys = await response.json();
        const results = [];
        for (const sk of supabaseKeys) {
            // Check if key already exists
            const existing = await prisma_1.prisma.hubApiKey.findUnique({
                where: { apiKey: sk.api_key }
            });
            if (!existing) {
                const inserted = await prisma_1.prisma.hubApiKey.create({
                    data: {
                        name: sk.name || 'Migrated Key',
                        apiKey: sk.api_key,
                        quotaLimitUsd: sk.quota_limit_usd || 10.0,
                        currentSpendUsd: sk.current_spend_usd || 0.0,
                        isActive: sk.is_active !== false,
                        workerType: sk.worker_type || null,
                        maxAccountSlots: sk.max_account_slots || null
                    }
                });
                results.push(inserted);
            }
        }
        // Sync to Redis after migration
        await this.syncAllKeysToRedis();
        return results;
    }
}
exports.BillingService = BillingService;
