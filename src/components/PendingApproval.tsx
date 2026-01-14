import { Crown, Clock, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function PendingApproval() {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1120] via-[#151B2E] to-[#0B1120]">
      <nav className="bg-[#1A1F2E]/50 backdrop-blur-sm border-b border-[#D4AF37]/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="w-8 h-8 text-[#D4AF37]" />
              <span className="text-2xl font-serif text-white">Élite Events</span>
            </div>
            <button
              onClick={signOut}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="tracking-wide">Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-20 flex items-center justify-center min-h-[calc(100vh-100px)]">
        <div className="max-w-2xl w-full">
          <div className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/30 rounded-xl p-12 text-center">
            <div className="w-24 h-24 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Clock className="w-12 h-12 text-[#D4AF37]" />
            </div>

            <h1 className="text-4xl font-serif text-white mb-4">
              Account Pending Approval
            </h1>

            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Welcome to Élite Events, {profile?.full_name || profile?.email}
            </p>

            <div className="bg-black/30 border border-[#D4AF37]/20 rounded-lg p-6 mb-8">
              <p className="text-gray-300 leading-relaxed">
                Thank you for registering as a <span className="text-[#D4AF37] font-medium">{profile?.staff_role}</span>.
                Your account is currently under review by our administrative team.
              </p>
            </div>

            <div className="space-y-4 text-left bg-black/20 rounded-lg p-6">
              <h3 className="text-lg font-serif text-white mb-3">What happens next?</h3>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start space-x-3">
                  <span className="text-[#D4AF37] mt-1">•</span>
                  <span>Our team will review your credentials and experience</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-[#D4AF37] mt-1">•</span>
                  <span>You will receive a welcome email once your account is approved</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-[#D4AF37] mt-1">•</span>
                  <span>After approval, you'll have access to exclusive event engagements</span>
                </li>
              </ul>
            </div>

            <p className="text-sm text-gray-500 mt-8">
              This process typically takes 24-48 hours. Thank you for your patience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
