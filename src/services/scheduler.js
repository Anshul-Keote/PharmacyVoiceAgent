const config = require('../config');

// In-memory queues
const callQueue = [];    // Calls queued outside store hours
const retryQueue = [];   // No-answer retries

/**
 * Check if current time is during store hours
 */
function isDuringStoreHours() {
  const now = getNowInTimezone();
  const daySchedule = config.storeHours.schedule[now.getDay()];

  if (!daySchedule) return false; // Closed today

  const currentHour = now.getHours() + now.getMinutes() / 60;
  return currentHour >= daySchedule.open && currentHour < daySchedule.close;
}

/**
 * Queue a call for when store opens
 */
function queueCall(callData) {
  callQueue.push({
    ...callData,
    queuedAt: new Date().toISOString(),
  });
  console.log(`[Scheduler] Call queued. Queue size: ${callQueue.length}`);
}

/**
 * Schedule a retry for a no-answer call
 */
function scheduleRetry(retryData) {
  const retryDate = getNextBusinessDay(config.retry.delayBusinessDays);
  retryQueue.push({
    ...retryData,
    scheduledFor: retryDate.toISOString(),
    scheduledAt: new Date().toISOString(),
  });
  console.log(`[Scheduler] Retry scheduled for ${retryDate.toISOString()}. Retry queue size: ${retryQueue.length}`);
}

/**
 * Process queued calls (run when store opens)
 */
async function processQueuedCalls() {
  if (!isDuringStoreHours()) return;
  if (callQueue.length === 0) return;

  console.log(`[Scheduler] Processing ${callQueue.length} queued calls`);

  // Lazy require to avoid circular dependency
  const orchestrator = require('./orchestrator');

  while (callQueue.length > 0) {
    const call = callQueue.shift();
    try {
      await orchestrator.processWebhook(call);
    } catch (err) {
      console.error(`[Scheduler] Failed to process queued call: ${err.message}`);
    }
  }
}

/**
 * Process retry queue (runs hourly)
 */
async function processRetries() {
  if (!isDuringStoreHours()) return;
  if (retryQueue.length === 0) return;

  const now = new Date();
  const nowHour = getNowInTimezone().getHours();

  // Only process retries at the configured retry time (10 AM)
  if (nowHour < config.retry.retryTime) return;

  console.log(`[Scheduler] Checking ${retryQueue.length} retries`);

  const orchestrator = require('./orchestrator');
  const remaining = [];

  for (const retry of retryQueue) {
    const scheduledDate = new Date(retry.scheduledFor);

    if (now >= scheduledDate) {
      try {
        console.log(`[Scheduler] Retrying: Script ${retry.scriptNo}, attempt ${retry.attempt}`);
        await orchestrator.processWebhook({
          scriptNo: retry.scriptNo,
          fillNo: retry.fillNo,
          workflowLocation: retry.workflowLocation,
          attempt: retry.attempt,
        });
      } catch (err) {
        console.error(`[Scheduler] Retry failed: ${err.message}`);
      }
    } else {
      remaining.push(retry);
    }
  }

  retryQueue.length = 0;
  retryQueue.push(...remaining);
}

/**
 * Get next business day, N business days from now
 */
function getNextBusinessDay(daysAhead) {
  const date = getNowInTimezone();
  let count = 0;

  while (count < daysAhead) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    const schedule = config.storeHours.schedule[day];
    if (schedule) count++; // Only count days the store is open
  }

  // Set to retry time
  date.setHours(config.retry.retryTime, 0, 0, 0);
  return date;
}

/**
 * Get current time in store timezone
 */
function getNowInTimezone() {
  const nowStr = new Date().toLocaleString('en-US', { timeZone: config.storeHours.timezone });
  return new Date(nowStr);
}

/**
 * Start the scheduler intervals
 */
let queueInterval = null;
let retryInterval = null;

function start() {
  // Check queued calls every 5 minutes
  queueInterval = setInterval(processQueuedCalls, 5 * 60 * 1000);
  // Check retries every hour
  retryInterval = setInterval(processRetries, 60 * 60 * 1000);

  console.log(`[Scheduler] Started (timezone: ${config.storeHours.timezone})`);

  // Run immediately on start
  processQueuedCalls();
  processRetries();
}

function stop() {
  if (queueInterval) clearInterval(queueInterval);
  if (retryInterval) clearInterval(retryInterval);
  console.log('[Scheduler] Stopped');
}

/**
 * Get queue stats (for health check / debugging)
 */
function getStats() {
  return {
    queuedCalls: callQueue.length,
    pendingRetries: retryQueue.length,
    isDuringStoreHours: isDuringStoreHours(),
  };
}

module.exports = {
  isDuringStoreHours,
  queueCall,
  scheduleRetry,
  processQueuedCalls,
  processRetries,
  start,
  stop,
  getStats,
};
