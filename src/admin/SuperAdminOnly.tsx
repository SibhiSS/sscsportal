import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const useIsSuperAdmin = () => useAuth().user?.role === 'super_admin';

/** Wraps a page that only super admins may open. */
export default function SuperAdminOnly({ children }: { children: ReactNode }) {
  if (useIsSuperAdmin()) return <>{children}</>;
  return (
    <div className="panel">
      <h3 className="ph">Super admins only</h3>
      <p className="muted">This section is only available to super admins. <Link className="linkbtn" to="/admin">Back to the overview</Link></p>
    </div>
  );
}
