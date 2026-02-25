// src/config/companyRouting.js

/**
 * Simple routing rules:
 * - MAIN CO: default
 * - EXPORT CO: items whose itemNo starts with "EXP-"
 *
 * Replace this with whatever logic you want: prefixes, ranges, categories, etc.
 */

export const COMPANY_ROUTING_RULES = [
  {
    company: 'CM',
    prefixes: ['BK','BJ'] // any item starting with EXP- → EXPORT CO
  },
  {
    company: 'FCL',
    prefixes: ['J','K'] // catch-all / default
  },
  ];

/**
 * Determine which company an item belongs to based on itemNo.
 * In a more advanced setup, this could query a DB or Business Central.
 */
export function getCompanyForItem(itemNo) {
  if (!itemNo) return 'MAIN CO';

  // Try specific prefixes first
  for (const rule of COMPANY_ROUTING_RULES) {
    if (!rule.prefixes) continue;
    for (const p of rule.prefixes) {
      if (p && itemNo.startsWith(p)) {
        return rule.company;
      }
    }
  }

  // Fallback to MAIN CO
  return 'MAIN CO';
}

/**
 * Given a full order body, returns a list of companies that have at least one line.
 */
export function determineCompaniesFromOrder(body) {
  const companies = new Set();

  if (Array.isArray(body.lines)) {
    for (const line of body.lines) {
      if (!line || !line.itemNo) continue;
      const company = getCompanyForItem(line.itemNo);
      companies.add(company);
    }
  }

  if (companies.size === 0) {
    companies.add('MAIN CO');
  }

  return Array.from(companies);
}
