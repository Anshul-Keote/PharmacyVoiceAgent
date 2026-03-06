const express = require('express');
const router = express.Router();
const outcomeProcessor = require('../services/outcome-processor');
const callStore = require('../services/call-store');

/**
 * POST /webhooks/retell
 * Receives post-call webhooks from Retell AI (call_ended, call_analyzed)
 */
router.post('/', async (req, res) => {
  try {
    const payload = req.body;
    const event = payload.event;

    console.log(`[Retell Webhook] Received event: ${event}`);

    // We only care about call_analyzed (has structured analysis data)
    if (event === 'call_started') {
      return res.status(200).json({ status: 'acknowledged' });
    }

    if (event === 'call_ended') {
      // call_ended fires before analysis is ready, just acknowledge
      return res.status(200).json({ status: 'acknowledged' });
    }

    if (event === 'call_analyzed') {
      const callData = payload.call;

      if (!callData) {
        console.error('[Retell Webhook] Missing call data in call_analyzed');
        return res.status(400).json({ error: 'Missing call data' });
      }

      // Store call data for dashboard
      callStore.addCall(callData);

      // Respond immediately
      res.status(200).json({ status: 'accepted' });

      // Process outcome in background
      outcomeProcessor.processCallOutcome(callData).catch(err => {
        console.error(`[Retell Webhook] Outcome processing failed: ${err.message}`);
      });

      return;
    }

    // Unknown event
    console.log(`[Retell Webhook] Unknown event: ${event}`);
    res.status(200).json({ status: 'ignored' });
  } catch (err) {
    console.error(`[Retell Webhook] Error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
