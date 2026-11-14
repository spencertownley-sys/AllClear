/**
 * Who runs NimbusWatch and how to reach them. Shown on the privacy, terms and cookie pages and in the
 * site footer. Values in square brackets are placeholders the owner must fill in before launch.
 */
export const LEGAL = {
  operatorName: '[PLACEHOLDER: owner legal name or company]',
  operatorLocation: '[PLACEHOLDER: city, state, country]',
  contactEmail: '[PLACEHOLDER: contact email for privacy and support]',
  governingLaw: '[PLACEHOLDER: state and country whose law governs the terms]',
  /** Shown as "Last updated" on the legal pages. Change it whenever the policies change. */
  lastUpdated: '14 November 2026',
} as const;

/** True once a real address replaces the placeholder, so it can be rendered as a mailto link. */
export function isRealEmail(value: string): boolean {
  return !value.startsWith('[') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
