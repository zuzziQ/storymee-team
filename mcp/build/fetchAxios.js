"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAxios = fetchAxios;
const axios_1 = __importDefault(require("axios"));
async function fetchAxios(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = options.headers || {};
    let data = options.body;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        }
        catch (e) { }
    }
    try {
        const res = await (0, axios_1.default)({
            url,
            method,
            headers,
            data,
            timeout: options.timeout || 60000,
            signal: options.signal,
            responseType: (typeof options.body === 'string' && options.body.includes('stream')) ? 'stream' : undefined
        });
        return {
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            statusText: res.statusText,
            json: async () => res.data,
            text: async () => typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
            body: res.data // For stream
        };
    }
    catch (error) {
        if (error.response) {
            return {
                ok: false,
                status: error.response.status,
                statusText: error.response.statusText,
                json: async () => error.response.data,
                text: async () => typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data),
                body: null
            };
        }
        throw error;
    }
}
