import axios from 'axios';

export async function fetchAxios(url: string, options: any = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  let data = options.body;
  
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch(e) {}
  }

  try {
    const res = await axios({
      url,
      method,
      headers,
      data,
      timeout: options.timeout || 60000,
      signal: options.signal,
      responseType: options.body?.includes('stream') ? 'stream' : undefined
    });
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      statusText: res.statusText,
      json: async () => res.data,
      text: async () => typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
      body: res.data // For stream
    };
  } catch (error: any) {
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
