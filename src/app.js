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
