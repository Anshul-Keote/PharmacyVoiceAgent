const express = require('express');
const config = require('./config');
const scheduler = require('./services/scheduler');
const libertyWebhook = require('./routes/liberty-webhook');
const retellWebhook = require('./routes/retell-webhook');

const app = express();

// Parse JSON bodies
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: config.nodeEnv,
    scheduler: scheduler.getStats(),
  });
});

// Webhook routes
app.use('/webhooks/liberty', libertyWebhook);
app.use('/webhooks/retell', retellWebhook);

// Serve static pages
const path = require('path');
const callStore = require('./services/call-store');

app.get('/test-call', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test-call.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dashboard.html'));
});

// Dashboard API
app.get('/api/calls', (req, res) => {
  res.json(callStore.getCalls());
});

app.get('/api/stats', (req, res) => {
  res.json({
    ...callStore.getStats(),
    scheduler: scheduler.getStats(),
  });
});

// Dev-only: test trigger endpoint
if (config.nodeEnv === 'development') {
  const orchestrator = require('./services/orchestrator');

  app.post('/test/trigger-call', async (req, res) => {
    try {
      const { scriptNumber, refillNumber, workflowLocation } = req.body;

      if (!scriptNumber || !workflowLocation) {
        return res.status(400).json({ error: 'Missing scriptNumber or workflowLocation' });
      }

      const result = await orchestrator.processWebhook({
        scriptNo: scriptNumber,
        fillNo: refillNumber || '0',
        workflowLocation,
      });

      res.json(result);
    } catch (err) {
      console.error(`[Test] Trigger failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Dev: trigger outbound phone call
  app.post('/test/phone-call', async (req, res) => {
    try {
      const { phoneNumber, agentType } = req.body;
      if (!phoneNumber) return res.status(400).json({ error: 'Missing phoneNumber' });

      const agentId = agentType === 'new_rx'
        ? config.retell.agents['AI NEW RX COV']
        : config.retell.agents['AI REFILL DUE'];

      const retellRes = await fetch('https://api.retellai.com/v2/create-phone-call', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + config.retell.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_number: config.retell.fromNumber,
          to_number: phoneNumber,
          agent_id: agentId,
          retell_llm_dynamic_variables: {
            patient_first_name: 'Test Patient',
            patient_dob: '12/05/2003',
            patient_age: '22',
            drug_name: agentType === 'new_rx' ? 'Eliquis' : 'Lisinopril',
            drug_name_full: agentType === 'new_rx' ? 'Eliquis 5mg Tablets' : 'Lisinopril 10mg Tablets',
            copay: agentType === 'new_rx' ? '$45.00' : '$15.00',
            pharmacy_name: config.pharmacy.name,
            pharmacy_phone: config.pharmacy.phone,
            sub_group: 'commercial_no_rebate',
          },
        }),
      });
      const data = await retellRes.json();
      console.log('[Test] Phone call triggered:', data.call_id || data);
      res.json(data);
    } catch (err) {
      console.error('[Test] Phone call failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Dev: check Liberty API connection
  app.get('/test/liberty', async (req, res) => {
    try {
      const liberty = require('./services/liberty');
      const locations = await liberty.getWorkflowLocations();
      res.json({ status: 'connected', locations });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
}

module.exports = app;
