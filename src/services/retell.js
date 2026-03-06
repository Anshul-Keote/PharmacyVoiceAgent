const config = require('../config');
const { apiRequest } = require('../utils/api-client');

const RETELL_BASE_URL = 'https://api.retellai.com/v2';

const headers = {
  Authorization: `Bearer ${config.retell.apiKey}`,
};

/**
 * Create an outbound phone call via Retell AI
 */
async function createCall({ agentId, toNumber, dynamicVariables, metadata }) {
  return apiRequest(`${RETELL_BASE_URL}/create-phone-call`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id: agentId,
      customer_number: toNumber,
      from_number: config.retell.fromNumber,
      retell_llm_dynamic_variables: dynamicVariables,
      metadata: metadata || {},
    }),
  });
}

/**
 * Build dynamic variables for a Retell call
 */
function buildDynamicVariables({ patient, fillData, rxData, subGroup }) {
  const liberty = require('./liberty');

  const patientFirstName = patient.Name && patient.Name.FirstName
    ? patient.Name.FirstName.charAt(0).toUpperCase() + patient.Name.FirstName.slice(1).toLowerCase()
    : '';

  const drugNameFull = rxData.DrugPrescribed && rxData.DrugPrescribed.Name
    ? rxData.DrugPrescribed.Name
    : '';

  // Simplified drug name: remove strength, keep dosage form
  const drugName = simplifyDrugName(drugNameFull);

  const copay = fillData.PatientPay != null
    ? `$${parseFloat(fillData.PatientPay).toFixed(2)}`
    : '$0.00';

  const prescriberLastName = rxData.Prescriber && rxData.Prescriber.Name && rxData.Prescriber.Name.LastName
    ? rxData.Prescriber.Name.LastName
    : '';

  const insuranceName = fillData.Primary && fillData.Primary.Name
    ? cleanInsuranceName(fillData.Primary.Name)
    : '';

  const patientAge = patient.BirthDate ? liberty.calculateAge(patient.BirthDate) : null;

  return {
    patient_first_name: patientFirstName,
    patient_dob: patient.BirthDate || '',
    patient_age: patientAge ? String(patientAge) : '',
    drug_name: drugName,
    drug_name_full: drugNameFull,
    copay,
    prescriber_last_name: prescriberLastName,
    insurance_name: insuranceName,
    sub_group: subGroup,
    pharmacy_name: config.pharmacy.name,
    pharmacy_phone: config.pharmacy.phone,
  };
}

/**
 * Simplify drug name: "Eliquis 5mg Tablets" → "Eliquis tablet"
 */
function simplifyDrugName(fullName) {
  if (!fullName) return '';
  // Remove strength patterns like "5mg", "10 mg", "0.5mg"
  let simplified = fullName.replace(/\d+\.?\d*\s*(?:mg|mcg|ml|g|%|units?)/gi, '').trim();
  // Clean up extra spaces
  simplified = simplified.replace(/\s+/g, ' ').trim();
  return simplified;
}

/**
 * Clean insurance name: "INS BLUE CROSS" → "Blue Cross"
 */
function cleanInsuranceName(name) {
  if (!name) return '';
  return name.replace(/^(INS|GOV|RBX)\s*/i, '').trim();
}

/**
 * Get the agent ID for a given workflow location
 */
function getAgentForLocation(workflowLocation) {
  return config.retell.agents[workflowLocation] || null;
}

module.exports = {
  createCall,
  buildDynamicVariables,
  getAgentForLocation,
  simplifyDrugName,
  cleanInsuranceName,
};
