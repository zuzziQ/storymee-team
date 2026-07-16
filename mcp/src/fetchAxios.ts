import axios from 'axios';
import https from 'https';
import http from 'http';

const httpsAgent = new https.Agent({ family: 4 });
const httpAgent = new http.Agent({ family: 4 });

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
      responseType: (typeof options.body === 'string' && options.body.includes('stream')) ? 'stream' : undefined,
      httpsAgent,
      httpAgent,
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
