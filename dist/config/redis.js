"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.redis = {
    get: async (key) => null,
    set: async (key, val) => "OK",
    del: async (key) => 1,
    pipeline: () => ({
        get: (key) => ({}),
        set: (key, val) => ({}),
        del: (key) => ({}),
        exec: async () => []
    })
};
