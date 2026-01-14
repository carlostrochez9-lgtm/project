import { useState } from 'react';
import { Crown, Award, Users, Clock } from 'lucide-react';
import { AuthModal } from './AuthModal';

export function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1120] via-[#151B2E] to-[#0B1120]">
      <nav className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Crown className="w-8 h-8 text-[#D4AF37]" />
            <span className="text-2xl font-serif text-white">Élite Events</span>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="btn-luxury px-8 py-3 rounded-lg shadow-lg transform hover:scale-105"
          >
            Staff Login
          </button>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-20">
        <div className="text-center mb-20">
          <h1 className="text-6xl font-serif text-white mb-6 leading-tight">
            Elevate Your Career in
            <br />
            <span className="text-[#D4AF37]">Luxury Event Staffing</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Join the most distinguished team of event professionals serving exclusive venues
            and elite clientele across the country.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-[#1A1F2E]/80 to-[#0B1120]/80 backdrop-blur-sm border border-[#D4AF37]/20 rounded-xl p-8 hover:border-[#D4AF37]/40 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-14 h-14 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mb-6">
              <Award className="w-7 h-7 text-[#D4AF37]" />
            </div>
            <h3 className="text-xl font-serif text-white mb-4">Premium Grand Events</h3>
            <p className="text-gray-400 leading-relaxed">
              Work at the most prestigious venues hosting exclusive galas, weddings, and corporate events.
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#1A1F2E]/80 to-[#0B1120]/80 backdrop-blur-sm border border-[#D4AF37]/20 rounded-xl p-8 hover:border-[#D4AF37]/40 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-14 h-14 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mb-6">
              <Clock className="w-7 h-7 text-[#D4AF37]" />
            </div>
            <h3 className="text-xl font-serif text-white mb-4">Flexible Schedule</h3>
            <p className="text-gray-400 leading-relaxed">
              Choose engagements that fit your availability and build your own luxury career path.
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#1A1F2E]/80 to-[#0B1120]/80 backdrop-blur-sm border border-[#D4AF37]/20 rounded-xl p-8 hover:border-[#D4AF37]/40 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-14 h-14 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mb-6">
              <Users className="w-7 h-7 text-[#D4AF37]" />
            </div>
            <h3 className="text-xl font-serif text-white mb-4">Elite Network</h3>
            <p className="text-gray-400 leading-relaxed">
              Join a curated community of professional staff dedicated to excellence and service.
            </p>
          </div>
        </div>

        <div className="text-center mt-20">
          <button
            onClick={() => setShowAuthModal(true)}
            className="btn-luxury-filled px-12 py-4 rounded-lg text-lg shadow-2xl transform hover:scale-105"
          >
            Begin Your Journey
          </button>
        </div>
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
