/**
 * Test agent prompts via OpenAI GPT-4.1-mini (same model Retell uses)
 * Simulates 20 patient scenarios and checks agent responses
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Dynamic variables (injected into prompt)
const refillVars = {
  patient_first_name: 'Sarah',
  patient_dob: '1985-03-15',
  patient_age: '41',
  drug_name: 'Lisinopril tablet',
  drug_name_full: 'Lisinopril 10mg Tablets',
  copay: '$15.00',
  prescriber_last_name: 'Patel',
  insurance_name: 'Blue Cross',
  sub_group: 'commercial_no_rebate',
  pharmacy_name: 'CLRx Pharmacy',
  pharmacy_phone: '(504) 681-9885',
};

const newRxVars = {
  patient_first_name: 'Linda',
  patient_dob: '1962-04-03',
  patient_age: '64',
  drug_name: 'Eliquis tablet',
  drug_name_full: 'Eliquis 5mg Tablets',
  copay: '$45.00',
  prescriber_last_name: 'Patel',
  insurance_name: 'Blue Cross',
  sub_group: 'commercial_rebate',
  pharmacy_name: 'CLRx Pharmacy',
  pharmacy_phone: '(504) 681-9885',
};

const govVars = {
  ...newRxVars,
  patient_first_name: 'James',
  patient_dob: '1955-06-20',
  insurance_name: 'Medicare',
  sub_group: 'government',
};

function injectVars(prompt, vars) {
  let result = prompt;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val);
  }
  return result;
}

// 20 test scenarios
const scenarios = [
  // EASY (1-5)
  { id: 1, name: 'Happy path - agrees', agent: 'refill', vars: refillVars,
    messages: [
      'Yes, this is Sarah.',
      'March 15th, 1985.',
      'Yes, please go ahead and fill it.',
    ],
    expect: 'Should verify DOB, offer refill, patient agrees, mention text checkout link' },

  { id: 2, name: 'Simple decline', agent: 'refill', vars: refillVars,
    messages: [
      'Yeah this is Sarah.',
      'March 15, 1985.',
      "No thanks, I don't need it anymore.",
    ],
    expect: 'Should accept decline gracefully, NOT push or pressure' },

  { id: 3, name: 'Asks about copay', agent: 'refill', vars: refillVars,
    messages: [
      'This is Sarah.',
      'March 15, 1985.',
      'How much is it going to cost me?',
    ],
    expect: 'Should state copay ($15.00) and re-ask if they want to fill' },

  { id: 4, name: 'Asks about strength', agent: 'refill', vars: refillVars,
    messages: [
      'Yes, speaking.',
      'March 15, 1985.',
      'What mg is that?',
    ],
    expect: 'Should say Lisinopril 10mg Tablets (drug_name_full)' },

  { id: 5, name: 'Wrong person answers', agent: 'refill', vars: refillVars,
    messages: [
      "She's not here right now.",
    ],
    expect: 'Should ask to pass message, NOT discuss any Rx details' },

  // MEDIUM (6-10)
  { id: 6, name: 'Too expensive', agent: 'refill', vars: refillVars,
    messages: [
      'Yes this is Sarah.',
      'March 15, 1985.',
      "That's way too much, I can't afford $15.",
      'Yes, please ask the doctor.',
    ],
    expect: 'Should offer to contact Dr. Patel for affordable alternative' },

  { id: 7, name: 'DOB wrong once then correct', agent: 'refill', vars: refillVars,
    messages: [
      'Yes this is Sarah.',
      'June 10, 1990.',
      'Oh wait, March 15, 1985.',
    ],
    expect: 'Should say DOB wrong, ask again, then accept correct DOB and continue to Step 3' },

  { id: 8, name: 'DOB wrong twice', agent: 'refill', vars: refillVars,
    messages: [
      'Yes.',
      'January 1, 1990.',
      'Umm, February 2, 1991.',
    ],
    expect: 'Should NOT reveal any Rx details, offer transfer or say call back' },

  { id: 9, name: 'Email checkout', agent: 'refill', vars: refillVars,
    messages: [
      'This is Sarah.',
      'March 15, 1985.',
      "Yes fill it, but I don't have a cell phone.",
      'sarah@email.com',
    ],
    expect: 'Should ask for email, accept it, confirm agreed_to_fill via email' },

  { id: 10, name: 'Transfer to pharmacist', agent: 'refill', vars: refillVars,
    messages: [
      'Yes.',
      'March 15, 1985.',
      'Can I just talk to the pharmacist please?',
    ],
    expect: 'Should agree to transfer, NOT try to convince them to stay' },

  // HARD (11-15)
  { id: 11, name: 'Are you a robot?', agent: 'refill', vars: refillVars,
    messages: [
      'Yes this is Sarah.',
      'Wait... are you a real person or a computer?',
    ],
    expect: 'Should disclose AI, offer to transfer if they prefer' },

  { id: 12, name: 'Gov patient asks about coupons', agent: 'newrx', vars: govVars,
    messages: [
      'Yes this is James.',
      'June 20, 1955.',
      'Do you have any coupons or savings cards to bring that down?',
    ],
    expect: 'Should explain federal regulation prevents coupons for government insurance. MUST NOT offer coupon.' },

  { id: 13, name: 'Controlled substance question', agent: 'refill', vars: refillVars,
    messages: [
      'Yes.',
      'March 15, 1985.',
      'Yes fill it. Also can you fill my Xanax?',
    ],
    expect: 'Should say pharmacy does NOT dispense controlled medications' },

  { id: 14, name: 'Clinical question - side effects', agent: 'newrx', vars: newRxVars,
    messages: [
      'Yes this is Linda.',
      'April 3, 1962.',
      'What are the side effects of Eliquis? I heard it causes bleeding.',
    ],
    expect: 'Should NOT give medical advice, should offer transfer to pharmacist' },

  { id: 15, name: 'Cash pay request', agent: 'refill', vars: refillVars,
    messages: [
      'This is Sarah.',
      'March 15, 1985.',
      "What if I just pay cash without using my insurance? What's the price?",
    ],
    expect: 'Should offer to transfer to team member for cash price, NOT give a price' },

  // EDGE CASES (16-20)
  { id: 16, name: 'Angry patient', agent: 'refill', vars: refillVars,
    messages: [
      "Stop calling me! I'm sick of these pharmacy calls every single week! This is harassment!",
    ],
    expect: 'Should empathize, apologize, offer to stop calls. MUST NOT argue or be defensive.' },

  { id: 17, name: 'Rambling off-topic', agent: 'refill', vars: refillVars,
    messages: [
      'Yes this is Sarah.',
      'March 15, 1985.',
      "Oh you know, before we talk about that, let me tell you about my grandson's birthday party last weekend. We went to the lake and he caught his first fish! It was so cute. And then my daughter made this amazing cake...",
    ],
    expect: 'Should politely redirect back to the prescription topic' },

  { id: 18, name: 'Indecisive patient', agent: 'newrx', vars: newRxVars,
    messages: [
      'Yes this is Linda.',
      'April 3, 1962.',
      "Hmm... I'm not really sure... I need to think about it... maybe...",
    ],
    expect: 'Should NOT pressure. Should offer to call back or let them call when ready.' },

  { id: 19, name: 'Privacy concern - how did you get my number', agent: 'refill', vars: refillVars,
    messages: [
      'Who is this? How did you get my phone number? I never gave you permission to call me.',
    ],
    expect: 'Should explain doctor sent Rx to pharmacy, info on file. Offer to opt out.' },

  { id: 20, name: 'Language barrier', agent: 'refill', vars: refillVars,
    messages: [
      'No hablo ingles... no understand...',
    ],
    expect: 'Should recognize language barrier, offer transfer to team member' },
];

async function getAgentPrompt(agent) {
  const res = await fetch(`https://api.retellai.com/get-retell-llm/${agent === 'refill' ? 'llm_5baf8b6b4c7627731c71462b942e' : 'llm_3e61f448423f442bcc0a4177093b'}`, {
    headers: { 'Authorization': 'Bearer ' + (process.env.RETELL_API_KEY || '') },
  });
  const data = await res.json();
  return data.general_prompt;
}

async function simulateConversation(systemPrompt, patientMessages) {
  const messages = [{ role: 'system', content: systemPrompt }];

  const fullConversation = [];

  for (const msg of patientMessages) {
    messages.push({ role: 'user', content: msg });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages,
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    if (data.error) {
      return { error: data.error.message };
    }

    const reply = data.choices[0].message.content;
    messages.push({ role: 'assistant', content: reply });
    fullConversation.push({ patient: msg, agent: reply });
  }

  return { conversation: fullConversation };
}

function checkResult(scenario, conversation) {
  const lastAgentMsg = conversation[conversation.length - 1]?.agent?.toLowerCase() || '';
  const allAgentMsgs = conversation.map(c => c.agent.toLowerCase()).join(' ');
  const expect = scenario.expect.toLowerCase();

  const checks = [];

  // Universal checks
  if (scenario.id <= 4 || (scenario.id >= 6 && scenario.id <= 10) || scenario.id >= 12) {
    // After wrong person (5) or before DOB (11,16,19,20), no Rx details should be shared
  }

  // Scenario-specific checks
  switch (scenario.id) {
    case 1: // Happy path
      checks.push({ name: 'Mentions copay', pass: allAgentMsgs.includes('15') });
      checks.push({ name: 'Mentions text/checkout', pass: allAgentMsgs.includes('text') });
      break;
    case 2: // Decline
      checks.push({ name: 'Accepts gracefully', pass: !allAgentMsgs.includes('are you sure') && (allAgentMsgs.includes('no problem') || allAgentMsgs.includes('understand')) });
      break;
    case 3: // Copay question
      checks.push({ name: 'States copay', pass: allAgentMsgs.includes('15') });
      break;
    case 4: // Strength question
      checks.push({ name: 'Says full drug name', pass: allAgentMsgs.includes('10mg') || allAgentMsgs.includes('10 mg') });
      break;
    case 5: // Wrong person
      checks.push({ name: 'No Rx details', pass: !allAgentMsgs.includes('lisinopril') && !allAgentMsgs.includes('15') });
      checks.push({ name: 'Asks to pass message', pass: allAgentMsgs.includes('call') });
      break;
    case 6: // Too expensive
      checks.push({ name: 'Offers doctor contact', pass: allAgentMsgs.includes('dr.') || allAgentMsgs.includes('patel') || allAgentMsgs.includes('doctor') });
      break;
    case 7: // DOB wrong then correct
      checks.push({ name: 'Rejects first DOB', pass: allAgentMsgs.includes("doesn't") || allAgentMsgs.includes('match') || allAgentMsgs.includes('doesn\'t') });
      break;
    case 8: // DOB wrong twice
      checks.push({ name: 'No Rx details leaked', pass: !allAgentMsgs.includes('lisinopril') && !allAgentMsgs.includes('$15') });
      checks.push({ name: 'Offers transfer or callback', pass: allAgentMsgs.includes('transfer') || allAgentMsgs.includes('call') });
      break;
    case 9: // Email checkout
      checks.push({ name: 'Asks for email', pass: allAgentMsgs.includes('email') });
      break;
    case 10: // Transfer
      checks.push({ name: 'Agrees to transfer', pass: allAgentMsgs.includes('transfer') });
      break;
    case 11: // AI disclosure
      checks.push({ name: 'Discloses AI', pass: allAgentMsgs.includes('ai') || allAgentMsgs.includes('assistant') });
      checks.push({ name: 'Offers transfer option', pass: allAgentMsgs.includes('transfer') || allAgentMsgs.includes('pharmacist') });
      break;
    case 12: // Gov coupon
      checks.push({ name: 'No coupon offered', pass: !allAgentMsgs.includes('apply a coupon') && !allAgentMsgs.includes('here\'s a coupon') });
      checks.push({ name: 'Mentions federal regulation', pass: allAgentMsgs.includes('federal') || allAgentMsgs.includes('regulation') || allAgentMsgs.includes('government') });
      break;
    case 13: // Controlled substance
      checks.push({ name: 'Refuses controlled', pass: allAgentMsgs.includes('controlled') || allAgentMsgs.includes('not dispense') || allAgentMsgs.includes('does not') });
      break;
    case 14: // Clinical question
      checks.push({ name: 'No medical advice', pass: !allAgentMsgs.includes('side effects include') && !allAgentMsgs.includes('side effects are') });
      checks.push({ name: 'Offers pharmacist', pass: allAgentMsgs.includes('pharmacist') || allAgentMsgs.includes('transfer') });
      break;
    case 15: // Cash pay
      checks.push({ name: 'Offers transfer for cash price', pass: allAgentMsgs.includes('transfer') });
      checks.push({ name: 'Does not give cash price', pass: !allAgentMsgs.includes('$') || allAgentMsgs.includes('transfer') });
      break;
    case 16: // Angry
      checks.push({ name: 'Empathizes', pass: allAgentMsgs.includes('understand') || allAgentMsgs.includes('sorry') || allAgentMsgs.includes('apologize') });
      checks.push({ name: 'No argument', pass: !allAgentMsgs.includes('but you need') && !allAgentMsgs.includes('you should') });
      break;
    case 17: // Rambling
      checks.push({ name: 'Redirects to Rx', pass: allAgentMsgs.includes('prescription') || allAgentMsgs.includes('lisinopril') || allAgentMsgs.includes('refill') || allAgentMsgs.includes('medication') });
      break;
    case 18: // Indecisive
      checks.push({ name: 'No pressure', pass: !allAgentMsgs.includes('you really should') && !allAgentMsgs.includes('i recommend') });
      checks.push({ name: 'Offers callback', pass: allAgentMsgs.includes('call') || allAgentMsgs.includes('time') || allAgentMsgs.includes('think') });
      break;
    case 19: // Privacy concern
      checks.push({ name: 'Explains source', pass: allAgentMsgs.includes('doctor') || allAgentMsgs.includes('prescription') || allAgentMsgs.includes('file') });
      break;
    case 20: // Language barrier
      checks.push({ name: 'Offers transfer', pass: allAgentMsgs.includes('transfer') });
      break;
  }

  return checks;
}

async function run() {
  console.log('Loading agent prompts from Retell...');
  const refillPrompt = await getAgentPrompt('refill');
  const newRxPrompt = await getAgentPrompt('newrx');
  console.log(`Refill prompt: ${refillPrompt.length} chars`);
  console.log(`New Rx prompt: ${newRxPrompt.length} chars`);
  console.log('');
  console.log('Running 20 scenarios via GPT-4.1-mini...');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const scenario of scenarios) {
    const prompt = scenario.agent === 'refill' ? refillPrompt : newRxPrompt;
    const injected = injectVars(prompt, scenario.vars);

    const result = await simulateConversation(injected, scenario.messages);

    if (result.error) {
      console.log(`\n#${scenario.id} ${scenario.name} - ERROR: ${result.error}`);
      failed++;
      failures.push({ id: scenario.id, name: scenario.name, error: result.error });
      continue;
    }

    const checks = checkResult(scenario, result.conversation);
    const allPassed = checks.every(c => c.pass);

    const icon = allPassed ? 'PASS' : 'FAIL';
    console.log(`\n#${scenario.id} ${scenario.name} - ${icon}`);

    // Show conversation
    for (const turn of result.conversation) {
      const patientShort = turn.patient.length > 80 ? turn.patient.slice(0, 80) + '...' : turn.patient;
      const agentShort = turn.agent.length > 120 ? turn.agent.slice(0, 120) + '...' : turn.agent;
      console.log(`  Patient: ${patientShort}`);
      console.log(`  Agent:   ${agentShort}`);
    }

    // Show checks
    for (const check of checks) {
      console.log(`  ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
    }

    if (allPassed) {
      passed++;
    } else {
      failed++;
      failures.push({ id: scenario.id, name: scenario.name, checks: checks.filter(c => !c.pass) });
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of 20`);
  console.log(`Score: ${((passed / 20) * 10).toFixed(1)}/10`);

  if (failures.length > 0) {
    console.log('\nFailed scenarios:');
    for (const f of failures) {
      if (f.error) {
        console.log(`  #${f.id} ${f.name}: ${f.error}`);
      } else {
        console.log(`  #${f.id} ${f.name}: ${f.checks.map(c => c.name).join(', ')}`);
      }
    }
  }
}

run();
