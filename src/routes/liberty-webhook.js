const express = require('express');
const router = express.Router();
const orchestrator = require('../services/orchestrator');

/**
 * POST /webhooks/liberty
 * Receives WorkflowLocationChange events from Liberty subscription
 */
router.post('/', async (req, res) => {
  try {
    const payload = req.body;

    console.log(`[Liberty Webhook] Received:`, JSON.stringify(payload));

    // Extract data from Liberty webhook payload
    const scriptNo = payload.ScriptNo || payload.scriptNo;
    const fillNo = payload.FillNo || payload.fillNo || '0';
    const workflowLocation = payload.NewLocation || payload.newLocation || payload.Location;

    if (!scriptNo || !workflowLocation) {
      console.error('[Liberty Webhook] Missing scriptNo or workflowLocation');
      return res.status(400).json({ error: 'Missing required fields: ScriptNo, NewLocation' });
    }

    // Only process AI workflow locations
    const validLocations = [
      'AI REFILL DUE',
      'AI NEW RX COV',
      'AI NEW RX DED',
      'AI NEW RX NC',
      'AI NEW RX PA',
      'AI PA APPROVED',
      'AI PA DENIED',
    ];

    if (!validLocations.includes(workflowLocation)) {
      console.log(`[Liberty Webhook] Ignoring non-AI location: ${workflowLocation}`);
      return res.status(200).json({ status: 'ignored', reason: 'not_ai_location' });
    }

    // Respond immediately, process async
    res.status(200).json({ status: 'accepted' });

    // Process in background
    orchestrator.processWebhook({ scriptNo, fillNo, workflowLocation }).catch(err => {
      console.error(`[Liberty Webhook] Processing failed: ${err.message}`);
    });
  } catch (err) {
    console.error(`[Liberty Webhook] Error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
