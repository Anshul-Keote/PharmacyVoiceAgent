/**
 * In-memory call data store for dashboard
 */
const calls = [];
const MAX_CALLS = 500;

function addCall(callData) {
  const entry = {
    id: callData.call_id || `call_${Date.now()}`,
    agentName: callData.agent_name || callData.metadata?.workflowLocation || 'Unknown',
    patientName: callData.retell_llm_dynamic_variables?.patient_first_name || 'Unknown',
    drugName: callData.retell_llm_dynamic_variables?.drug_name || '',
    copay: callData.retell_llm_dynamic_variables?.copay || '',
    subGroup: callData.retell_llm_dynamic_variables?.sub_group || '',
    callOutcome: callData.call_analysis?.custom_analysis_data?.call_outcome || 'pending',
    patientVerified: callData.call_analysis?.custom_analysis_data?.patient_verified || false,
    declineReason: callData.call_analysis?.custom_analysis_data?.decline_reason || '',
    patientConcern: callData.call_analysis?.custom_analysis_data?.patient_concern || '',
    transferReason: callData.call_analysis?.custom_analysis_data?.transfer_reason || '',
    callSummary: callData.call_analysis?.custom_analysis_data?.call_summary || callData.call_analysis?.call_summary || '',
    sentiment: callData.call_analysis?.user_sentiment || '',
    inVoicemail: callData.call_analysis?.in_voicemail || false,
    recordingUrl: callData.recording_url || '',
    transcript: callData.transcript || '',
    duration: callData.end_timestamp && callData.start_timestamp
      ? Math.round((callData.end_timestamp - callData.start_timestamp) / 1000)
      : 0,
    disconnectionReason: callData.disconnection_reason || '',
    metadata: callData.metadata || {},
    timestamp: new Date().toISOString(),
    status: callData.call_status || 'completed',
  };

  calls.unshift(entry);
  if (calls.length > MAX_CALLS) calls.pop();

  return entry;
}

function addWebCall(agentType, dynamicVars) {
  const entry = {
    id: `web_${Date.now()}`,
    agentName: agentType === 'refill' ? 'agent_refill_due' : 'agent_new_rx_cov',
    patientName: dynamicVars.patient_first_name || 'Unknown',
    drugName: dynamicVars.drug_name || '',
    copay: dynamicVars.copay || '',
    subGroup: dynamicVars.sub_group || '',
    callOutcome: 'in_progress',
    patientVerified: false,
    declineReason: '',
    patientConcern: '',
    transferReason: '',
    callSummary: '',
    sentiment: '',
    inVoicemail: false,
    duration: 0,
    disconnectionReason: '',
    metadata: { type: 'web_call' },
    timestamp: new Date().toISOString(),
    status: 'active',
  };

  calls.unshift(entry);
  if (calls.length > MAX_CALLS) calls.pop();

  return entry;
}

function updateCall(callId, updates) {
  const call = calls.find(c => c.id === callId);
  if (call) Object.assign(call, updates);
  return call;
}

function getCalls() {
  return calls;
}

function getStats() {
  const total = calls.length;
  const outcomes = {};
  calls.forEach(c => {
    outcomes[c.callOutcome] = (outcomes[c.callOutcome] || 0) + 1;
  });

  return {
    total,
    outcomes,
    lastCall: calls[0] || null,
  };
}

module.exports = { addCall, addWebCall, updateCall, getCalls, getStats };
