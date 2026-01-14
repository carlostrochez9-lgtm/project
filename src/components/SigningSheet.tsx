import { useState, useEffect, useRef } from 'react';
import { Calendar, Users, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { StaffRole } from '../lib/database.types';

interface Event {
  id: string;
  title: string;
  event_date: string;
  venue: string;
  start_time: string;
  end_time: string;
}

interface StaffMember {
  id: string;
  staff_id: string;
  event_id: string;
  uniform_verified: boolean;
  check_in_signature: string | null;
  check_in_time: string | null;
  check_out_signature: string | null;
  check_out_time: string | null;
  profiles: {
    full_name: string | null;
    email: string;
    staff_role: StaffRole;
  };
}

export function SigningSheet() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingFor, setSigningFor] = useState<{ id: string; type: 'in' | 'out' } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadStaff(selectedEvent);
    }
  }, [selectedEvent]);

  const loadEvents = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('events')
        .select('id, title, event_date, venue, start_time, end_time')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(20);

      if (error) throw error;
      setEvents(data || []);
      if (data && data.length > 0) {
        setSelectedEvent(data[0].id);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('shift_requests')
        .select(`
          id,
          staff_id,
          event_id,
          uniform_verified,
          check_in_signature,
          check_in_time,
          check_out_signature,
          check_out_time,
          profiles!shift_requests_staff_id_fkey (full_name, email, staff_role)
        `)
        .eq('event_id', eventId)
        .eq('status', 'confirmed')
        .order('profiles(staff_role)', { ascending: true });

      if (error) throw error;

      const staffData = (data || []) as unknown as StaffMember[];
      staffData.sort((a, b) => {
        if (a.profiles.staff_role !== b.profiles.staff_role) {
          return a.profiles.staff_role.localeCompare(b.profiles.staff_role);
        }
        const nameA = a.profiles.full_name || a.profiles.email;
        const nameB = b.profiles.full_name || b.profiles.email;
        return nameA.localeCompare(nameB);
      });

      setStaff(staffData);
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  const handleVerifyUniform = async (requestId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('shift_requests')
        .update({
          uniform_verified: !currentStatus,
          uniform_verified_by: !currentStatus ? profile?.id : null,
          uniform_verified_at: !currentStatus ? new Date().toISOString() : null,
        })
        .eq('id', requestId);

      if (error) throw error;

      if (selectedEvent) {
        loadStaff(selectedEvent);
      }
    } catch (error) {
      console.error('Error verifying uniform:', error);
    }
  };

  const startSigning = (requestId: string, type: 'in' | 'out') => {
    setSigningFor({ id: requestId, type });
    setTimeout(() => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0B1120';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }, 100);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0B1120';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const saveSignature = async () => {
    if (!signingFor || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL();
    const now = new Date().toISOString();

    try {
      const updateData = signingFor.type === 'in'
        ? { check_in_signature: signatureData, check_in_time: now }
        : { check_out_signature: signatureData, check_out_time: now };

      const { error } = await supabase
        .from('shift_requests')
        .update(updateData)
        .eq('id', signingFor.id);

      if (error) throw error;

      setSigningFor(null);
      if (selectedEvent) {
        loadStaff(selectedEvent);
      }
    } catch (error) {
      console.error('Error saving signature:', error);
    }
  };

  const groupedStaff = staff.reduce((acc, member) => {
    const role = member.profiles.staff_role;
    if (!acc[role]) {
      acc[role] = [];
    }
    acc[role].push(member);
    return acc;
  }, {} as Record<StaffRole, StaffMember[]>);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-serif text-white mb-2">Master Signing Sheet</h2>
        <p className="text-gray-400">Track staff check-in/out and uniform verification</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
              SELECT EVENT
            </label>
            <select
              value={selectedEvent || ''}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full md:w-96 px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} - {new Date(event.event_date).toLocaleDateString()} - {event.venue}
                </option>
              ))}
            </select>
          </div>

          {staff.length === 0 ? (
            <div className="bg-gradient-to-br from-[#1A1F2E]/50 to-[#0B1120]/50 border border-[#D4AF37]/20 rounded-xl p-12 text-center">
              <Users className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
              <h3 className="text-xl font-serif text-white mb-2">No Confirmed Staff</h3>
              <p className="text-gray-400">No staff members confirmed for this event yet</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedStaff).map(([role, members]) => (
                <div key={role}>
                  <h3 className="text-xl font-serif text-[#D4AF37] mb-4">{role}s ({members.length})</h3>
                  <div className="space-y-4">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/20 rounded-xl p-6"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-medium text-white">
                              {member.profiles.full_name || member.profiles.email}
                            </h4>
                            <p className="text-sm text-gray-400">{member.profiles.email}</p>
                          </div>
                          <button
                            onClick={() => handleVerifyUniform(member.id, member.uniform_verified)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm tracking-wide transition-all ${
                              member.uniform_verified
                                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                                : 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30'
                            }`}
                          >
                            {member.uniform_verified ? '✓ UNIFORM VERIFIED' : 'VERIFY UNIFORM'}
                          </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-black/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400 tracking-wide">CHECK-IN</span>
                              {member.check_in_time && (
                                <span className="text-xs text-[#D4AF37]">
                                  {new Date(member.check_in_time).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            {member.check_in_signature ? (
                              <div className="flex items-center space-x-2 text-green-400">
                                <CheckCircle className="w-5 h-5" />
                                <span className="text-sm">Signed</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => startSigning(member.id, 'in')}
                                className="btn-luxury-filled py-2 px-4 rounded-lg text-xs w-full"
                              >
                                SIGN IN
                              </button>
                            )}
                          </div>

                          <div className="bg-black/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400 tracking-wide">CHECK-OUT</span>
                              {member.check_out_time && (
                                <span className="text-xs text-[#D4AF37]">
                                  {new Date(member.check_out_time).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            {member.check_out_signature ? (
                              <div className="flex items-center space-x-2 text-green-400">
                                <CheckCircle className="w-5 h-5" />
                                <span className="text-sm">Signed</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => startSigning(member.id, 'out')}
                                className="btn-luxury-filled py-2 px-4 rounded-lg text-xs w-full"
                                disabled={!member.check_in_signature}
                              >
                                SIGN OUT
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {signingFor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/30 rounded-xl p-8 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-serif text-white">
                Digital Signature - {signingFor.type === 'in' ? 'Check-In' : 'Check-Out'}
              </h3>
              <button
                onClick={() => setSigningFor(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <canvas
                ref={canvasRef}
                width={600}
                height={300}
                className="w-full border-2 border-[#D4AF37]/30 rounded-lg cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>

            <div className="flex space-x-4">
              <button
                onClick={clearSignature}
                className="btn-luxury px-6 py-3 rounded-lg flex-1"
              >
                Clear
              </button>
              <button
                onClick={saveSignature}
                className="btn-luxury-filled px-6 py-3 rounded-lg flex-1"
              >
                Save Signature
              </button>
            </div>

            <p className="text-sm text-gray-400 text-center mt-4">
              Sign above with your mouse or touchscreen
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
