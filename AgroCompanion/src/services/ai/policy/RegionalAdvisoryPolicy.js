const normalizeCode = (value) => (value || '').toString().trim().toLowerCase();

const buildSection = (title, items = []) => {
  const lines = (Array.isArray(items) ? items : []).filter(Boolean);
  if (lines.length === 0) {
    return '';
  }
  return `${title}\n${lines.map(item => `- ${item}`).join('\n')}`;
};

const buildPromptBlock = (profile) => {
  if (!profile) {
    return '';
  }

  const parts = [
    `Regional rulebook for ${profile.name}, ${profile.state}:`,
    buildSection('Regional snapshot', profile.snapshot),
    buildSection('Agent operating rules', profile.rulebook),
    buildSection('Clarify before giving precise instructions', profile.mandatoryClarifications),
    buildSection('Never assume', profile.disallowedAssumptions),
    buildSection('Escalate or defer when', profile.escalationRules),
  ].filter(Boolean);

  return parts.join('\n\n');
};

const districtProfiles = {
  agra: {
    id: 'agra',
    name: 'Agra',
    state: 'Uttar Pradesh',
    jurisdiction: 'IN',
    version: '2026-04-24',
    snapshot: [
      'Treat Agra as a hot semi-arid to sub-humid alluvial district with concentrated monsoon rainfall, intense summer heat, winter cold stress, and meaningful drought, flood, heat-wave, and cold-wave exposure in the district contingency data.',
      'Base crop reasoning on the local mix in agridata: wheat, pearl millet, potato, rapeseed-mustard, paddy, and pigeonpea are major anchors, with vegetables and fodder also relevant.',
      'Assume water is a constrained input, not an abundant default. Agridata marks 6 over-exploited blocks, 1 critical block, and 3 semi-critical blocks, while CGWB Agra aquifer mapping notes brackish and saline groundwater pockets together with heavy dependence on groundwater.',
      'Prefer soil-sensitive recommendations for alluvial to sandy-loam situations unless the user has a confirmed soil test showing otherwise.',
    ],
    rulebook: [
      'Every irrigation, fertigation, or spray schedule must be tied to water source reliability, salinity risk, and current weather rather than generic calendar advice.',
      'For wheat, mustard, potato, and rabi vegetables, prioritize heat and terminal-stress avoidance, irrigation efficiency, and realistic sowing or operation windows rather than assuming long cool seasons.',
      'For paddy or vegetable recommendations, explicitly address drainage and flood recovery steps because the district profile includes both drought and flood contingencies.',
      'When advice depends on exact dose, product, or mixing, ground it in current farm conditions and ask for the water source or label details if groundwater quality can materially change safety or efficacy.',
      'Keep market or crop planning advice aligned with the western Uttar Pradesh rabi pattern highlighted in ICAR advisories: wheat, mustard, chickpea, lentil, pea, potato, onion, tomato, cauliflower, and cabbage remain practical reference crops for the broader region.',
    ],
    mandatoryClarifications: [
      'Ask which water source is being used before giving precise irrigation or chemical application advice: canal, borewell, tubewell, stored rainwater, tanker, or mixed sources.',
      'Ask whether the field has drainage congestion, prior salinity or white crust issues, or flood history before finalizing paddy, potato, or vegetable recommendations.',
      'Ask for crop stage before giving exact nutrient, spray, or stress-management steps.',
      'Ask whether the plot is irrigated or largely rainfed before giving sowing-density or rescue-irrigation advice.',
    ],
    disallowedAssumptions: [
      'Do not assume groundwater is uniformly safe or fresh across Agra.',
      'Do not assume monsoon rainfall alone is sufficient to carry long-duration crops without irrigation support.',
      'Do not assume potato, paddy, or vegetable fields can tolerate poor drainage.',
      'Do not assume a heat-sensitive rabi crop can be extended deep into late season without yield or quality penalties.',
    ],
    escalationRules: [
      'Escalate when the farmer reports saline water, repeated germination failure, standing water, severe lodging after storms, or unresolved wilt, rot, or blight across a large area.',
      'Escalate to local extension or laboratory support when irrigation water quality or soil salinity is unknown but the user wants precise high-investment input plans.',
      'Defer exact pesticide, fungicide, or herbicide brand and dosage guidance if the farmer cannot confirm crop stage, water source, or label details and the recommendation would be high-risk.',
    ],
    guardrails: {
      highRainOrFloodRisk: true,
      waterStressed: true,
      groundwaterSensitive: true,
      requireWaterSourceFor: ['irrigat', 'drip', 'sprinkler', 'watering', 'borewell', 'tubewell', 'groundwater', 'fertig', 'water schedule'],
      requireDrainageCheckFor: ['potato', 'paddy', 'rice', 'tomato', 'cauliflower', 'vegetable', 'onion'],
      requireHeatRiskCheckFor: ['wheat', 'potato', 'mustard', 'onion', 'tomato', 'cauliflower', 'cabbage'],
      requireSalinityCheckFor: ['potato', 'paddy', 'rice', 'tomato', 'vegetable', 'wheat', 'mustard'],
      blockedOutputPatterns: [
        /groundwater\s+(?:is|will be)\s+(?:always|uniformly)\s+safe/i,
        /salinity\s+(?:is|will be)\s+not\s+a\s+concern/i,
      ],
      waterSourceMessage: 'Agra recommendations need the irrigation source first because the district has over-exploited blocks and saline or brackish groundwater pockets. Tell me whether the field depends on canal water, borewell or tubewell water, stored rainwater, or another source.',
      drainageMessage: 'Agra advice for this crop needs drainage context before I give a precise plan because the district has both drought and flood contingencies. Tell me whether the plot waterlogs after rain and whether drainage channels or raised beds are available.',
      heatMessage: 'Agra advice for this crop needs current heat risk context before I give a precise schedule. Share whether the crop is already under heat stress and whether irrigation is available during hot spells.',
      salinityMessage: 'Agra input planning needs water-quality context before I give a precise recommendation. Tell me whether your irrigation water is borewell or tubewell based and whether you have seen salinity, brackish taste, or white crust in the field.',
      postcheckMessage: 'This answer conflicts with Agra guardrails on groundwater or salinity handling. I need to restate it with district-specific water constraints.',
    },
    sources: [
      {
        title: 'Agra district agridata contingency markdown',
        url: 'local://AgroCompanion/src/agrodata/agra.md',
      },
      {
        title: 'CGWB aquifer mapping and management plan for Agra district',
        url: 'https://cgwb.gov.in/cgwbpnm/publication-detail/874',
      },
      {
        title: 'ICAR Rabi Agro-Advisory for farmers for Uttar Pradesh',
        url: 'https://icar.org.in/sites/default/files/2022-09/Rabi-Agro-Advisory-2021-22_0.pdf',
      },
    ],
  },
  mirzapur: {
    id: 'mirzapur',
    name: 'Mirzapur',
    state: 'Uttar Pradesh',
    jurisdiction: 'IN',
    version: '2026-04-24',
    snapshot: [
      'Treat Mirzapur as a Vindhyan mixed-topography district with plains, midlands, and uplands, where the local contingency data shows both drought and flood exposure and large rainfed vulnerability.',
      'Base cropping logic on the agridata profile: cereals, pulses, oilseeds, millets, and mixed horticulture dominate, and lowland flood-prone pockets coexist with upland moisture stress.',
      'Use groundwater carefully. Agridata marks most blocks safe with one semi-critical block, while CGWB notes that some blocks can reach up to about 90 percent irrigation dependence on groundwater.',
      'Assume soils and water-holding capacity vary sharply by landform; do not flatten the district into one uniform command-area recommendation.',
    ],
    rulebook: [
      'Always differentiate upland, midland, and lowland situations before giving sowing, rescue, or substitution advice.',
      'For rainfed fields, emphasize contingency cropping, moisture conservation, staggered sowing windows, and lower-risk options instead of assuming timely irrigation access.',
      'For flood-prone lowlands or river-adjacent fields, prioritize drainage, short-duration recovery planning, and safe re-sowing or replanting logic.',
      'For pulses, millets, oilseeds, and mixed cropping systems, prefer resilient contingency advice that respects patchy water availability and uneven soils.',
      'When the user wants precise irrigation or fertigation guidance, first confirm whether the field is one of the groundwater-dependent blocks or primarily surface-water supported.',
    ],
    mandatoryClarifications: [
      'Ask whether the field is in upland, midland, valley, or floodplain position before giving crop-switch, sowing, or rescue advice.',
      'Ask whether the farm is mainly rainfed, uses farm ponds, depends on borewell water, or receives canal or lift irrigation.',
      'Ask whether recent rainfall caused runoff, erosion, or field inundation before finalizing nutrient or spray operations.',
      'Ask for crop stage and stand condition before giving contingency advice after a dry spell or flood event.',
    ],
    disallowedAssumptions: [
      'Do not assume uniform irrigation reliability across Mirzapur.',
      'Do not assume all soils behave like deep alluvium; upland and midland constraints matter.',
      'Do not assume low-lying fields can absorb more rain without flood damage.',
      'Do not assume a groundwater-based irrigation plan is sustainable everywhere in the district.',
    ],
    escalationRules: [
      'Escalate when the farmer reports repeated runoff erosion, failed establishment across uplands, or flood deposition and sand casting across lowlands.',
      'Escalate when irrigation planning depends on groundwater extraction intensity that the farmer cannot confirm.',
      'Defer exact chemical advice if the crop stand is severely damaged and re-sowing or partial replacement may be safer than treatment.',
    ],
    guardrails: {
      highRainOrFloodRisk: true,
      waterStressed: true,
      groundwaterSensitive: true,
      requireWaterSourceFor: ['irrigat', 'water', 'drip', 'sprinkler', 'borewell', 'groundwater', 'pond', 'lift irrigation', 'fertig'],
      requireDrainageCheckFor: ['paddy', 'rice', 'vegetable', 'pulse', 'pulses', 'tomato', 'onion'],
      requireWaterPositionCheckFor: ['sow', 'transplant', 'variety', 're-sow', 'resow', 'contingency'],
      blockedOutputPatterns: [
        /all\s+mirzapur\s+blocks\s+are\s+water\s+secure/i,
        /groundwater\s+can\s+be\s+used\s+freely\s+everywhere/i,
      ],
      waterSourceMessage: 'Mirzapur advice needs the water source first because groundwater dependence varies sharply by block and landform. Tell me whether this field is rainfed, pond supported, borewell based, or served by another source.',
      drainageMessage: 'Mirzapur advice for this crop needs land position and drainage context first because upland drought risk and lowland flood risk behave very differently. Tell me whether the field is upland, midland, or lowland and whether it waterlogs after rain.',
      landPositionMessage: 'Mirzapur contingency advice needs the field position first. Tell me whether the plot is upland, midland, valley, or floodplain so I can avoid giving the wrong crop or rescue plan.',
      postcheckMessage: 'This answer conflicts with Mirzapur guardrails on landform or groundwater handling. I need to restate it with district-specific field-position context.',
    },
    sources: [
      {
        title: 'Mirzapur district agridata contingency markdown',
        url: 'local://AgroCompanion/src/agrodata/mirzapur.md',
      },
      {
        title: 'CGWB aquifer mapping and groundwater management plan for Mirzapur district',
        url: 'https://cgwb.gov.in/cgwbpnm/public/publication-detail/934',
      },
      {
        title: 'ICAR study on soil characterization and fertility assessment in Mirzapur',
        url: 'https://epubs.icar.org.in/index.php/JISSS/article/view/122418',
      },
    ],
  },
  dharwad: {
    id: 'dharwad',
    name: 'Dharwad',
    state: 'Karnataka',
    jurisdiction: 'IN',
    version: '2026-04-24',
    snapshot: [
      'Treat Dharwad as a northern transitional Karnataka district with monsoon variability, dryland pressure, black-soil dominance in many tracts, and strong sorghum, pulse, oilseed, cereal, and cotton relevance.',
      'The agridata contingency profile and UAS Dharwad sources together support a planning bias toward sorghum, pulses, maize, soybean, wheat, chickpea, sunflower, safflower, onion, cotton, and related mixed systems.',
      'Use the district as drought-sensitive first and flood-sensitive second: the local contingency file includes both drought and flood measures, but dry-spell management remains central for many field crops.',
      'Do not treat Dharwad as a coastal or Himalayan system. Black soils, rainfed windows, and monsoon breaks should dominate reasoning.',
    ],
    rulebook: [
      'For rainfed planning, prioritize soil-moisture conservation, sowing-window discipline, and drought contingency over input-heavy schedules that assume uninterrupted rainfall.',
      'Where black soils are likely, explicitly account for infiltration, cracking, water-holding, and trafficability instead of using generic light-soil advice.',
      'For sorghum, chickpea, maize, soybean, pulses, and oilseeds, tie interventions to monsoon distribution and crop stage, not only calendar month.',
      'When high rainfall or wind risk is present, include drainage, staking, lodging prevention, and fungal-disease vigilance rather than assuming only drought management is needed.',
      'Use university-supported crop logic from the Dharwad region and avoid importing coastal plantation or temperate orchard assumptions into the district.',
    ],
    mandatoryClarifications: [
      'Ask whether the plot is rainfed or irrigated before giving exact schedules for maize, sorghum, soybean, chickpea, sunflower, safflower, or wheat.',
      'Ask whether the soil is deep black, medium black, or lighter textured before finalizing tillage, irrigation, or drainage advice.',
      'Ask whether the crop has already faced a monsoon break, late onset, or high-intensity rainfall spell before giving contingency instructions.',
      'Ask for crop stage and current stand uniformity before recommending re-sowing, gap filling, or nutrient rescue steps.',
    ],
    disallowedAssumptions: [
      'Do not assume coastal humidity, perennial waterlogging, or plantation-crop dominance in Dharwad.',
      'Do not assume light soil behavior where black soils may dominate.',
      'Do not assume a late monsoon correction fully offsets an earlier dry spell.',
      'Do not assume orchard frost or snow constraints are relevant to routine Dharwad advice.',
    ],
    escalationRules: [
      'Escalate when prolonged dry spells, failed establishment, or severe wilt cause major stand loss and the farm may need re-sowing rather than treatment.',
      'Escalate when black-soil waterlogging, root rot, or stem lodging is severe after high-intensity rainfall.',
      'Defer exact pesticide or fungicide programs when the crop, stage, and rainfall sequence are unclear and the wrong chemistry could worsen losses.',
    ],
    guardrails: {
      highRainOrFloodRisk: true,
      waterStressed: true,
      requireWaterSourceFor: ['irrigat', 'watering', 'drip', 'sprinkler', 'fertig', 'borewell', 'canal'],
      requireSoilTypeFor: ['till', 'plough', 'bed', 'drainage', 'irrigat', 'fertig', 'wheat', 'chickpea', 'sorghum', 'soybean', 'maize'],
      requireMonsoonStatusFor: ['sow', 'resow', 're-sow', 'transplant', 'contingency', 'variety', 'gap fill'],
      blockedOutputPatterns: [
        /coastal\s+salinity/i,
        /snowfall|apple\s+orchard|arecanut\s+garden/i,
      ],
      waterSourceMessage: 'Dharwad advice needs the irrigation source first because many recommendations change between rainfed and irrigated fields. Tell me whether the plot is rainfed, borewell based, canal supported, or uses another source.',
      soilTypeMessage: 'Dharwad advice needs the soil type first because black soils and lighter soils behave very differently for tillage, drainage, and irrigation. Tell me whether the plot is deep black, medium black, or lighter textured.',
      monsoonStatusMessage: 'Dharwad contingency advice needs the monsoon status first. Tell me whether sowing was on time, delayed, or affected by a dry spell or a high-rainfall event.',
      postcheckMessage: 'This answer conflicts with Dharwad guardrails on agro-climate or soil behavior. I need to restate it for a northern transitional dryland system.',
    },
    sources: [
      {
        title: 'Dharwad district agridata contingency markdown',
        url: 'local://AgroCompanion/src/agrodata/dharwad.md',
      },
      {
        title: 'University of Agricultural Sciences Dharwad regional overview',
        url: 'https://uasd.edu/en/',
      },
      {
        title: 'University of Agricultural Sciences Dharwad seed farm crop and soil references',
        url: 'https://uasd.edu/en/seed-farms/',
      },
    ],
  },
  udupi: {
    id: 'udupi',
    name: 'Udupi',
    state: 'Karnataka',
    jurisdiction: 'IN',
    version: '2026-04-24',
    snapshot: [
      'Treat Udupi as a hot humid coastal district with very high southwest monsoon rainfall, short intense flooding or waterlogging risk, and plantation-crop sensitivity to drainage and fungal pressure.',
      'Use the district agridata profile for a system led by paddy, coconut, arecanut, pepper, banana, pineapple, cashew, and mixed horticulture rather than inland dryland cereal logic.',
      'Assume drainage is a first-order management variable. The local contingency file repeatedly prioritizes proper drainage under heavy rainfall and waterlogging conditions.',
      'For low-lying paddy areas, incorporate flood tolerance and recovery logic. ICAR highlights Sahyadri Panchamukhi from Brahmavar, Udupi as a flood-resistant red rice that can withstand 8 to 12 days of flooding.',
    ],
    rulebook: [
      'For coconut, arecanut, pepper, banana, and paddy, advise drainage and excess-moisture management before high-input schedules whenever monsoon or waterlogging risk is present.',
      'Treat fungal disease pressure as structurally important in wet months, especially for plantation and orchard systems.',
      'For arecanut and plantation advice, keep monsoon disease and moisture management central rather than assuming dryland spray calendars.',
      'Where coconut systems are involved, respect the ICAR emphasis on drainage, water conservation, and suitable intercrops only where light and field condition allow.',
      'For coastal paddy in flood-prone pockets, prefer flood-resilient or shorter-duration recovery logic rather than inland upland rice assumptions.',
    ],
    mandatoryClarifications: [
      'Ask whether the plot is low-lying, flood-prone, or prone to standing water before giving rice, banana, coconut, arecanut, or vegetable recommendations.',
      'Ask whether drainage channels are functioning before giving fertilizer, spray, or irrigation instructions during wet periods.',
      'Ask whether the system is a pure plantation, mixed intercrop, or paddy field before recommending operations.',
      'Ask for current rainfall status and crop stage before giving exact disease or nutrient interventions in the monsoon period.',
    ],
    disallowedAssumptions: [
      'Do not assume a dryland inland climate or black-soil logic in Udupi.',
      'Do not assume waterlogging is a minor issue for plantation crops.',
      'Do not assume paddy fields in low-lying coastal tracts behave like upland rainfed rice.',
      'Do not assume fungal and rot pressure are secondary during wet months.',
    ],
    escalationRules: [
      'Escalate when coconut or arecanut palms show severe crown, stem, or root symptoms after prolonged wet spells.',
      'Escalate when floodwater or standing water persists and field drainage cannot be restored quickly.',
      'Defer exact curative chemistry when the user cannot confirm crop stage, drainage status, and recent rainfall because mis-timed applications in wet coastal systems can fail or injure crops.',
    ],
    guardrails: {
      highRainOrFloodRisk: true,
      requireDrainageCheckFor: ['paddy', 'rice', 'coconut', 'arecanut', 'pepper', 'banana', 'pineapple', 'cashew', 'vegetable'],
      requireMonsoonStatusFor: ['spray', 'fungicide', 'fertil', 'transplant', 'planting', 'variety', 'resow', 're-sow'],
      blockedOutputPatterns: [
        /no\s+need\s+for\s+drainage/i,
        /waterlogging\s+(?:is|will be)\s+not\s+a\s+concern/i,
        /treat\s+udupi\s+like\s+a\s+dryland\s+district/i,
      ],
      drainageMessage: 'Udupi advice for this crop needs drainage and field-elevation context first because the district is a high-rainfall coastal system. Tell me whether the plot is low-lying or waterlogged and whether drainage channels are open.',
      monsoonStatusMessage: 'Udupi advice needs current rainfall context first because wet-season timing changes disease, nutrition, and field-access decisions. Tell me whether the crop is under active monsoon rain, a break in rain, or a flood-recovery situation.',
      postcheckMessage: 'This answer conflicts with Udupi guardrails on drainage or coastal wet-season management. I need to restate it for a high-rainfall plantation and coastal paddy system.',
    },
    sources: [
      {
        title: 'Udupi district agridata contingency markdown',
        url: 'local://AgroCompanion/src/agrodata/udupi.md',
      },
      {
        title: 'ICAR note on flood-resistant Sahyadri Panchamukhi red rice in coastal Karnataka',
        url: 'https://www.icar.gov.in/en/node/5785',
      },
      {
        title: 'ICAR Kharif Agro-Advisories for Farmers 2025',
        url: 'https://icar.org.in/en/icar-kharif-agro-advisories-farmers-2025',
      },
    ],
  },
  srinagar: {
    id: 'srinagar',
    name: 'Srinagar',
    state: 'Jammu and Kashmir',
    jurisdiction: 'IN',
    version: '2026-04-24',
    snapshot: [
      'Treat Srinagar as a temperate Kashmir valley district where precipitation occurs as both rain and snow, cold-wave and frost management are routine, and the district profile explicitly says there is no standard southwest or northeast monsoon framework.',
      'Use the local district data for rice, maize, oilseeds, fodder, vegetables, apple, pear, plum, cherry, walnut, almond, and allied temperate horticulture rather than tropical crop logic.',
      'Assume orchard management is climate-sensitive. Frost, snowmelt, drainage, pruning timing, and dormancy status materially change safe recommendations.',
      'Treat water as constrained in some locations. Agridata marks 4 over-exploited blocks covering 54.59 percent of the district.',
    ],
    rulebook: [
      'For apple and other temperate fruit crops, align advice with orchard stage, frost risk, snowmelt, and drainage rather than generic monsoon calendars.',
      'Follow the SKUAST guidance pattern for orchards: drainage, sanitation, proper pollinizer arrangement, careful fertilizer placement at the drip line, and avoidance of risky pruning or spraying during freezing or unfavourable conditions.',
      'For pulses, vegetables, saffron, and other field crops, check cold stress, excess moisture, and waterlogging risk before recommending nutrient or spray steps.',
      'Do not import coconut, arecanut, or coastal plantation assumptions into Srinagar advice.',
      'When weather drives the recommendation, use actual frost, snow, rainfall, and temperature cues instead of generic India-wide kharif or rabi language.',
    ],
    mandatoryClarifications: [
      'Ask for orchard or crop stage before giving apple, pear, plum, cherry, walnut, almond, or saffron recommendations.',
      'Ask whether freezing temperatures, snowfall, or snowmelt have occurred recently before giving pruning, fertilizer, or spray advice.',
      'Ask whether the field or orchard has standing water, blocked drains, or saturated soil before recommending operations.',
      'Ask for irrigation source and current moisture status before giving precise nutrient or irrigation advice in over-exploited groundwater areas.',
    ],
    disallowedAssumptions: [
      'Do not describe Srinagar using southwest or northeast monsoon onset and cessation logic.',
      'Do not assume tropical plantation crops or high summer heat as a normal operating baseline.',
      'Do not assume orchard operations are safe during freezing conditions.',
      'Do not assume snowmelt drainage is irrelevant to spring recommendations.',
    ],
    escalationRules: [
      'Escalate when orchard dieback, widespread scab or canker symptoms, severe frost damage, or persistent saturation threaten tree survival.',
      'Escalate when the user wants precise curative orchard chemistry without crop stage, forecast, or disease confirmation.',
      'Defer exact pruning or grafting timing if recent freezing or snow events are unknown.',
    ],
    guardrails: {
      highRainOrFloodRisk: true,
      groundwaterSensitive: true,
      requireWaterSourceFor: ['irrigat', 'watering', 'borewell', 'groundwater', 'canal', 'fertig'],
      requireColdRiskCheckFor: ['apple', 'pear', 'plum', 'cherry', 'walnut', 'almond', 'saffron', 'pea', 'onion', 'vegetable', 'prun', 'graft', 'spray'],
      requireDrainageCheckFor: ['apple', 'pear', 'plum', 'saffron', 'pea', 'vegetable', 'orchard'],
      blockedOutputPatterns: [
        /\bsw\s+monsoon\b/i,
        /southwest\s+monsoon/i,
        /northeast\s+monsoon/i,
        /\bcoconut\b|\barecanut\b|\bpepper\b/i,
      ],
      waterSourceMessage: 'Srinagar advice needs the irrigation source first because parts of the district are groundwater stressed and orchard recommendations change with water availability. Tell me whether the field uses canal water, borewell water, snowmelt, or another source.',
      coldRiskMessage: 'Srinagar advice for this crop needs recent cold and frost context first. Tell me whether there was freezing temperature, frost, snowfall, or snowmelt in the last few days and what growth stage the crop or orchard is in.',
      drainageMessage: 'Srinagar advice needs drainage context first because snowmelt and excess moisture can change safe orchard and field operations. Tell me whether there is standing water or blocked drainage in the plot.',
      postcheckMessage: 'This answer conflicts with Srinagar guardrails on temperate-climate management. I need to restate it without monsoon or tropical assumptions.',
    },
    sources: [
      {
        title: 'Srinagar district agridata contingency markdown',
        url: 'local://AgroCompanion/src/agrodata/srinagar.md',
      },
      {
        title: 'SKUAST Kashmir district level agromet advisory, 21 April 2026',
        url: 'https://skuastkashmir.ac.in/frmPDF.aspx?FN=GKMS_English_Kashmir-21-04-2026-Sf.pdf',
      },
      {
        title: 'SKUAST Kashmir district level agromet advisory, 24 December 2024',
        url: 'https://skuastkashmir.ac.in/frmPDF.aspx?FN=GKMS_English_Kashmir-24-12-2024-Sf.pdf',
      },
      {
        title: 'SKUAST Kashmir district level agromet advisory, 27 January 2025',
        url: 'https://skuastkashmir.ac.in/frmPDF.aspx?FN=GKMS_English_Kashmir-27-01-2025-Sf.pdf',
      },
    ],
  },
};

const defaultProfile = {
  id: 'default',
  name: 'India generic',
  state: 'India',
  jurisdiction: 'IN',
  version: '2026-04-24',
  snapshot: [
    'Use district-specific farm data, weather, crop stage, and water context whenever available.',
  ],
  rulebook: [
    'Do not give precise input plans without crop stage and current field conditions.',
  ],
  mandatoryClarifications: [
    'Ask for crop stage and field condition before high-risk recommendations.',
  ],
  disallowedAssumptions: [
    'Do not assume irrigation reliability, soil type, or weather timing without context.',
  ],
  escalationRules: [
    'Escalate when the crop is failing across the field or the user lacks the basic details needed for safe precision advice.',
  ],
  guardrails: {
    blockedOutputPatterns: [],
    postcheckMessage: 'This answer conflicts with the active agricultural guardrails. I need to restate it with safer assumptions.',
  },
  sources: [],
};

const getDistrictProfile = (districtCode) => {
  const key = normalizeCode(districtCode);
  if (districtProfiles[key]) {
    return districtProfiles[key];
  }

  const matchByName = Object.values(districtProfiles).find(profile => normalizeCode(profile.name) === key);
  return matchByName || defaultProfile;
};

const buildCompactSummary = (profile) => {
  if (!profile) {
    return '';
  }
  return profile.snapshot.slice(0, 2).join(' ');
};

export const RegionalAdvisoryPolicy = {
  version: '2026-04-24',
  districts: districtProfiles,
  defaultProfile,
  getDistrictProfile,
  buildPromptBlock,
  buildCompactSummary,
};
