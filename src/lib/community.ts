/**
 * The applicant-facing WhatsApp group.
 *
 * Everything after a slot is booked — panel changes, meeting links, reminders,
 * results — is announced there, so the link is treated as part of the booking
 * confirmation rather than as an optional extra.
 *
 * Only applicants who actually hold a slot are shown it. An invite link is a
 * bearer credential: anyone holding it can join, so it must not appear on a page
 * a non-shortlisted applicant can reach. Every render site gates on the booked
 * slot, and the link is only ever mailed by the booking/reschedule confirmation.
 *
 * Overridable so a new invite can be rotated in without a code change.
 */
export const WHATSAPP_GROUP_URL =
    import.meta.env.VITE_WHATSAPP_GROUP_URL || 'https://chat.whatsapp.com/FPO0W4gBq3a5JLADErVqPR';

/** One wording, used by the UI card and the confirmation emails alike. */
export const WHATSAPP_GROUP_NOTICE =
    'All further communication — meeting links, schedule changes and results — happens only in this group. Join it now so you do not miss anything.';
