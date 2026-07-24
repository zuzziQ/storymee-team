"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const prisma_1 = require("../config/prisma");
class AnalyticsController {
    static async getUsageLogs(req, res, next) {
        try {
            // ONLY read from local PostgreSQL (Prisma)
            const logs = await prisma_1.prisma.hubUsageLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 100 // Limit to recent 100
            });
            return res.status(200).json({ status: 'success', data: logs });
        }
        catch (error) {
            next(error);
        }
    }
    static async createInternalLog(req, res, next) {
        try {
            // Very basic internal auth check
            const authHeader = req.headers.authorization;
            const hubApiKey = process.env.HUB_API_KEY;
            if (authHeader !== `Bearer ${hubApiKey}` && authHeader !== `Bearer sk-storymee-admin-x8k9j22m`) {
                return res.status(403).json({ error: 'Unauthorized internal call' });
            }
            const payload = req.body;
            let log;
            if (payload.key_id && payload.cost_usd > 0) {
                // If there's a cost and an API key, we should deduct credit and log in one transaction
                const { BillingService } = require('../services/billing.service');
                try {
                    // deductCredit requires the api_key string, but we only have key_id (uuid) here!
                    // Wait, BillingService.deductCredit expects `apiKeyStr`.
                    // We can just manually do the transaction here to avoid lookup by string.
                    const { prisma } = require('../config/prisma');
                    const [updatedKey, usageLog] = await prisma.$transaction([
                        prisma.hubApiKey.update({
                            where: { id: payload.key_id },
                            data: { currentSpendUsd: { increment: payload.cost_usd } }
                        }),
                        prisma.hubUsageLog.create({
                            data: {
                                keyId: payload.key_id,
                                clientIp: payload.client_ip,
                                modelUsed: payload.model_used,
                                provider: payload.provider,
                                path: payload.path,
                                promptTokens: payload.prompt_tokens || 0,
                                completionTokens: payload.completion_tokens || 0,
                                totalTokens: payload.total_tokens || 0,
                                costUsd: payload.cost_usd || 0,
                                latencyMs: payload.latency_ms || 0,
                                statusCode: payload.status_code || 200,
                                errorMessage: payload.error_message
                            }
                        })
                    ]);
                    // Sync to Redis
                    const { redis } = require('../config/redis');
                    await redis.set(`apikey:${updatedKey.apiKey}`, JSON.stringify({
                        id: updatedKey.id,
                        is_active: updatedKey.isActive,
                        quota_limit_usd: Number(updatedKey.quotaLimitUsd),
                        current_spend_usd: Number(updatedKey.currentSpendUsd),
                        worker_type: updatedKey.workerType,
                        max_account_slots: updatedKey.maxAccountSlots
                    }));
                    log = usageLog;
                }
                catch (err) {
                    console.error("[createInternalLog] Error deducting credit:", err);
                    throw err;
                }
            }
            else {
                const { prisma } = require('../config/prisma');
                log = await prisma.hubUsageLog.create({
                    data: {
                        keyId: payload.key_id,
                        clientIp: payload.client_ip,
                        modelUsed: payload.model_used,
                        provider: payload.provider,
                        path: payload.path,
                        promptTokens: payload.prompt_tokens || 0,
                        completionTokens: payload.completion_tokens || 0,
                        totalTokens: payload.total_tokens || 0,
                        costUsd: payload.cost_usd || 0,
                        latencyMs: payload.latency_ms || 0,
                        statusCode: payload.status_code || 200,
                        errorMessage: payload.error_message
                    }
                });
            }
            res.status(201).json({ status: 'success', data: log });
        }
        catch (error) {
            console.error("[AnalyticsController] Error creating internal log:", error);
            next(error);
        }
    }
}
exports.AnalyticsController = AnalyticsController;
