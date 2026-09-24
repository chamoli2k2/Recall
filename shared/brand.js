/**
 * Everything that names the product lives here. Change `name` and the whole app follows: page titles,
 * the wordmark, error copy, legal pages, server logs, the session cookie, browser storage keys, and
 * the HTML shell, which Vite rewrites at build time from these same values. Nothing else in the
 * codebase should spell the product name out.
 *
 * The word "recall" also means retrieving a memory, which is what a flashcard app does. Those uses
 * are the vocabulary of spaced repetition rather than the brand, so they stay as they are.
 */
const name = 'Remio';
const domain = 'remio.app';

/** Where everything written to the product actually lands today. */
const contact = 'gauravprakash.dev@gmail.com';

/** Lowercase and safe for cookie names, storage keys, log prefixes, and filenames. */
const slug = name.toLowerCase();

export const BRAND = {
  name,
  slug,
  tagline: 'Learn a little. Remember a lot.',
  description: `${name}: a thoughtful space to create flashcards, learn together, and remember more.`,
  title: `${name}, your learning library`,
  domain,
  legalName: `${name} Learning`,
  city: 'Bengaluru',
  country: 'India',
  /**
   * Addresses printed on the contact and legal pages. They all point at one inbox for now, so the
   * split is about telling the reader what a message is for rather than about routing. Give each
   * one its own address on the domain once that inbox is worth splitting up.
   */
  email: {
    general: contact,
    billing: contact,
    privacy: contact,
    security: contact,
  },
  /** Shown as the "last updated" date on the terms and privacy pages. */
  policyUpdated: '25 September 2026',

  /** From header on anything the server sends. MAIL_FROM overrides it per environment. */
  mailFrom: `${name} <${contact}>`,

  sessionCookie: `${slug}_session`,
  /** Keys this app owns in localStorage. */
  storage: {
    theme: `${slug}-theme`,
    sidebar: `${slug}:sidebar`,
    draft: `${slug}-draft`,
  },

  /**
   * Slugs the product used to go by. A rename would otherwise invalidate every session cookie and
   * every saved preference, so both are still read under these names and rewritten under the current
   * one. Safe to empty once the old sessions have expired.
   */
  legacySlugs: ['recall'],
};

export const brandName = BRAND.name;

/** Cookie names to accept on an incoming request, current first. */
export const sessionCookieNames = [BRAND.sessionCookie, ...BRAND.legacySlugs.map(s => `${s}_session`)];

/** Storage keys to read for `which`, current first, so a rename keeps the saved value. */
export const storageKeys = which =>
  [BRAND.storage[which], ...BRAND.legacySlugs.map(s => BRAND.storage[which].replace(BRAND.slug, s))];
