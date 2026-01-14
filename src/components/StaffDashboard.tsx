import { useState, useEffect } from 'react';
import { Calendar, MapPin, Shirt, Users, LogOut, Crown, CheckCircle, CalendarDays, Clock, DollarSign, AlertCircle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UniformChecklist } from './UniformChecklist';

interface Event {
  id: string;
  title: string;
  event_date: string;
  venue: string;
  dress_code: string;
  open_shifts: number;
  role_required: string;
  start_time: string;
  end_time: string;
  hourly_rate: number | null;
  uniform_requirements: string | null;
  description: string | null;
}

interface EventWithRequest extends Event {
  hasRequested: boolean;
  requestStatus?: 'confirmed' | 'pending' | 'rejected';
  confirmedCount?: number;
  remainingPositions?: number;
}

export function StaffDashboard() {
  const { signOut, profile } = useAuth();
  const [view, setView] = useState<'available' | 'schedule'>('available');
  const [events, setEvents] = useState<EventWithRequest[]>([]);
  const [mySchedule, setMySchedule] = useState<EventWithRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
    loadMySchedule();
  }, [profile]);

  const loadEvents = async () => {
    if (!profile?.staff_role) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('role_required', profile.staff_role)
        .gte('event_date', today)
        .order('event_date', { ascending: true });

      if (eventsError) throw eventsError;

      const { data: requestsData, error: requestsError } = await supabase
        .from('shift_requests')
        .select('event_id, status')
        .eq('staff_id', profile.id);

      if (requestsError) throw requestsError;

      const requestsMap = new Map(
        requestsData?.map((r) => [r.event_id, r.status]) || []
      );

      const eventsWithCapacity = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { count } = await supabase
            .from('shift_requests')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('status', 'confirmed');

          const confirmedCount = count || 0;
          const remainingPositions = event.open_shifts - confirmedCount;

          return {
            ...event,
            hasRequested: requestsMap.has(event.id),
            requestStatus: requestsMap.get(event.id) as 'confirmed' | 'pending' | 'rejected' | undefined,
            confirmedCount,
            remainingPositions,
          };
        })
      );

      const availableEvents = eventsWithCapacity.filter(
        (event) => event.remainingPositions! > 0 || event.hasRequested
      );

      setEvents(availableEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const loadMySchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_requests')
        .select(`
          event_id,
          status,
          events (*)
        `)
        .eq('staff_id', profile?.id)
        .eq('status', 'confirmed');

      if (error) throw error;

      const confirmedEvents: EventWithRequest[] = (data || [])
        .filter((sr) => sr.events)
        .map((sr) => ({
          ...(sr.events as unknown as Event),
          hasRequested: true,
          requestStatus: 'confirmed' as const,
        }))
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

      setMySchedule(confirmedEvents);
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const checkForConflict = async (eventDate: string, startTime: string, endTime: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('check_schedule_conflict', {
        p_staff_id: profile?.id,
        p_event_date: eventDate,
        p_start_time: startTime,
        p_end_time: endTime,
      });

      if (error) throw error;
      return data as boolean;
    } catch (error) {
      console.error('Error checking conflict:', error);
      return false;
    }
  };

  const handleRequestShift = async (event: EventWithRequest) => {
    setError(null);

    const hasConflict = await checkForConflict(event.event_date, event.start_time, event.end_time);

    if (hasConflict) {
      setError(`You already have a confirmed shift on ${new Date(event.event_date).toLocaleDateString()} during this time. Please choose a different engagement.`);
      return;
    }

    try {
      const { error } = await supabase.from('shift_requests').insert({
        event_id: event.id,
        staff_id: profile?.id,
        status: 'pending',
      });

      if (error) throw error;

      loadEvents();
      loadMySchedule();
    } catch (error) {
      console.error('Error requesting shift:', error);
      setError('Failed to request shift. Please try again.');
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

  const renderEventCard = (event: EventWithRequest, showActions = true) => (
    <div
      key={event.id}
      className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/20 rounded-xl p-6 hover:border-[#D4AF37]/40 transition-all duration-300 transform hover:-translate-y-1"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-serif text-white">{event.title}</h3>
        <span className="text-2xl">{getDressCodeIcon(event.dress_code)}</span>
      </div>

      <div className="space-y-3 mb-6">
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
          <User className="w-5 h-5 text-[#D4AF37]" />
          <span className="text-sm">{event.role_required} position</span>
        </div>
        {event.remainingPositions !== undefined && event.remainingPositions > 0 && (
          <div className="flex items-center space-x-3 text-gray-300">
            <Users className="w-5 h-5 text-[#D4AF37]" />
            <span className="text-sm">{event.remainingPositions} position{event.remainingPositions !== 1 ? 's' : ''} remaining</span>
          </div>
        )}
        {event.hourly_rate && (
          <div className="flex items-center space-x-3 text-[#D4AF37]">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">${event.hourly_rate}/hour</span>
          </div>
        )}
      </div>

      {event.description && (
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          {event.description}
        </p>
      )}

      {showActions && !event.hasRequested && (
        <button
          onClick={() => handleRequestShift(event)}
          className="w-full btn-luxury-filled py-3 px-6 rounded-lg transform hover:scale-105"
        >
          Request Engagement
        </button>
      )}

      {event.hasRequested && event.requestStatus === 'pending' && (
        <div className="flex items-center justify-center space-x-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 py-3 rounded-lg">
          <Clock className="w-5 h-5" />
          <span className="font-medium tracking-wide">PENDING APPROVAL</span>
        </div>
      )}

      {event.hasRequested && event.requestStatus === 'confirmed' && (
        <div className="flex items-center justify-center space-x-2 bg-green-500/20 border border-green-500/30 text-green-400 py-3 rounded-lg">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium tracking-wide">CONFIRMED</span>
        </div>
      )}
    </div>
  );

  if (!profile?.staff_role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0B1120] via-[#151B2E] to-[#0B1120] flex items-center justify-center">
        <div className="text-center p-8 bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/30 rounded-xl max-w-md">
          <AlertCircle className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
          <h3 className="text-xl font-serif text-white mb-2">Profile Setup Required</h3>
          <p className="text-gray-400">Please contact support to set up your staff role.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1120] via-[#151B2E] to-[#0B1120]">
      <nav className="bg-[#1A1F2E]/50 backdrop-blur-sm border-b border-[#D4AF37]/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="w-8 h-8 text-[#D4AF37]" />
              <span className="text-2xl font-serif text-white">Élite Events</span>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-white font-medium">{profile.full_name || profile.email}</p>
                <p className="text-sm text-[#D4AF37]">{profile.staff_role}</p>
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
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        <div className="flex space-x-4 mb-8 border-b border-[#D4AF37]/20">
          <button
            onClick={() => setView('available')}
            className={`pb-4 px-6 font-medium transition-all tracking-wide ${
              view === 'available'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Available Engagements
          </button>
          <button
            onClick={() => setView('schedule')}
            className={`pb-4 px-6 font-medium transition-all tracking-wide ${
              view === 'schedule'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Schedule
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {view === 'available' && (
          <div>
            <div className="mb-8">
              <h1 className="text-4xl font-serif text-white mb-2">Available Engagements</h1>
              <p className="text-gray-400">Select prestigious events that match your {profile.staff_role} expertise</p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : events.length === 0 ? (
              <div className="bg-gradient-to-br from-[#1A1F2E]/50 to-[#0B1120]/50 border border-[#D4AF37]/20 rounded-xl p-12 text-center">
                <Calendar className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
                <h3 className="text-xl font-serif text-white mb-2">No Events Available</h3>
                <p className="text-gray-400">Check back soon for new {profile.staff_role} engagements</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => renderEventCard(event))}
              </div>
            )}
          </div>
        )}

        {view === 'schedule' && (
          <div>
            <div className="mb-8">
              <h1 className="text-4xl font-serif text-white mb-2">My Schedule</h1>
              <p className="text-gray-400">Your confirmed upcoming luxury events</p>
            </div>

            {mySchedule.length === 0 ? (
              <div className="bg-gradient-to-br from-[#1A1F2E]/50 to-[#0B1120]/50 border border-[#D4AF37]/20 rounded-xl p-12 text-center">
                <CalendarDays className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
                <h3 className="text-xl font-serif text-white mb-2">No Confirmed Events</h3>
                <p className="text-gray-400">Request engagements from available opportunities to build your schedule</p>
              </div>
            ) : (
              <div className="space-y-8">
                {mySchedule.map((event) => (
                  <div key={event.id} className="space-y-4">
                    {renderEventCard(event, false)}
                    {event.uniform_requirements || event.dress_code && (
                      <UniformChecklist
                        requirements={event.uniform_requirements}
                        eventTitle={event.title}
                        dressCode={event.dress_code}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
