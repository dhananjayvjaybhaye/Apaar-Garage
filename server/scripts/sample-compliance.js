import { certificationAge } from '../src/config/business.js';

// Fictional data solely for local/demo inventory. These are not legal declarations.
export function sampleCompliance(item) {
  return {
    status: 'published',
    sku: 'DEMO-' + item.slug.toUpperCase(),
    mrp: item.price,
    gstRatePercent: 0,
    hsnCode: '9503',
    countryOfOrigin: 'India',
    manufacturerName: 'Apaar Demo Workshop (fictional)',
    manufacturerAddress: 'Sample record only',
    genericName: item.productType === 'rc' ? 'Radio-controlled toy' : 'Diecast collectible',
    netQuantity: '1 unit',
    ageGradeMin: Math.max(certificationAge, item.recommendedAge ?? 0),
  };
}
