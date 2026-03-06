require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  liberty: {
    baseUrl: process.env.LIBERTY_BASE_URL,
    username: process.env.LIBERTY_USERNAME,
    password: process.env.LIBERTY_PASSWORD,
    npi: process.env.LIBERTY_NPI,
    apiKey: process.env.LIBERTY_API_KEY,
    get authHeader() {
      return 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
    },
    get customerHeader() {
      return Buffer.from(`${this.npi}:${this.apiKey}`).toString('base64');
    },
  },

  retell: {
    apiKey: process.env.RETELL_API_KEY,
    fromNumber: process.env.RETELL_FROM_NUMBER,
    agents: {
      'AI REFILL DUE': process.env.RETELL_AGENT_REFILL_DUE,
      'AI NEW RX COV': process.env.RETELL_AGENT_NEW_RX_COV,
      'AI NEW RX DED': process.env.RETELL_AGENT_NEW_RX_DED,
      'AI NEW RX NC': process.env.RETELL_AGENT_NEW_RX_NC,
      'AI NEW RX PA': process.env.RETELL_AGENT_NEW_RX_PA,
      'AI PA APPROVED': process.env.RETELL_AGENT_PA_APPROVED,
      'AI PA DENIED': process.env.RETELL_AGENT_PA_DENIED,
    },
  },

  pharmacy: {
    name: process.env.PHARMACY_NAME,
    phone: process.env.PHARMACY_PHONE,
  },

  storeHours: {
    timezone: process.env.STORE_TIMEZONE || 'America/Chicago',
    schedule: {
      0: null,                          // Sunday - closed
      1: { open: 9, close: 18 },        // Monday
      2: { open: 9, close: 18 },        // Tuesday
      3: { open: 9, close: 18 },        // Wednesday
      4: { open: 9, close: 18 },        // Thursday
      5: { open: 9, close: 18 },        // Friday
      6: null,                           // Saturday - closed
    },
  },

  // Outcome location mappings
  outcomes: {
    agreed: 'HEALNOW TEXT',
    declined: 'AI RTS',
    wants_doctor_contact: 'AI DOCTOR CHANGES',
    no_answer: null, // stays in retry queue
  },

  retry: {
    maxAttempts: 2,
    delayBusinessDays: 2,
    retryTime: 10, // 10:00 AM
  },
};

module.exports = config;
