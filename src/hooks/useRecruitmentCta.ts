import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRecruitmentWindow } from '@/hooks/useRecruitmentWindow';
import { RECRUITMENT_CLOSED, INSTAGRAM_URL } from '@/config/recruitment';

export type RecruitmentCta =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'router'; label: string; to: string }
  | { kind: 'disabled'; label: string };

/** The one recruitment call-to-action to show, from the kill switch, the window and the signed-in applicant's status. */
export function useRecruitmentCta(): RecruitmentCta {
  const { user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);
  const { isOpen } = useRecruitmentWindow();

  useEffect(() => {
    if (!user) { setStatus(null); setNotified(false); return; }
    let active = true;
    supabase
      .from('applications')
      .select('id, status, shortlist_notified')
      .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
      .limit(1)
      .then(({ data }) => {
        if (!active) return;
        setStatus(data && data.length > 0 ? data[0].status : null);
        setNotified(!!data?.[0]?.shortlist_notified);
      });
    return () => { active = false; };
  }, [user]);

  if (RECRUITMENT_CLOSED) return { kind: 'link', label: 'Follow on Instagram', href: INSTAGRAM_URL };
  // A shortlisted applicant who has not been emailed yet must not be told they can book.
  if (status === 'shortlisted' && notified) return { kind: 'router', label: 'Book Slot', to: '/schedule' };
  if (status === 'interview_scheduled') return { kind: 'router', label: 'View Interview Slot', to: '/status' };
  if (status && ['selected', 'active_member'].includes(status)) return { kind: 'router', label: 'Application Selected', to: '/status' };
  if (status) return { kind: 'disabled', label: 'Application Received' };
  if (!isOpen) return { kind: 'disabled', label: 'Recruitment Closed' };
  return { kind: 'router', label: 'Join the Club', to: '/apply' };
}
