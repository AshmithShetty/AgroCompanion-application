export const AgAdvicePolicyV1 = {
  id: 'ag_advice_policy_v1',
  version: '2026-04-10',
  jurisdiction: {
    default: 'IN',
    supported: ['IN'],
  },
  constraints: {
    dosage: {
      allowWithoutUserProvidedLabel: true,
    },
    mixing: {
      allowWithoutUserProvidedLabel: true,
    },
    medicalOrVeterinary: {
      allow: false,
    },
    illegalOrWeaponized: {
      allow: false,
    },
  },
  rules: [
    {
      id: 'illegal_or_weaponized',
      stage: ['pre', 'post'],
      kind: 'refuse',
      tags: ['illegal'],
      patterns: [
        /(?:\bpoison\b|\bexplosive\b|\bbomb\b|\bricin\b|\bcyanide\b|\bweapon\b)/i,
        /(?:\bविस्फोटक\b|\bबम\b|\bजहर\b|\bहथियार\b)/i,
        /(?:\bस्फोटक\b|\bबॉम्ब\b|\bविष\b|\bहत्यार\b)/i,
      ],
      messageKey: 'errors:ai.blocked_illegal',
    },
    {
      id: 'medical_or_veterinary',
      stage: ['pre', 'post'],
      kind: 'refuse',
      tags: ['medical'],
      patterns: [
        /(?:\bfever\b|\bmedicine\b|\bdoctor\b|\bveterinary\b|\bvet\b|\bpregnan|\bdose\b|\btablet\b)/i,
        /(?:\bबुखार\b|\bदवा\b|\bडॉक्टर\b|\bपशुचिकित्सा\b|\bडोज\b)/i,
        /(?:\bताप\b|\bऔषध\b|\bडॉक्टर\b|\bपशुवैद्य\b|\bडोस\b)/i,
      ],
      messageKey: 'errors:ai.blocked_medical',
    },

  ],
};
