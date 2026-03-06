const config = require('../config');
const { apiRequest } = require('../utils/api-client');
const cache = require('../utils/cache');

const headers = {
  Authorization: config.liberty.authHeader,
  Customer: config.liberty.customerHeader,
};

/**
 * Get prescription by script number
 */
async function getPrescription(scriptNo) {
  const cacheKey = `rx:${scriptNo}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await apiRequest(`${config.liberty.baseUrl}/prescription/${scriptNo}`, { headers });
  cache.set(cacheKey, data);
  return data;
}

/**
 * Get specific fill for a prescription
 */
async function getPrescriptionFill(scriptNo, fillNo) {
  const cacheKey = `rx:${scriptNo}:${fillNo}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await apiRequest(`${config.liberty.baseUrl}/prescription/${scriptNo}/${fillNo}`, { headers });
  cache.set(cacheKey, data);
  return data;
}

/**
 * Get patient by PatientId
 */
async function getPatient(patientId) {
  const cacheKey = `patient:${patientId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await apiRequest(`${config.liberty.baseUrl}/patient?PatientId=${patientId}`, { headers });
  cache.set(cacheKey, data);
  return data;
}

/**
 * Move Rx to a workflow location
 */
async function moveToWorkflowLocation(scriptNo, fillNo, location) {
  return apiRequest(`${config.liberty.baseUrl}/workflowlocations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ScriptNo: scriptNo,
      FillNo: fillNo,
      Location: location,
    }),
  });
}

/**
 * Update patient CustomField4 with AI call note
 */
async function updateCustomField4(patientId, note) {
  return apiRequest(`${config.liberty.baseUrl}/patient`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      PatientId: patientId,
      CustomField4: note,
    }),
  });
}

/**
 * Create a patient note in Liberty
 */
async function createPatientNote(patientId, noteText) {
  return apiRequest(`${config.liberty.baseUrl}/patient/note`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      PatientId: patientId,
      NoteText: noteText,
    }),
  });
}

/**
 * Get workflow locations (for verification)
 */
async function getWorkflowLocations() {
  return apiRequest(`${config.liberty.baseUrl}/workflowlocations`, { headers });
}

/**
 * Detect insurance sub-group from fill data
 * Returns: 'commercial_rebate', 'commercial_no_rebate', or 'government'
 */
function detectSubGroup(fillData) {
  const primaryName = (fillData.Primary && fillData.Primary.Name) || '';
  const secondaryName = (fillData.Secondary && fillData.Secondary.Name) || '';

  if (primaryName.toUpperCase().startsWith('GOV')) {
    return 'government';
  }

  if (primaryName.toUpperCase().startsWith('INS') && secondaryName.toUpperCase().startsWith('RBX')) {
    return 'commercial_rebate';
  }

  return 'commercial_no_rebate';
}

/**
 * Validate patient phone number (must be 10+ digits)
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

/**
 * Calculate patient age from birth date
 */
function calculateAge(birthDate) {
  const dob = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

module.exports = {
  getPrescription,
  getPrescriptionFill,
  getPatient,
  moveToWorkflowLocation,
  updateCustomField4,
  createPatientNote,
  getWorkflowLocations,
  detectSubGroup,
  isValidPhone,
  calculateAge,
};
