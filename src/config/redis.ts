export const redis = {
  get: async (key: string) => null,
  set: async (key: string, val: string) => "OK",
  del: async (key: string) => 1,
  pipeline: () => ({
    get: (key: string) => ({}),
    set: (key: string, val: string) => ({}),
    del: (key: string) => ({}),
    exec: async () => []
  })
};
