/**
 * Everything that names the product lives here. Change `name` and the whole app follows: page titles,
 * the wordmark, error copy, legal pages, server logs, and the HTML shell, which Vite rewrites at build
 * time from these same values. Nothing else in the codebase should spell the product name out.
 */
const name = 'Recall';
const domain = 'recall.app';

export const BRAND = {
  name,
  /** The lowercase wordmark in the sidebar and on the marketing header. */
  wordmark: name.toLowerCase(),
  tagline: 'Learn a little. Remember a lot.',
  description: `${name}: a thoughtful space to create flashcards, learn together, and remember more.`,
  title: `${name}, your learning library`,
  domain,
  legalName: `${name} Learning`,
  city: 'Bengaluru',
  country: 'India',
  /** Addresses printed on the contact and legal pages. */
  email: {
    general: `hello@${domain}`,
    billing: `billing@${domain}`,
    privacy: `privacy@${domain}`,
    security: `security@${domain}`,
  },
  /** Shown as the "last updated" date on the terms and privacy pages. */
  policyUpdated: '23 September 2026',
};

export const brandName = BRAND.name;
