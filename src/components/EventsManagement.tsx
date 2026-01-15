import { useState, useEffect } from 'react';
import { Plus, Calendar, MapPin, Shirt, Users, Clock, DollarSign, CheckCircle, XCircle, User, Eye, Send, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { StaffRole } from '../lib/database.types';

interface Event {
  id: string;
  title: string;
  event_date: string;
  venue: string;
  dress_code: string;
  open_shifts: number;
  role_required: StaffRole;
  start_time: string;
  end_time: string;
  hourly_rate: number | null;
  uniform_requirements: string | null;
  description: string | null;
  status: 'draft' | 'published';
  beo_source: string | null;
  target_position_levels: string[] | null;
  created_at: string;
}

interface PendingRequest {
  id: string;
  event_id: string;
  staff_id: string;
  status: string;
  requested_at: string;
  events: Event;
  profiles: {
    full_name: string | null;
    email: string;
    staff_role: StaffRole | null;
  };
}

export function EventsManagement() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [draftEvents, setDraftEvents] = useState<Event[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  // SmartUpload removed per request
  const [showMassPublishModal, setShowMassPublishModal] = useState(false);
  const [massPublishLevels, setMassPublishLevels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    event_date: '',
    venue: '',
    dress_code: 'Black Tie',
    role_required: 'Server' as StaffRole,
    start_time: '18:00',
    end_time: '23:00',
    open_shifts: 1,
    hourly_rate: '',
    uniform_requirements: '',
    description: '',
    target_position_levels: [] as string[],
  });

  useEffect(() => {
    loadEvents();
    loadPendingRequests();
  }, []);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      if (error) throw error;

      const allEvents = data || [];
      setDraftEvents(allEvents.filter((e: any) => e.status === 'draft'));
      setEvents(allEvents.filter((e: any) => e.status === 'published'));
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_requests')
        .select(`
          *,
          events (*),
          profiles!shift_requests_staff_id_fkey (full_name, email, staff_role)
        `)
        .eq('status', 'pending')
        .order('requested_at', { ascending: true });

      if (error) throw error;
      setPendingRequests(data || []);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('events').insert({
        ...formData,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        target_position_levels: formData.target_position_levels.length > 0 ? formData.target_position_levels : null,
        created_by: profile?.id,
      });

      if (error) throw error;

      setShowForm(false);
      setFormData({
        title: '',
        event_date: '',
        venue: '',
        dress_code: 'Black Tie',
        role_required: 'Server',
        start_time: '18:00',
        end_time: '23:00',
        open_shifts: 1,
        hourly_rate: '',
        uniform_requirements: '',
        description: '',
        target_position_levels: [],
      });
      loadEvents();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const handleApproveRequest = async (requestId: string, request: PendingRequest) => {
    try {
      const { error } = await supabase
        .from('shift_requests')
        .update({
          status: 'confirmed',
          approved_at: new Date().toISOString(),
          approved_by: profile?.id,
        })
        .eq('id', requestId);

      if (error) throw error;

      const staffName = request.profiles.full_name || request.profiles.email;
      const eventName = request.events.title;
      const venue = request.events.venue;
      const eventDate = new Date(request.events.event_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const time = `${request.events.start_time} - ${request.events.end_time}`;

      console.log(`
========== EMAIL NOTIFICATION ==========
TO: ${request.profiles.email}
SUBJECT: Congratulations! Your Shift Request Has Been Approved

Dear ${staffName},

We are delighted to confirm your engagement for the following exclusive event:

Event: ${eventName}
Venue: ${venue}
Date: ${eventDate}
Time: ${time}

Please review your Digital Uniform Checklist in your dashboard for specific requirements.

We look forward to your exceptional service.

Regards,
Élite Events Management
========================================
      `);

      loadPendingRequests();
      loadEvents();
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('shift_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      loadPendingRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handlePublishDraft = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'published' })
        .eq('id', eventId);

      if (error) throw error;
      loadEvents();
    } catch (error) {
      console.error('Error publishing draft:', error);
    }
  };

  const handleDeleteDraft = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this draft event?')) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      loadEvents();
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  const getDressCodeIcon = (dressCode: string) => {
    if (dressCode.toLowerCase().includes('black tie')) {
      return '🎩';
    } else if (dressCode.toLowerCase().includes('white glove')) {
      return '🧤';
    }
    return '👔';
  };

  const togglePositionLevel = (level: string) => {
    setFormData(prev => ({
      ...prev,
      target_position_levels: prev.target_position_levels.includes(level)
        ? prev.target_position_levels.filter(l => l !== level)
        : [...prev.target_position_levels, level]
    }));
  };

  const handleMassPublish = async (targetLevels: string[]) => {
    if (draftEvents.length === 0) {
      alert('No draft events to publish');
      return;
    }

    const confirmMessage = targetLevels.length > 0
      ? `Publish ${draftEvents.length} draft event(s) to ${targetLevels.map(l => l.replace('_', ' ').toUpperCase()).join(', ')}?`
      : `Publish ${draftEvents.length} draft event(s) to all staff?`;

    if (!confirm(confirmMessage)) return;

    try {
      const updates = draftEvents.map(event =>
        supabase
          .from('events')
          .update({
            status: 'published',
            target_position_levels: targetLevels.length > 0 ? targetLevels : null
          })
          .eq('id', event.id)
      );

      await Promise.all(updates);
      loadEvents();
    } catch (error) {
      console.error('Error mass publishing:', error);
    }
  };

  return (
    <div>
      {pendingRequests.length > 0 && (
        <div className="mb-12">
          <h2 className="text-3xl font-serif text-white mb-6">Pending Approvals</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/30 rounded-xl p-6 animate-fadeIn"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-serif text-white mb-1">{request.events.title}</h3>
                    <p className="text-sm text-gray-400">{request.events.venue}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">{new Date(request.events.event_date).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-500">{request.events.start_time} - {request.events.end_time}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 mb-4 p-3 bg-black/20 rounded-lg">
                  <User className="w-5 h-5 text-[#D4AF37]" />
                  <div>
                    <p className="text-white font-medium">{request.profiles.full_name || 'Staff Member'}</p>
                    <p className="text-sm text-gray-400">{request.profiles.staff_role} • {request.profiles.email}</p>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => handleApproveRequest(request.id, request)}
                    className="flex-1 btn-luxury-filled py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    className="flex-1 border border-red-500 text-red-400 bg-transparent hover:bg-red-500/20 py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-300"
                    style={{ letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '0.875rem', fontWeight: 500 }}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-serif text-white mb-2">Grand Events</h1>
          <p className="text-gray-400">Manage your exclusive engagements</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-luxury-filled px-6 py-3 rounded-lg flex items-center space-x-2 shadow-lg transform hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            <span>Post Event</span>
          </button>
        </div>
      </div>

      {/* SmartUpload removed */}

      {showForm && (
        <div className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/30 rounded-xl p-8 mb-8 animate-fadeIn">
          <h2 className="text-2xl font-serif text-white mb-6">Create Grand Event</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                  EVENT TITLE
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                  placeholder="Gala Evening at The Ritz"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                  EVENT DATE
                </label>
                <input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                  VENUE
                </label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                  placeholder="The Grand Ballroom"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                  DRESS CODE
                </label>
                <select
                  value={formData.dress_code}
                  onChange={(e) => setFormData({ ...formData, dress_code: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                  required
                >
                  <option value="Black Tie">Black Tie</option>
                  <option value="White Glove Service">White Glove Service</option>
                  <option value="Formal Attire">Formal Attire</option>
                  <option value="Business Formal">Business Formal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                  STAFF POSITION NEEDED
                </label>
                <select
                  value={formData.role_required}
                  onChange={(e) => setFormData({ ...formData, role_required: e.target.value as StaffRole })}
                  className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                  required
                >
                  <option value="Server">Server</option>
                  <option value="Bartender">Bartender</option>
                  <option value="Host">Host</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                  POSITIONS AVAILABLE
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.open_shifts}
                  onChange={(e) => setFormData({ ...formData, open_shifts: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                  START TIME
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                  END TIME
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                  HOURLY RATE (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                  placeholder="45.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                UNIFORM REQUIREMENTS
              </label>
              <textarea
                value={formData.uniform_requirements}
                onChange={(e) => setFormData({ ...formData, uniform_requirements: e.target.value })}
                className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                placeholder="Pressed black tuxedo, white gloves, polished shoes..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                EVENT DESCRIPTION
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-black/30 border border-[#D4AF37]/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
                placeholder="Additional details about the event..."
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3 tracking-wide">
                TARGET POSITION LEVELS (Optional)
              </label>
              <p className="text-xs text-gray-400 mb-3">Leave unselected to publish to all staff</p>
              <div className="flex flex-wrap gap-3">
                {['full_time', 'on_call_1', 'on_call_2'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => togglePositionLevel(level)}
                    className={`px-4 py-2 rounded-lg border transition-all ${
                      formData.target_position_levels.includes(level)
                        ? 'bg-[#D4AF37] border-[#D4AF37] text-black font-medium'
                        : 'bg-black/30 border-[#D4AF37]/30 text-gray-300 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    {level === 'full_time' ? 'Full Time' : level === 'on_call_1' ? 'On Call 1' : 'On Call 2'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                className="btn-luxury-filled px-8 py-3 rounded-lg"
              >
                Create Event
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-luxury px-8 py-3 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {draftEvents.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Eye className="w-6 h-6 text-[#D4AF37]" />
              <h2 className="text-3xl font-serif text-white">Draft Events</h2>
              <span className="text-sm text-gray-400">Review before publishing to staff</span>
            </div>
            <button
              onClick={() => setShowMassPublishModal(true)}
              className="btn-luxury-filled px-6 py-2 rounded-lg flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Mass Publish ({draftEvents.length})</span>
            </button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {draftEvents.map((event) => (
              <div
                key={event.id}
                className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border-2 border-[#D4AF37]/40 rounded-xl p-6 animate-fadeIn"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-serif text-white">{event.title}</h3>
                      {event.beo_source && (
                        <Sparkles className="w-4 h-4 text-[#D4AF37]" aria-label="Auto-extracted from BEO" />
                      )}
                    </div>
                    <span className="inline-block px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-xs text-yellow-400 font-medium tracking-wider">
                      DRAFT
                    </span>
                  </div>
                  <span className="text-2xl">{getDressCodeIcon(event.dress_code)}</span>
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-3 text-gray-300">
                    <Calendar className="w-5 h-5 text-[#D4AF37]" />
                    <span className="text-sm">{new Date(event.event_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-300">
                    <Clock className="w-5 h-5 text-[#D4AF37]" />
                    <span className="text-sm">{event.start_time} - {event.end_time}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-300">
                    <MapPin className="w-5 h-5 text-[#D4AF37]" />
                    <span className="text-sm">{event.venue}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-300">
                    <Users className="w-5 h-5 text-[#D4AF37]" />
                    <span className="text-sm">{event.open_shifts} {event.role_required} positions</span>
                  </div>
                </div>
                <div className="flex space-x-2 pt-4 border-t border-[#D4AF37]/20">
                  <button
                    onClick={() => handlePublishDraft(event.id)}
                    className="flex-1 btn-luxury-filled py-2 px-4 rounded-lg flex items-center justify-center space-x-2 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>Publish</span>
                  </button>
                  <button
                    onClick={() => handleDeleteDraft(event.id)}
                    className="px-4 py-2 border border-red-500 text-red-400 bg-transparent hover:bg-red-500/20 rounded-lg transition-all duration-300"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : events.length === 0 && draftEvents.length === 0 ? (
        <div className="bg-gradient-to-br from-[#1A1F2E]/50 to-[#0B1120]/50 border border-[#D4AF37]/20 rounded-xl p-12 text-center">
          <Calendar className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
          <h3 className="text-xl font-serif text-white mb-2">No Events Yet</h3>
          <p className="text-gray-400">Create your first grand event to get started</p>
        </div>
      ) : events.length > 0 ? (
        <>
          <h2 className="text-3xl font-serif text-white mb-6">Published Events</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
            <div
              key={event.id}
              className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/20 rounded-xl p-6 hover:border-[#D4AF37]/40 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-serif text-white">{event.title}</h3>
                <span className="text-2xl">{getDressCodeIcon(event.dress_code)}</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-gray-300">
                  <Calendar className="w-5 h-5 text-[#D4AF37]" />
                  <span className="text-sm">{new Date(event.event_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Clock className="w-5 h-5 text-[#D4AF37]" />
                  <span className="text-sm">{event.start_time} - {event.end_time}</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <MapPin className="w-5 h-5 text-[#D4AF37]" />
                  <span className="text-sm">{event.venue}</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Shirt className="w-5 h-5 text-[#D4AF37]" />
                  <span className="text-sm">{event.dress_code}</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Users className="w-5 h-5 text-[#D4AF37]" />
                  <span className="text-sm">{event.open_shifts} {event.role_required} positions</span>
                </div>
                {event.hourly_rate && (
                  <div className="flex items-center space-x-3 text-[#D4AF37]">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-sm font-medium">${event.hourly_rate}/hour</span>
                  </div>
                )}
              </div>
              {event.description && (
                <p className="mt-4 text-gray-400 text-sm leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>
          ))}
        </div>
        </>
      ) : null}

      {showMassPublishModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/30 rounded-xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-serif text-white">Mass Publish Events</h3>
              <button
                onClick={() => {
                  setShowMassPublishModal(false);
                  setMassPublishLevels([]);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-400 mb-6">
              Publishing {draftEvents.length} draft event(s). Select target position levels or publish to all staff.
            </p>

            <div className="space-y-4 mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Target Position Levels (Optional)
              </label>
              <p className="text-xs text-gray-400 mb-3">Leave unselected to publish to all staff</p>
              <div className="flex flex-col gap-3">
                {['full_time', 'on_call_1', 'on_call_2'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setMassPublishLevels(prev =>
                        prev.includes(level)
                          ? prev.filter(l => l !== level)
                          : [...prev, level]
                      );
                    }}
                    className={`px-4 py-3 rounded-lg border transition-all text-left ${
                      massPublishLevels.includes(level)
                        ? 'bg-[#D4AF37] border-[#D4AF37] text-black font-medium'
                        : 'bg-black/30 border-[#D4AF37]/30 text-gray-300 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    {level === 'full_time' ? 'Full Time' : level === 'on_call_1' ? 'On Call 1' : 'On Call 2'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowMassPublishModal(false);
                  setMassPublishLevels([]);
                }}
                className="flex-1 px-4 py-2 border border-[#D4AF37]/30 text-white rounded-lg hover:bg-[#D4AF37]/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleMassPublish(massPublishLevels);
                  setShowMassPublishModal(false);
                  setMassPublishLevels([]);
                }}
                className="flex-1 btn-luxury-filled px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Publish All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
