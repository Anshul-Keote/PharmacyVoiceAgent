const liberty = require('./liberty');
const retell = require('./retell');
const scheduler = require('./scheduler');

/**
 * Main orchestration: Liberty webhook → data pull → sub-group detect → trigger call
 */
async function processWebhook({ scriptNo, fillNo, workflowLocation }) {
  console.log(`[Orchestrator] Processing: Script ${scriptNo}, Fill ${fillNo}, Location: ${workflowLocation}`);

  // 1. Get the agent for this workflow location
  const agentId = retell.getAgentForLocation(workflowLocation);
  if (!agentId) {
    console.error(`[Orchestrator] No agent mapped for location: ${workflowLocation}`);
    return { success: false, reason: 'no_agent_mapped' };
  }

  // 2. Pull prescription data
  const rxData = await liberty.getPrescription(scriptNo);
  if (!rxData) {
    console.error(`[Orchestrator] Prescription not found: ${scriptNo}`);
    return { success: false, reason: 'rx_not_found' };
  }

  // 3. Pull fill data
  const fillData = await liberty.getPrescriptionFill(scriptNo, fillNo || '0');

  // 4. Pull patient data
  const patientId = rxData.PatientId;
  if (!patientId) {
    console.error(`[Orchestrator] No PatientId on prescription: ${scriptNo}`);
    return { success: false, reason: 'no_patient_id' };
  }

  const patient = await liberty.getPatient(patientId);
  if (!patient) {
    console.error(`[Orchestrator] Patient not found: ${patientId}`);
    return { success: false, reason: 'patient_not_found' };
  }

  // 5. Safety checks
  const phoneNumber = patient.Phone || patient.Phone2 || '';
  if (!liberty.isValidPhone(phoneNumber)) {
    console.error(`[Orchestrator] Invalid phone for patient ${patientId}: ${phoneNumber ? 'too short' : 'missing'}`);
    return { success: false, reason: 'invalid_phone' };
  }

  // 6. Check store hours - queue if outside hours
  if (!scheduler.isDuringStoreHours()) {
    console.log(`[Orchestrator] Outside store hours, queueing call`);
    scheduler.queueCall({ scriptNo, fillNo, workflowLocation, patientId });
    return { success: true, queued: true, reason: 'outside_store_hours' };
  }

  // 7. Detect sub-group
  const subGroup = liberty.detectSubGroup(fillData);
  console.log(`[Orchestrator] Sub-group detected: ${subGroup}`);

  // 8. Build dynamic variables
  const dynamicVariables = retell.buildDynamicVariables({
    patient,
    fillData,
    rxData,
    subGroup,
  });

  // 9. Format phone number for Retell (E.164)
  const formattedPhone = formatPhoneE164(phoneNumber);

  // 10. Trigger the call
  const callResult = await retell.createCall({
    agentId,
    toNumber: formattedPhone,
    dynamicVariables,
    metadata: {
      scriptNo,
      fillNo: fillNo || '0',
      patientId,
      workflowLocation,
      subGroup,
      attempt: 1,
    },
  });

  console.log(`[Orchestrator] Call triggered: ${callResult.call_id || 'unknown'}`);

  return {
    success: true,
    callId: callResult.call_id,
    agentId,
    subGroup,
    patientId,
  };
}

/**
 * Format phone to E.164: (504) 681-9885 → +15046819885
 */
function formatPhoneE164(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

module.exports = {
  processWebhook,
  formatPhoneE164,
};
