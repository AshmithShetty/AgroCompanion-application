const estimateTokens = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
};

const estimateMessages = (messages) => messages.reduce((sum, message) => {
  const content = Array.isArray(message.content)
    ? message.content.map(part => {
      if (part.type === 'text') return part.text || '';
      if (part.type === 'image_url') return '[image]';
      return '';
    }).join(' ')
    : message.content;
  return sum + estimateTokens(content) + 4;
}, 0);

const sample = {
  userPrompt: 'My paddy field is showing yellowing leaves after uneven rain. Give me detailed advice and help me decide whether to schedule a nutrient correction task for next week.',
  chatLog: [
    { role: 'ai', text: 'Welcome! I am your active AI Agronomist. How can I assist with your paddy today?' },
    { role: 'user', text: 'The field had patchy water logging last week.' },
    { role: 'ai', text: 'Check drainage first and monitor yellowing severity over the next two days.' },
    { role: 'user', text: 'I also noticed slow tillering in the lower patch.' },
    { role: 'ai', text: 'That can indicate nutrient stress or root damage after standing water.' },
    { role: 'user', text: 'The local mandi price looked weak yesterday.' },
    { role: 'ai', text: 'We can review district mandi trends before you plan harvest timing.' },
    { role: 'user', text: 'Please compare that with the likely rain outlook too.' },
  ],
  context: `Current Farm State:
- Farmer: demo_user
- Farm: Sunrise Plot
- District: Dharwad
- Area (hectares): 2.40
- Crop: Paddy
- Stage: Day 41 since start date
- Soil Type: Clay Loam
- Method: Conventional
- Farm Context: Medium-deep clay loam paddy field with recurring water-logging in the lower half, moderate nitrogen drawdown after heavy rain, and uneven tiller development in the western edge.
- Language: English
- Actual Current Date: 2026-04-24`,
  compactContext: `Farm: Sunrise Plot
Farmer: demo_user
District: Dharwad
Area hectares: 2.40
Crop: Paddy
Crop age days: 41
Current date: 2026-04-24
Reply language: English
Soil type: Clay Loam
Farming method: Conventional
Farm notes: Medium-deep clay loam paddy field with recurring water-logging in the lower half, moderate nitrogen drawdown after heavy rain, and uneven tiller development in the western edge.`,
  sensorSnapshot: '{"temperature":31,"humidity":74,"soil_moisture":68,"soil_ph":6.4,"nitrogen":42,"phosphorus":26,"potassium":118,"is_raining":0,"capturedAt":"2026-04-24T08:10:00.000Z"}',
  compactSensorSnapshot: `temperature: 31
humidity: 74
soil_moisture: 68
soil_ph: 6.4
nitrogen: 42
phosphorus: 26
potassium: 118
is_raining: 0
capturedAt: 2026-04-24T08:10:00.000Z`,
  forecast: `2026-04-24: 28-33C, 4.2mm rain, 3.1m/s wind, 81% humidity
2026-04-25: 27-32C, 12.7mm rain, 4.4m/s wind, 88% humidity
2026-04-26: 27-31C, 16.1mm rain, 4.8m/s wind, 90% humidity
2026-04-27: 28-33C, 2.1mm rain, 3.0m/s wind, 77% humidity
2026-04-28: 29-34C, 0.0mm rain, 2.5m/s wind, 69% humidity`,
  market: `Hubli (Dharwad, Karnataka): Min INR2150, Max INR2285, Mode INR2235
Navalgund (Dharwad, Karnataka): Min INR2100, Max INR2260, Mode INR2200
Gadag (Gadag, Karnataka): Min INR2125, Max INR2290, Mode INR2240`,
  tasks: `Active Pending Tasks:
ID: t_1 | Source: manual | Title: Inspect blocked bund outlet | Date: 2026-04-25 | Priority: High
ID: t_2 | Source: manual | Title: Review paddy tiller count | Date: 2026-04-27 | Priority: Medium`,
  deepFarmContext: `Medium-deep clay loam paddy field in Dharwad with moderate rainfall variability, recurring lower-field water stagnation, and rising nitrogen drawdown after a 14-day cloudy spell. The farmer wants brand-specific, dosage-specific recommendations and realistic field operations matched to conventional transplant paddy.`,
  translationBatchBefore: JSON.stringify([
    'Open the inlet for 20 minutes',
    'Open the inlet for 20 minutes',
    'Apply urea only after drainage improves',
    'Apply urea only after drainage improves',
    'Review mandi price trend tomorrow morning'
  ]),
  translationBatchAfter: JSON.stringify([
    'Open the inlet for 20 minutes',
    'Apply urea only after drainage improves',
    'Review mandi price trend tomorrow morning'
  ]),
};

const oldHistory = sample.chatLog.slice(-8).map(m => ({
  role: m.role === 'ai' ? 'assistant' : 'user',
  content: m.text,
}));

const newHistory = [
  {
    role: 'system',
    content: 'Conversation summary:\nAssistant: Welcome! I am your active AI Agronomist. How can I assist with your paddy today?\nUser: The field had patchy water logging last week.\nAssistant: Check drainage first and monitor yellowing severity over the next two days.\nUser: I also noticed slow tillering in the lower patch.',
  },
  {
    role: 'assistant',
    content: 'That can indicate nutrient stress or root damage after standing water.',
  },
  {
    role: 'user',
    content: 'The local mandi price looked weak yesterday.',
  },
  {
    role: 'assistant',
    content: 'We can review district mandi trends before you plan harvest timing.',
  },
  {
    role: 'user',
    content: 'Please compare that with the likely rain outlook too.',
  },
];

const oldAssistantPrompt = `You are an Agronomist Agent for farmers. Provide actionable, detailed, and highly definite agronomy advice using the farm context. You MUST specify exact product/brand names, mixing dosages (e.g. kg/acre, ml/L), and precise methodologies (e.g. ploughing depths) instead of generic advice.
Jurisdiction: Karnataka
Policy constraints:
- You MUST provide highly detailed, definite instructional descriptions for every task.
- When recommending fertilizers or pesticides, provide specific product/brand names along with exact dosages and mixing quantities.
- For physical tasks like soil prep or ploughing, specify the exact methods, depths, and parameters.
Return a single JSON object (no markdown) with this shape:
{"message":"...","actions":[{"type":"create_task","title":"Example task title","date":"YYYY-MM-DD","priority":"High|Medium|Low","description":"Detailed, definite instructions for this task."}]}
You may also include an optional "meta" object.
Actions allowed:
- create_task with priority High|Medium|Low
- update_task with patch fields title/date/priority/description
- delete_task

TASK ACTION RULES:
[CREATE TASK] Only create new tasks when the user EXPLICITLY asks to add or schedule something.
[UPDATE TASK] Use update_task when the user explicitly asks to change, rename, reschedule, reorganise, move, push back, or adjust existing tasks.
[DELETE TASK] Only delete a task when the user explicitly asks to remove, cancel, or delete it.

Farm Context:
${sample.context}

Sensor Snapshot:
${sample.sensorSnapshot}

5-Day Weather Forecast Summary:
${sample.forecast}

Market Prices Summary:
${sample.market}

${sample.tasks}
You must reply in the language with ISO 639-1 code: en.`;

const newAssistantPrompt = `You are an Agronomist Agent for farmers. Provide actionable, detailed, and highly definite agronomy advice using the farm context. You MUST specify exact product or brand names, mixing dosages such as kg/acre or ml/L, and precise methodologies instead of generic advice.
Jurisdiction: Karnataka
Policy constraints:
- You MUST provide highly detailed, definite instructional descriptions for every task.
- When recommending fertilizers or pesticides, provide specific product or brand names along with exact dosages and mixing quantities.
- For physical tasks like soil prep or ploughing, specify the exact methods, depths, and parameters.
Return only one JSON object wrapped in <AGRO_JSON> and </AGRO_JSON>. Do not write markdown or any other text. Shape: <AGRO_JSON>{"message":"Detailed answer for the farmer.","actions":[{"type":"create_task","title":"Example task title","date":"YYYY-MM-DD","priority":"High|Medium|Low","description":"Detailed, definite instructions for this task."}]}</AGRO_JSON>
Task policy:
- Only use actions the user explicitly requested.
- If the request is ambiguous, set actions to [].
- create_task is allowed for explicit scheduling or reminder requests.

Farm Context:
${sample.compactContext}

Sensor Snapshot:
${sample.compactSensorSnapshot}

5-Day Weather Forecast Summary:
${sample.forecast}

${sample.tasks}
You must reply in the language with ISO 639-1 code: en. Keep JSON keys, action types, and field names in English.`;

const oldSchedulePrompt = `You are a Master Agricultural Planner.
You must generate a schedule that is practical and compliant.
Jurisdiction: Karnataka
Constraints:
- You MUST provide highly detailed, definite instructional descriptions for every task.
- When recommending fertilizers or pesticides, you MUST provide specific product or brand names along with exact dosages and mixing quantities precisely tailored to the farm context.
- For physical tasks like soil prep or ploughing, specify the exact methods, depths, and parameters.
- Optimize all instructions to strictly match the provided deep farm context.
Return a single JSON object (no markdown) with this shape:
{"message":"...","actions":[{"type":"create_task","title":"Example task title","date":"YYYY-MM-DD","priority":"High|Medium|Low","description":"Detailed, definite instructions for this task."}]}
Rules:
- actions must contain 5 to 10 create_task objects
- action.type must be "create_task"
- priority must be High|Medium|Low
- dates must be realistic based on start date (2026-05-01)
- do not include update_task or delete_task
Use the message field for a 1-2 sentence summary of the schedule.
Deep Farm Context:
${sample.deepFarmContext}`;

const newSchedulePrompt = `You are a Master Agricultural Planner.
You must generate a schedule that is practical and compliant.
Jurisdiction: Karnataka
Constraints:
- You MUST provide highly detailed, definite instructional descriptions for every task.
- When recommending fertilizers or pesticides, you MUST provide specific product or brand names along with exact dosages and mixing quantities precisely tailored to the farm context.
- For physical tasks like soil prep or ploughing, specify the exact methods, depths, and parameters.
- Optimize all instructions to strictly match the provided deep farm context.
Return only one JSON object wrapped in <AGRO_JSON> and </AGRO_JSON>. Do not write markdown or any other text. Shape: <AGRO_JSON>{"message":"Short summary of the schedule.","actions":[{"type":"create_task","title":"Example task title","date":"YYYY-MM-DD","priority":"High|Medium|Low","description":"Detailed, definite instructions for this task."}]}</AGRO_JSON>
Rules:
- actions must contain 5 to 10 create_task objects
- action.type must be "create_task"
- priority must be High|Medium|Low
- dates must be realistic based on start date (2026-05-01)
- do not include update_task or delete_task
Use the message field for a 1-2 sentence summary of the schedule.
Deep Farm Context:
${sample.deepFarmContext}`;

const scenarios = [
  {
    name: 'assistant',
    oldPromptTokens: estimateMessages([{ role: 'system', content: oldAssistantPrompt }, ...oldHistory, { role: 'user', content: sample.userPrompt }]),
    newPromptTokens: estimateMessages([{ role: 'system', content: newAssistantPrompt }, ...newHistory, { role: 'user', content: sample.userPrompt }]),
    detailPreserved: ['brand', 'dosages', 'methods'].every(term => newAssistantPrompt.toLowerCase().includes(term)),
  },
  {
    name: 'schedule',
    oldPromptTokens: estimateMessages([{ role: 'system', content: oldSchedulePrompt }, { role: 'user', content: sample.userPrompt }]),
    newPromptTokens: estimateMessages([{ role: 'system', content: newSchedulePrompt }, { role: 'user', content: sample.userPrompt }]),
    detailPreserved: ['brand', 'dosages', 'methods'].every(term => newSchedulePrompt.toLowerCase().includes(term)),
  },
  {
    name: 'translation_batch',
    oldPromptTokens: estimateTokens(sample.translationBatchBefore),
    newPromptTokens: estimateTokens(sample.translationBatchAfter),
    detailPreserved: true,
  },
];

const rows = scenarios.map((scenario) => {
  const saved = scenario.oldPromptTokens - scenario.newPromptTokens;
  const pct = scenario.oldPromptTokens > 0 ? ((saved / scenario.oldPromptTokens) * 100).toFixed(1) : '0.0';
  return {
    scenario: scenario.name,
    old_prompt_tokens_est: scenario.oldPromptTokens,
    new_prompt_tokens_est: scenario.newPromptTokens,
    saved_tokens_est: saved,
    saved_percent: `${pct}%`,
    detail_preserved: scenario.detailPreserved ? 'yes' : 'no',
  };
});

const totalOld = rows.reduce((sum, row) => sum + row.old_prompt_tokens_est, 0);
const totalNew = rows.reduce((sum, row) => sum + row.new_prompt_tokens_est, 0);
const totalSaved = totalOld - totalNew;
const totalPct = totalOld > 0 ? ((totalSaved / totalOld) * 100).toFixed(1) : '0.0';

console.table(rows);
console.log(`Total old prompt tokens est: ${totalOld}`);
console.log(`Total new prompt tokens est: ${totalNew}`);
console.log(`Total saved tokens est: ${totalSaved} (${totalPct}%)`);
