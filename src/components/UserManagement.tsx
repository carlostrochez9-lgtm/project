import { useState, useEffect } from 'react';
import { Users, CheckCircle, Mail, User, Star, UserPlus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { StaffRole } from '../lib/database.types';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'staff';
  staff_role: StaffRole | null;
  position_level: 'full_time' | 'on_call_1' | 'on_call_2';
  rating: number;
  status: 'active' | 'inactive';
  is_validated: boolean;
  created_at: string;
}

export function UserManagement() {
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    email: '',
    password: '',
    full_name: '',
    staff_role: 'server' as StaffRole,
    position_level: 'on_call_2' as 'full_time' | 'on_call_1' | 'on_call_2'
  });
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [addEmployeeError, setAddEmployeeError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const pending = (data || []).filter(u => !u.is_validated && u.role === 'staff');
      setPendingUsers(pending);
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userId: string, userEmail: string, userName: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_validated: true })
        .eq('id', userId);

      if (error) throw error;

      console.log(`
========== WELCOME EMAIL NOTIFICATION ==========
TO: ${userEmail}
SUBJECT: Welcome to Élite Events - Account Approved!

Dear ${userName || 'Team Member'},

Congratulations! Your account has been approved and you are now part of the Élite Events team.

You can now:
• Browse and request exclusive event engagements
• Build your schedule with premium opportunities
• Access your digital uniform checklists
• Track your confirmed shifts

Please log in to your dashboard to get started: https://eliteevents.com/login

We look forward to your exceptional service at our upcoming events.

Best regards,
Élite Events Management Team
================================================
      `);

      loadUsers();
    } catch (error) {
      console.error('Error approving user:', error);
    }
  };

  const handlePositionLevelChange = async (userId: string, newLevel: 'full_time' | 'on_call_1' | 'on_call_2') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ position_level: newLevel })
        .eq('id', userId);

      if (error) throw error;

      loadUsers();
    } catch (error) {
      console.error('Error updating position level:', error);
    }
  };

  const getPositionLevelLabel = (level: string) => {
    switch (level) {
      case 'full_time':
        return 'Full Time';
      case 'on_call_1':
        return 'On Call 1';
      case 'on_call_2':
        return 'On Call 2';
      default:
        return level;
    }
  };

  const getPositionLevelColor = (level: string) => {
    switch (level) {
      case 'full_time':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'on_call_1':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'on_call_2':
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const handleAddEmployee = async () => {
    setAddingEmployee(true);
    setAddEmployeeError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmployee.email,
        password: newEmployee.password,
        options: {
          data: {
            full_name: newEmployee.full_name
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: newEmployee.full_name,
          staff_role: newEmployee.staff_role,
          position_level: newEmployee.position_level,
          is_validated: true,
          role: 'staff'
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      setShowAddEmployeeModal(false);
      setNewEmployee({
        email: '',
        password: '',
        full_name: '',
        staff_role: 'server',
        position_level: 'on_call_2'
      });
      loadUsers();
    } catch (error: any) {
      setAddEmployeeError(error.message || 'Failed to add employee');
    } finally {
      setAddingEmployee(false);
    }
  };

  const displayUsers = view === 'pending' ? pendingUsers : allUsers;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-serif text-white mb-2">User Management</h2>
          <p className="text-gray-400">Approve and manage staff members</p>
        </div>
        <button
          onClick={() => setShowAddEmployeeModal(true)}
          className="btn-luxury-filled px-6 py-3 rounded-lg flex items-center space-x-2"
        >
          <UserPlus className="w-5 h-5" />
          <span>Add Employee</span>
        </button>
      </div>

      <div className="flex space-x-4 mb-6 border-b border-[#D4AF37]/20">
        <button
          onClick={() => setView('pending')}
          className={`pb-4 px-6 font-medium transition-all tracking-wide ${
            view === 'pending'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Pending Approval ({pendingUsers.length})
        </button>
        <button
          onClick={() => setView('all')}
          className={`pb-4 px-6 font-medium transition-all tracking-wide ${
            view === 'all'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          All Users ({allUsers.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : displayUsers.length === 0 ? (
        <div className="bg-gradient-to-br from-[#1A1F2E]/50 to-[#0B1120]/50 border border-[#D4AF37]/20 rounded-xl p-12 text-center">
          <Users className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
          <h3 className="text-xl font-serif text-white mb-2">
            {view === 'pending' ? 'No Pending Users' : 'No Users Found'}
          </h3>
          <p className="text-gray-400">
            {view === 'pending' ? 'All users have been approved' : 'No users in the system yet'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {displayUsers.map((user) => (
            <div
              key={user.id}
              className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/20 rounded-xl p-6 hover:border-[#D4AF37]/40 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 bg-[#D4AF37]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">
                      {user.full_name || 'No Name'}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <p className="text-sm text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </div>
                {user.is_validated ? (
                  <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 text-green-400 text-xs rounded-full tracking-wide">
                    VALIDATED
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs rounded-full tracking-wide">
                    PENDING
                  </span>
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Position:</span>
                  <span className="text-white font-medium">{user.staff_role || user.role}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Position Level:</span>
                  {view === 'all' && user.role === 'staff' ? (
                    <select
                      value={user.position_level}
                      onChange={(e) => handlePositionLevelChange(user.id, e.target.value as any)}
                      className="bg-[#0B1120] border border-[#D4AF37]/30 rounded px-3 py-1 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    >
                      <option value="full_time">Full Time</option>
                      <option value="on_call_1">On Call 1</option>
                      <option value="on_call_2">On Call 2</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded text-xs border ${getPositionLevelColor(user.position_level)}`}>
                      {getPositionLevelLabel(user.position_level)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-white font-medium capitalize">{user.status}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Rating:</span>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-[#D4AF37] fill-current" />
                    <span className="text-white font-medium">{user.rating.toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Joined:</span>
                  <span className="text-white">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {!user.is_validated && user.role === 'staff' && (
                <button
                  onClick={() => handleApproveUser(user.id, user.email, user.full_name)}
                  className="w-full btn-luxury-filled py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve User</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddEmployeeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/30 rounded-xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-serif text-white">Add Employee</h3>
              <button
                onClick={() => {
                  setShowAddEmployeeModal(false);
                  setAddEmployeeError('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {addEmployeeError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {addEmployeeError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newEmployee.full_name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0B1120] border border-[#D4AF37]/30 rounded-lg text-white focus:border-[#D4AF37] focus:outline-none"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0B1120] border border-[#D4AF37]/30 rounded-lg text-white focus:border-[#D4AF37] focus:outline-none"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={newEmployee.password}
                  onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0B1120] border border-[#D4AF37]/30 rounded-lg text-white focus:border-[#D4AF37] focus:outline-none"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Staff Role
                </label>
                <select
                  value={newEmployee.staff_role}
                  onChange={(e) => setNewEmployee({ ...newEmployee, staff_role: e.target.value as StaffRole })}
                  className="w-full px-4 py-2 bg-[#0B1120] border border-[#D4AF37]/30 rounded-lg text-white focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="server">Server</option>
                  <option value="bartender">Bartender</option>
                  <option value="host">Host</option>
                  <option value="captain">Captain</option>
                  <option value="coordinator">Coordinator</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Position Level
                </label>
                <select
                  value={newEmployee.position_level}
                  onChange={(e) => setNewEmployee({ ...newEmployee, position_level: e.target.value as any })}
                  className="w-full px-4 py-2 bg-[#0B1120] border border-[#D4AF37]/30 rounded-lg text-white focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="full_time">Full Time</option>
                  <option value="on_call_1">On Call 1</option>
                  <option value="on_call_2">On Call 2</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddEmployeeModal(false);
                    setAddEmployeeError('');
                  }}
                  className="flex-1 px-4 py-2 border border-[#D4AF37]/30 text-white rounded-lg hover:bg-[#D4AF37]/10 transition-colors"
                  disabled={addingEmployee}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEmployee}
                  disabled={addingEmployee || !newEmployee.email || !newEmployee.password || !newEmployee.full_name}
                  className="flex-1 btn-luxury-filled px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingEmployee ? 'Adding...' : 'Add Employee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
