import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'trainer' | 'viewer' | 'user';
  redirectTo?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requiredRole,
  redirectTo = '/login' 
}) => {
  const location = useLocation();
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        await checkAuth();
      } finally {
        setIsChecking(false);
      }
    };
    
    verifyAuth();
  }, [checkAuth]);

  // Show loading while checking authentication
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check role if required
  if (requiredRole) {
    const roleHierarchy: Record<string, number> = {
      'user': 1,
      'viewer': 2,
      'trainer': 3,
      'admin': 4
    };

    const userRoleLevel = roleHierarchy[user?.role || 'user'] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-600">You need {requiredRole} role to access this page.</p>
            <button 
              onClick={() => window.history.back()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  // Authenticated and authorized
  return <>{children}</>;
};

// HOC for route protection
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: 'admin' | 'trainer' | 'viewer' | 'user'
): React.FC<P> => {
  return (props: P) => (
    <AuthGuard requiredRole={requiredRole}>
      <Component {...props} />
    </AuthGuard>
  );
};