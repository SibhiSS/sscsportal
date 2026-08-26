/**
 * Recruitment kill switch.
 *
 * While true:
 *  - every recruitment route (/apply, /status, /schedule, /register) redirects
 *    to the landing page — see App.tsx
 *  - every "Apply" / "Book Slot" / "Application Received" CTA is replaced by a
 *    "Recruitment Closed" button pointing at Instagram, where results were
 *    announced — see HeroSection, JoinSection, Navigation
 *
 * This deliberately outranks the per-candidate states (applied / selected /
 * slot booked). Those were still linking candidates into the portal after the
 * results went out.
 *
 * The rest of the site — About, Domains, Events, Contact, /team — stays open.
 *
 * To reopen recruitment: set this to false and redeploy.
 */
export const RECRUITMENT_CLOSED = true;

export const INSTAGRAM_URL = 'https://www.instagram.com/ieee_sscs_vitcc/';
