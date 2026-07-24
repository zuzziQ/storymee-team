"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = void 0;
const billing_service_1 = require("../services/billing.service");
class BillingController {
    static async getApiKeys(req, res, next) {
        try {
            const keys = await billing_service_1.BillingService.getApiKeys();
            res.status(200).json({ status: 'success', data: keys });
        }
        catch (error) {
            next(error);
        }
    }
    static async createApiKey(req, res, next) {
        try {
            const { name, quotaLimitUsd, workerType, maxAccountSlots } = req.body;
            if (!name) {
                return res.status(400).json({ status: 'error', message: 'Name is required' });
            }
            const apiKey = await billing_service_1.BillingService.createApiKey(name, quotaLimitUsd, workerType, maxAccountSlots);
            res.status(201).json({
                status: 'success',
                data: apiKey
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async toggleApiKey(req, res, next) {
        try {
            const { id } = req.params;
            const { isActive } = req.body;
            const updated = await billing_service_1.BillingService.toggleApiKey(id, Boolean(isActive));
            res.status(200).json({ status: 'success', data: updated });
        }
        catch (error) {
            next(error);
        }
    }
    static async topUpApiKey(req, res, next) {
        try {
            const { id } = req.params;
            const { amountUsd } = req.body;
            const updated = await billing_service_1.BillingService.topUpApiKey(id, Number(amountUsd));
            res.status(200).json({ status: 'success', data: updated });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateMaxSlots(req, res, next) {
        try {
            const { id } = req.params;
            const { maxAccountSlots } = req.body;
            const updated = await billing_service_1.BillingService.updateMaxSlots(id, Number(maxAccountSlots));
            res.status(200).json({ status: 'success', data: updated });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteApiKey(req, res, next) {
        try {
            const { id } = req.params;
            await billing_service_1.BillingService.deleteApiKey(id);
            res.status(200).json({ status: 'success', message: 'Deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async syncKeys(req, res, next) {
        try {
            await billing_service_1.BillingService.syncAllKeysToRedis();
            res.status(200).json({
                status: 'success',
                message: 'All active API keys synchronized to Redis.'
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async migrateSupabaseKeys(req, res, next) {
        try {
            const results = await billing_service_1.BillingService.migrateSupabaseKeys();
            res.status(200).json({
                status: 'success',
                message: `Migrated ${results.length} keys from Supabase to Postgres.`,
                data: results
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.BillingController = BillingController;
