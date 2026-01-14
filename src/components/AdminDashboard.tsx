import { useState } from 'react';
import { LogOut, Crown, Calendar, FileText, Users as UsersIcon, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { EventsManagement } from './EventsManagement';
import { SigningSheet } from './SigningSheet';
import { Reports } from './Reports';
import { UserManagement } from './UserManagement';

type Tab = 'events' | 'signing' | 'reports' | 'users';

export function AdminDashboard() {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('events');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1120] via-[#151B2E] to-[#0B1120]">
      <nav className="bg-[#1A1F2E]/50 backdrop-blur-sm border-b border-[#D4AF37]/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="w-8 h-8 text-[#D4AF37]" />
              <span className="text-2xl font-serif text-white">Élite Events Admin</span>
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

      <div className="container mx-auto px-6 py-8">
        <div className="flex space-x-4 mb-8 border-b border-[#D4AF37]/20 overflow-x-auto">
          <button
            onClick={() => setActiveTab('events')}
            className={`pb-4 px-6 font-medium transition-all tracking-wide whitespace-nowrap flex items-center space-x-2 ${
              activeTab === 'events'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span>Grand Events</span>
          </button>
          <button
            onClick={() => setActiveTab('signing')}
            className={`pb-4 px-6 font-medium transition-all tracking-wide whitespace-nowrap flex items-center space-x-2 ${
              activeTab === 'signing'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ClipboardCheck className="w-5 h-5" />
            <span>Signing Sheet</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-4 px-6 font-medium transition-all tracking-wide whitespace-nowrap flex items-center space-x-2 ${
              activeTab === 'reports'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Reports</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-6 font-medium transition-all tracking-wide whitespace-nowrap flex items-center space-x-2 ${
              activeTab === 'users'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <UsersIcon className="w-5 h-5" />
            <span>Users</span>
          </button>
        </div>

        <div className="animate-fadeIn">
          {activeTab === 'events' && <EventsManagement />}
          {activeTab === 'signing' && <SigningSheet />}
          {activeTab === 'reports' && <Reports />}
          {activeTab === 'users' && <UserManagement />}
        </div>
      </div>
    </div>
  );
}
