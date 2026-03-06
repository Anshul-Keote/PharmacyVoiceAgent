const liberty = require('./liberty');
const scheduler = require('./scheduler');
const config = require('../config');

/**
 * Process Retell post-call webhook (call_analyzed event)
 */
async function processCallOutcome(callData) {
  const { metadata, call_analysis } = callData;

  if (!metadata || !call_analysis) {
    console.error('[Outcome] Missing metadata or call_analysis');
    return { success: false, reason: 'missing_data' };
  }

  const { scriptNo, fillNo, patientId, workflowLocation, subGroup, attempt } = metadata;
  const analysisData = call_analysis.custom_analysis_data || {};
  const callOutcome = analysisData.call_outcome;
  const inVoicemail = call_analysis.in_voicemail || false;

  console.log(`[Outcome] Processing: Script ${scriptNo}, Outcome: ${callOutcome}, Voicemail: ${inVoicemail}`);

  const today = formatDate(new Date());
  const drugName = callData.retell_llm_dynamic_variables?.drug_name_full || 'Unknown';
  const copay = callData.retell_llm_dynamic_variables?.copay || '';

  // Handle based on outcome
  switch (callOutcome) {
    case 'agreed_to_fill':
      return handleAgreed({ scriptNo, fillNo, patientId, today, drugName, analysisData });

    case 'declined':
      return handleDeclined({ scriptNo, fillNo, patientId, today, drugName, analysisData });

    case 'wants_doctor_contact':
      return handleDoctorContact({ scriptNo, fillNo, patientId, today, drugName, analysisData });

    case 'transferred':
      return handleTransferred({ patientId, today, drugName, copay, analysisData });

    case 'no_answer':
    case 'wrong_person':
      return handleNoAnswer({ scriptNo, fillNo, patientId, workflowLocation, subGroup, attempt, today, drugName, inVoicemail });

    case 'verification_failed':
      return handleVerificationFailed({ patientId, today, drugName });

    case 'call_back_later':
      return handleCallBackLater({ scriptNo, fillNo, patientId, workflowLocation, subGroup, attempt, today, drugName });

    default:
      console.error(`[Outcome] Unknown outcome: ${callOutcome}`);
      return { success: false, reason: 'unknown_outcome' };
  }
}

async function handleAgreed({ scriptNo, fillNo, patientId, today, drugName, analysisData }) {
  // Check if patient needs email checkout
  const checkoutMethod = analysisData.checkout_method;
  const patientEmail = analysisData.patient_email;

  // If patient can't receive texts, save email and create note before moving Rx
  if (checkoutMethod === 'email' && patientEmail) {
    await liberty.createPatientNote(patientId,
      `Patient cannot receive texts. Checkout link to be sent via email: ${patientEmail}`
    );
  }

  // Move Rx to HEALNOW TEXT
  await liberty.moveToWorkflowLocation(scriptNo, fillNo, config.outcomes.agreed);

  // Update CustomField4
  await liberty.updateCustomField4(patientId,
    `${today} Pt agreed to fill ${drugName} via voice AI agent`
  );

  console.log(`[Outcome] Agreed: Script ${scriptNo} → ${config.outcomes.agreed}`);
  return { success: true, outcome: 'agreed', location: config.outcomes.agreed };
}

async function handleDeclined({ scriptNo, fillNo, patientId, today, drugName, analysisData }) {
  const reason = analysisData.decline_reason || 'no reason given';

  // Move Rx to AI RTS
  await liberty.moveToWorkflowLocation(scriptNo, fillNo, config.outcomes.declined);

  // Update CustomField4
  await liberty.updateCustomField4(patientId, `${today} Declined AI call`);

  // Create patient note
  await liberty.createPatientNote(patientId,
    `Pt declined Rx via AI call ${today}. Rx: ${drugName}. Reason: ${reason}.`
  );

  console.log(`[Outcome] Declined: Script ${scriptNo} → ${config.outcomes.declined}`);
  return { success: true, outcome: 'declined', location: config.outcomes.declined };
}

async function handleDoctorContact({ scriptNo, fillNo, patientId, today, drugName, analysisData }) {
  const concern = analysisData.patient_concern || '';
  const prescriberName = analysisData.prescriber_last_name || '';

  // Move Rx to AI DOCTOR CHANGES
  await liberty.moveToWorkflowLocation(scriptNo, fillNo, config.outcomes.wants_doctor_contact);

  // Update CustomField4
  await liberty.updateCustomField4(patientId, `${today} Declined AI call - req doctor contact`);

  // Create patient note
  await liberty.createPatientNote(patientId,
    `Pt req alt drug via AI call ${today}. Original Rx: ${drugName}. Dr. ${prescriberName} to be contacted for alternative.`
  );

  console.log(`[Outcome] Doctor contact: Script ${scriptNo} → ${config.outcomes.wants_doctor_contact}`);
  return { success: true, outcome: 'wants_doctor_contact', location: config.outcomes.wants_doctor_contact };
}

async function handleTransferred({ patientId, today, drugName, copay, analysisData }) {
  const reason = analysisData.transfer_reason || '';
  const summary = analysisData.call_summary || '';

  // Create patient note BEFORE transfer (so staff sees it)
  await liberty.createPatientNote(patientId,
    `AI call transferred ${today}. Rx: ${drugName}, copay ${copay}. Reason: ${reason}. Summary: ${summary}`
  );

  console.log(`[Outcome] Transferred: Patient ${patientId}`);
  return { success: true, outcome: 'transferred' };
}

async function handleNoAnswer({ scriptNo, fillNo, patientId, workflowLocation, subGroup, attempt, today, drugName, inVoicemail }) {
  const currentAttempt = attempt || 1;

  // Update CustomField4
  const voicemailNote = inVoicemail ? ' (voicemail left)' : '';
  await liberty.updateCustomField4(patientId, `${today} No answer AI call${voicemailNote}`);

  if (currentAttempt < config.retry.maxAttempts) {
    // Schedule retry
    scheduler.scheduleRetry({
      scriptNo,
      fillNo,
      workflowLocation,
      patientId,
      subGroup,
      attempt: currentAttempt + 1,
    });
    console.log(`[Outcome] No answer: Script ${scriptNo}, retry scheduled (attempt ${currentAttempt + 1})`);
    return { success: true, outcome: 'no_answer', retry: true, nextAttempt: currentAttempt + 1 };
  }

  // Max attempts reached — move to AI RTS
  await liberty.moveToWorkflowLocation(scriptNo, fillNo, config.outcomes.declined);
  await liberty.createPatientNote(patientId,
    `AI call - no answer after ${currentAttempt} attempts ${today}. Rx: ${drugName}. Moved to AI RTS.`
  );

  console.log(`[Outcome] No answer: Script ${scriptNo} → ${config.outcomes.declined} (max attempts)`);
  return { success: true, outcome: 'no_answer', retry: false, location: config.outcomes.declined };
}

async function handleVerificationFailed({ patientId, today, drugName }) {
  await liberty.updateCustomField4(patientId, `${today} AI call - DOB verification failed`);
  console.log(`[Outcome] Verification failed: Patient ${patientId}`);
  return { success: true, outcome: 'verification_failed' };
}

async function handleCallBackLater({ scriptNo, fillNo, patientId, workflowLocation, subGroup, attempt, today, drugName }) {
  const currentAttempt = attempt || 1;

  await liberty.updateCustomField4(patientId, `${today} AI call - patient will call back`);

  // Schedule a retry like no-answer
  if (currentAttempt < config.retry.maxAttempts) {
    scheduler.scheduleRetry({
      scriptNo,
      fillNo,
      workflowLocation,
      patientId,
      subGroup,
      attempt: currentAttempt + 1,
    });
  }

  console.log(`[Outcome] Call back later: Patient ${patientId}`);
  return { success: true, outcome: 'call_back_later' };
}

/**
 * Format date as MM/DD/YYYY
 */
function formatDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

module.exports = { processCallOutcome };
