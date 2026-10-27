import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags, type FeatureFlags } from '@/hooks/useFeatureFlags';

/**
 * Renders its page only while a super admin has the feature switched on (Admin > Settings > Features).
 * Admins and super admins are sent back to the admin home otherwise; other roles (e.g. interviewers)
 * are not gated here, their own checks apply.
 */
export default function FeatureOnly({ feature, children }: { feature: keyof FeatureFlags; children: ReactNode }) {
  const { user } = useAuth();
  const flags = useFeatureFlags();
  const isPanelUser = user?.role === 'super_admin' || user?.role === 'admin';
  if (!isPanelUser) return <>{children}</>;
  if (flags.loading) return null;
  return flags[feature] ? <>{children}</> : <Navigate to="/admin" replace />;
}
