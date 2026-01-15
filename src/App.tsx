import { useAuth } from './contexts/AuthContext';
import { LandingPage } from './components/LandingPage';
import { AdminDashboard } from './components/AdminDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { PendingApproval } from './components/PendingApproval';

function App() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0B1120] via-[#151B2E] to-[#0B1120] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LandingPage />;
  }

  if (profile.role === 'staff' && !profile.is_validated) {
    return <PendingApproval />;
  }
  if (profile.role === 'admin' || profile.role === 'super_admin') {
    return <AdminDashboard />;
  }

  return <StaffDashboard />;
}

export default App;
