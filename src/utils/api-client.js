const fetch = require('node-fetch');

async function apiRequest(url, options = {}) {
  const method = options.method || 'GET';
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const duration = Date.now() - startTime;
    const logLine = `${method} ${url} → ${response.status} (${duration}ms)`;

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`${logLine} | Error: ${errorBody}`);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    console.log(logLine);

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  } catch (err) {
    if (err.message.startsWith('API request failed')) throw err;
    console.error(`${method} ${url} → FAILED (${Date.now() - startTime}ms) | ${err.message}`);
    throw err;
  }
}

module.exports = { apiRequest };
