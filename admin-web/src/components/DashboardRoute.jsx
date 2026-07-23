import { Navigate } from 'react-router-dom';
import { ROUTES } from '../routePaths';
import ProtectedRoute from './ProtectedRoute';

const SELLER_ROLES = new Set(['SellersAdmin', 'SellersStaff']);

export function isSellerRole(role) {
  return SELLER_ROLES.has(role);
}

export function canAccessWebDashboard(user) {
  if (!user?.role) return false;
  return user.role === 'SuperAdmin' || isSellerRole(user.role);
}

export default function DashboardRoute({ token, user, children }) {
  if (!token) {
    return <ProtectedRoute token={token}>{children}</ProtectedRoute>;
  }
  if (canAccessWebDashboard(user)) {
    return <ProtectedRoute token={token}>{children}</ProtectedRoute>;
  }
  return <Navigate to={ROUTES.home} replace />;
}
