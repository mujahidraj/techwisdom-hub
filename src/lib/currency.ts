// Bangladesh Taka (BDT) currency formatting utilities

export const CURRENCY_SYMBOL = '৳';
export const CURRENCY_CODE = 'BDT';

/**
 * Format a number as BDT currency
 */
export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return `${CURRENCY_SYMBOL}0`;
  
  // Use Bangladeshi locale formatting (lakhs/crores style)
  return `${CURRENCY_SYMBOL}${numAmount.toLocaleString('en-BD')}`;
}

/**
 * Format currency with short notation (K for thousands, L for lakhs, Cr for crores)
 */
export function formatCurrencyShort(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return `${CURRENCY_SYMBOL}0`;
  
  if (numAmount >= 10000000) {
    return `${CURRENCY_SYMBOL}${(numAmount / 10000000).toFixed(1)}Cr`;
  } else if (numAmount >= 100000) {
    return `${CURRENCY_SYMBOL}${(numAmount / 100000).toFixed(1)}L`;
  } else if (numAmount >= 1000) {
    return `${CURRENCY_SYMBOL}${(numAmount / 1000).toFixed(1)}K`;
  }
  return `${CURRENCY_SYMBOL}${numAmount.toLocaleString('en-BD')}`;
}

/**
 * Parse a currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[৳,\s]/g, '')) || 0;
}
