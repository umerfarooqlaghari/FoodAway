import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../routePaths';

export default function ProtectedRoute({ token, children }) {
  const location = useLocation();
  if (!token) {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }
  return children;
}
