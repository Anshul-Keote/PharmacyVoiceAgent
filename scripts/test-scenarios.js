/**
 * Test script - sends mock Retell webhook payloads to test dashboard
 * Usage: node scripts/test-scenarios.js [scenario]
 *
 * Scenarios: agreed, declined, doctor, noanswer, transfer, verify-fail, callback, all
 */

const BASE_URL = 'http://localhost:3000';

const scenarios = {
  agreed: {
    name: 'Patient agrees to fill',
    payload: {
      event: 'call_analyzed',
      call: {
        call_id: `test_agreed_${Date.now()}`,
        agent_id: 'agent_509c6ce94b7e7382a1ca58c5ba',
        agent_name: 'agent_refill_due',
        call_status: 'ended',
        start_timestamp: Date.now() - 180000,
        end_timestamp: Date.now(),
        disconnection_reason: 'agent_hangup',
        transcript: 'Agent: Hi, this is Marissa calling from CLRx Pharmacy. Am I speaking with Sarah?\nUser: Yes, this is Sarah.\nAgent: Great! I am calling about your Lisinopril tablet prescription. For verification purposes, could you please confirm your date of birth?\nUser: Sure, it is March 15th, 1985.\nAgent: Thank you, Sarah. I am calling to let you know that your Lisinopril tablet is due for a refill. Your copay would be $15.00. Would you like us to go ahead and fill that for you?\nUser: Yes, please go ahead.\nAgent: Wonderful! Would you prefer to receive a checkout link via text message or email?\nUser: Text is fine.\nAgent: Perfect. We will send you a text with the checkout link shortly. Is there anything else I can help you with?\nUser: No, that is all. Thank you!\nAgent: You are welcome, Sarah. Have a great day!',
        recording_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        retell_llm_dynamic_variables: {
          patient_first_name: 'Sarah',
          drug_name: 'Lisinopril tablet',
          copay: '$15.00',
          sub_group: 'commercial_no_rebate',
        },
        call_analysis: {
          call_summary: 'Patient verified identity and agreed to fill Lisinopril. Chose text checkout.',
          user_sentiment: 'Positive',
          in_voicemail: false,
          custom_analysis_data: {
            call_outcome: 'agreed_to_fill',
            patient_verified: true,
            patient_concern: '',
            decline_reason: '',
            transfer_reason: '',
            call_summary: 'Patient agreed to refill. Sending checkout link via text.',
            checkout_method: 'text',
            patient_email: '',
          },
        },
        metadata: { workflowLocation: 'AI REFILL DUE' },
      },
    },
  },

  declined: {
    name: 'Patient declines',
    payload: {
      event: 'call_analyzed',
      call: {
        call_id: `test_declined_${Date.now()}`,
        agent_id: 'agent_509c6ce94b7e7382a1ca58c5ba',
        agent_name: 'agent_refill_due',
        call_status: 'ended',
        start_timestamp: Date.now() - 120000,
        end_timestamp: Date.now(),
        disconnection_reason: 'agent_hangup',
        transcript: 'Agent: Hi, this is Marissa calling from CLRx Pharmacy. Am I speaking with Mike?\nUser: Yeah, that is me.\nAgent: I am calling about your Metformin tablet prescription. For verification, could you please confirm your date of birth?\nUser: July 22nd, 1978.\nAgent: Thank you, Mike. Your Metformin tablet is due for a refill. The copay would be $10.00. Would you like us to fill that for you?\nUser: No, I actually don\'t take that anymore. My doctor switched me to something else.\nAgent: I understand. I will make a note that you have declined the refill. Would you like us to have the pharmacist reach out to your doctor about this?\nUser: No, it is already handled. Thanks though.\nAgent: No problem, Mike. Have a good day!',
        recording_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        retell_llm_dynamic_variables: {
          patient_first_name: 'Mike',
          drug_name: 'Metformin tablet',
          copay: '$10.00',
          sub_group: 'commercial_no_rebate',
        },
        call_analysis: {
          call_summary: 'Patient declined refill, says they no longer take this medication.',
          user_sentiment: 'Neutral',
          in_voicemail: false,
          custom_analysis_data: {
            call_outcome: 'declined',
            patient_verified: true,
            decline_reason: 'No longer taking medication',
            patient_concern: '',
            transfer_reason: '',
            call_summary: 'Patient declined. Says doctor switched them to a different med.',
          },
        },
        metadata: { workflowLocation: 'AI REFILL DUE' },
      },
    },
  },

  doctor: {
    name: 'Patient wants doctor contact',
    payload: {
      event: 'call_analyzed',
      call: {
        call_id: `test_doctor_${Date.now()}`,
        agent_id: 'agent_9043ddc769a09be389737645b0',
        agent_name: 'agent_new_rx_cov',
        call_status: 'ended',
        start_timestamp: Date.now() - 150000,
        end_timestamp: Date.now(),
        disconnection_reason: 'agent_hangup',
        transcript: 'Agent: Hi, this is Marissa calling from CLRx Pharmacy. Am I speaking with Linda?\nUser: Yes, hi.\nAgent: I am calling about a new prescription for Eliquis tablet that your doctor sent over. Could you please confirm your date of birth for verification?\nUser: April 3rd, 1962.\nAgent: Thank you, Linda. Your doctor prescribed Eliquis 5mg tablets and your insurance covers it with a $45.00 copay. Would you like us to fill this for you?\nUser: I am not sure about this one. I have heard Eliquis can cause bleeding issues. I want to talk to Dr. Patel first before I start taking it.\nAgent: That is completely understandable. I will make a note for the pharmacist to reach out to Dr. Patel\'s office regarding your concerns. Is there anything else?\nUser: No, that is it. Thank you for understanding.\nAgent: Of course, Linda. Take care!',
        recording_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        retell_llm_dynamic_variables: {
          patient_first_name: 'Linda',
          drug_name: 'Eliquis tablet',
          copay: '$45.00',
          sub_group: 'commercial_rebate',
        },
        call_analysis: {
          call_summary: 'Patient wants to speak with Dr. Patel before starting Eliquis.',
          user_sentiment: 'Neutral',
          in_voicemail: false,
          custom_analysis_data: {
            call_outcome: 'wants_doctor_contact',
            patient_verified: true,
            patient_concern: 'Worried about bleeding side effects',
            decline_reason: '',
            transfer_reason: '',
            call_summary: 'Patient wants doctor contact before starting new medication.',
          },
        },
        metadata: { workflowLocation: 'AI NEW RX COV' },
      },
    },
  },

  noanswer: {
    name: 'No answer',
    payload: {
      event: 'call_analyzed',
      call: {
        call_id: `test_noanswer_${Date.now()}`,
        agent_id: 'agent_509c6ce94b7e7382a1ca58c5ba',
        agent_name: 'agent_refill_due',
        call_status: 'ended',
        start_timestamp: Date.now() - 30000,
        end_timestamp: Date.now(),
        disconnection_reason: 'voicemail_reached',
        retell_llm_dynamic_variables: {
          patient_first_name: 'James',
          drug_name: 'Atorvastatin tablet',
          copay: '$8.00',
          sub_group: 'government',
        },
        call_analysis: {
          call_summary: 'Call went to voicemail. No contact made.',
          user_sentiment: 'Unknown',
          in_voicemail: true,
          custom_analysis_data: {
            call_outcome: 'no_answer',
            patient_verified: false,
            call_summary: 'No answer - went to voicemail.',
          },
        },
        metadata: { workflowLocation: 'AI REFILL DUE' },
      },
    },
  },

  transfer: {
    name: 'Patient requests transfer',
    payload: {
      event: 'call_analyzed',
      call: {
        call_id: `test_transfer_${Date.now()}`,
        agent_id: 'agent_9043ddc769a09be389737645b0',
        agent_name: 'agent_new_rx_cov',
        call_status: 'ended',
        start_timestamp: Date.now() - 200000,
        end_timestamp: Date.now(),
        disconnection_reason: 'agent_hangup',
        transcript: 'Agent: Hi, this is Marissa calling from CLRx Pharmacy. Am I speaking with Karen?\nUser: Yes.\nAgent: I am calling about a new prescription for Jardiance tablet. Could you please confirm your date of birth?\nUser: September 11th, 1970.\nAgent: Thank you. Your doctor prescribed Jardiance and your copay would be $60.00. Would you like us to fill this?\nUser: Actually, I am already on Metformin. I want to talk to the pharmacist about whether these two interact. Can you transfer me?\nAgent: Of course. Let me transfer you to the pharmacist right now. One moment please.\nUser: Thank you.',
        recording_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        retell_llm_dynamic_variables: {
          patient_first_name: 'Karen',
          drug_name: 'Jardiance tablet',
          copay: '$60.00',
          sub_group: 'commercial_no_rebate',
        },
        call_analysis: {
          call_summary: 'Patient asked to speak with pharmacist about drug interactions.',
          user_sentiment: 'Negative',
          in_voicemail: false,
          custom_analysis_data: {
            call_outcome: 'transferred',
            patient_verified: true,
            transfer_reason: 'Wants to discuss drug interactions with pharmacist',
            call_summary: 'Transferred to pharmacist for drug interaction questions.',
          },
        },
        metadata: { workflowLocation: 'AI NEW RX COV' },
      },
    },
  },

  'verify-fail': {
    name: 'DOB verification failed',
    payload: {
      event: 'call_analyzed',
      call: {
        call_id: `test_verifyfail_${Date.now()}`,
        agent_id: 'agent_509c6ce94b7e7382a1ca58c5ba',
        agent_name: 'agent_refill_due',
        call_status: 'ended',
        start_timestamp: Date.now() - 90000,
        end_timestamp: Date.now(),
        disconnection_reason: 'agent_hangup',
        transcript: 'Agent: Hi, this is Marissa calling from CLRx Pharmacy. Am I speaking with Tom?\nUser: Yeah.\nAgent: I am calling about your Amlodipine prescription. For verification, could you please confirm your date of birth?\nUser: Uh, January 5th, 1980.\nAgent: I am sorry, that does not match what we have on file. Could you try again?\nUser: Oh wait, maybe it is January 15th, 1980?\nAgent: I am sorry, I was not able to verify your identity. For your security, please call the pharmacy directly at (504) 681-9885 and we will be happy to assist you. Have a good day.\nUser: Okay, bye.',
        recording_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
        retell_llm_dynamic_variables: {
          patient_first_name: 'Tom',
          drug_name: 'Amlodipine tablet',
          copay: '$12.00',
          sub_group: 'commercial_no_rebate',
        },
        call_analysis: {
          call_summary: 'Patient could not verify DOB after 2 attempts. Call ended.',
          user_sentiment: 'Neutral',
          in_voicemail: false,
          custom_analysis_data: {
            call_outcome: 'verification_failed',
            patient_verified: false,
            call_summary: 'Could not verify patient identity. Wrong DOB provided twice.',
          },
        },
        metadata: { workflowLocation: 'AI REFILL DUE' },
      },
    },
  },

  callback: {
    name: 'Patient wants callback later',
    payload: {
      event: 'call_analyzed',
      call: {
        call_id: `test_callback_${Date.now()}`,
        agent_id: 'agent_509c6ce94b7e7382a1ca58c5ba',
        agent_name: 'agent_refill_due',
        call_status: 'ended',
        start_timestamp: Date.now() - 60000,
        end_timestamp: Date.now(),
        disconnection_reason: 'agent_hangup',
        transcript: 'Agent: Hi, this is Marissa calling from CLRx Pharmacy. Am I speaking with Rosa?\nUser: Yes, but I am at work right now. Can you call me back?\nAgent: Of course! When would be a good time to call you back?\nUser: Tomorrow afternoon would be better.\nAgent: No problem, Rosa. We will give you a call back tomorrow. Have a good day!\nUser: Thanks, bye.',
        retell_llm_dynamic_variables: {
          patient_first_name: 'Rosa',
          drug_name: 'Omeprazole capsule',
          copay: '$5.00',
          sub_group: 'government',
        },
        call_analysis: {
          call_summary: 'Patient is busy, asked to be called back tomorrow.',
          user_sentiment: 'Positive',
          in_voicemail: false,
          custom_analysis_data: {
            call_outcome: 'call_back_later',
            patient_verified: true,
            patient_concern: '',
            call_summary: 'Patient busy at work. Requested callback tomorrow.',
          },
        },
        metadata: { workflowLocation: 'AI REFILL DUE' },
      },
    },
  },
};

async function sendScenario(name) {
  const scenario = scenarios[name];
  if (!scenario) {
    console.log(`Unknown scenario: ${name}`);
    console.log(`Available: ${Object.keys(scenarios).join(', ')}, all`);
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/webhooks/retell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario.payload),
    });
    const data = await res.json();
    console.log(`✓ ${scenario.name} - ${res.status} ${JSON.stringify(data)}`);
  } catch (err) {
    console.log(`✗ ${scenario.name} - ${err.message}`);
  }
}

async function run() {
  const arg = process.argv[2] || 'all';

  console.log('Sending test scenarios to', BASE_URL);
  console.log('---');

  if (arg === 'all') {
    for (const name of Object.keys(scenarios)) {
      await sendScenario(name);
    }
  } else {
    await sendScenario(arg);
  }

  console.log('---');
  console.log('Check dashboard: http://localhost:3000/dashboard');
}

run();
