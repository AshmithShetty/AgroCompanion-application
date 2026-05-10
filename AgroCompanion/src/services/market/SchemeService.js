import { districtKnowledgeBase } from '../../data/districtKnowledgeBase';

export const SchemeService = {
  getEligibleSchemes: async (state, crop) => {
    const s = (state || '').toString().trim();
    const c = (crop || '').toString().trim();

    const baseSchemes = [
      { name: 'PM-KISAN', benefit: '₹6,000/year direct income support', eligible: true, coverage: 'National' },
      { name: 'PM Fasal Bima Yojana', benefit: 'Crop insurance at low premiums', eligible: true, coverage: 'National' },
      { name: 'Soil Health Card Scheme', benefit: 'Free soil testing and nutrient advice', eligible: true, coverage: 'National' }
    ];

    const stateSchemes = {
      'Karnataka': [
        { name: 'Krishi Bhagya', benefit: 'Subsidy for farm ponds and polytunnels', eligible: true, coverage: 'State' },
        { name: 'Raitha Vidyanidhi', benefit: 'Scholarship for children of farmers', eligible: true, coverage: 'State' }
      ],
      'Uttar Pradesh': [
        { name: 'UP Mukhyamantri Krishak Durghatna Kalyan Yojana', benefit: 'Accidental insurance for farmers', eligible: true, coverage: 'State' },
        { name: 'Pankaj Advani Scheme', benefit: 'Irrigation equipment subsidy', eligible: true, coverage: 'State' }
      ],
      'Jammu and Kashmir': [
        { name: 'HADP (Holistic Agriculture Development Program)', benefit: 'Comprehensive support for 29 projects', eligible: true, coverage: 'State' }
      ]
    };

    const cropSpecific = [];
    if (c.toLowerCase().includes('paddy') || c.toLowerCase().includes('rice')) {
      cropSpecific.push({ name: 'SRI Technique Incentive', benefit: 'Bonus for water-saving cultivation', eligible: true, coverage: 'Crop-Specific' });
    }

    return [
      ...baseSchemes,
      ...(stateSchemes[s] || []),
      ...cropSpecific
    ];
  }
};
