import { Outlet } from 'react-router';
import { AuthProvider } from '../lib/AuthContext';
import { TierProvider } from '../lib/TierContext';

export function RootWrapper() {
  return (
    <AuthProvider>
      <TierProvider>
        <Outlet />
      </TierProvider>
    </AuthProvider>
  );
}