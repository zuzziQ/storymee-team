const axios = require('axios');
async function run() {
  try {
    await axios.post('http://192.168.255.255:9999', {}, { timeout: 15000 });
  } catch (err) {
    console.log("Axios error message:", err.message);
    if (err.cause) console.log("Axios error cause:", err.cause.message);
  }
}
run();
