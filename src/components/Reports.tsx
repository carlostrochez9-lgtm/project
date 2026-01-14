import { useState, useEffect } from 'react';
import { FileText, Download, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LaborReport {
  event_id: string;
  event_name: string;
  event_date: string;
  venue: string;
  hourly_rate: number | null;
  positions_needed: number;
  total_staff: number;
  total_hours_worked: number;
  total_labor_cost: number;
}

interface StaffReliability {
  staff_id: string;
  full_name: string;
  email: string;
  staff_role: string;
  total_shifts: number;
  on_time_count: number;
  late_count: number;
}

export function Reports() {
  const [laborReports, setLaborReports] = useState<LaborReport[]>([]);
  const [staffReliability, setStaffReliability] = useState<StaffReliability[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<'labor' | 'reliability' | 'summary'>('labor');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const [laborData, reliabilityData] = await Promise.all([
        supabase.from('labor_report').select('*'),
        supabase.from('staff_reliability').select('*'),
      ]);

      if (laborData.error) throw laborData.error;
      if (reliabilityData.error) throw reliabilityData.error;

      setLaborReports(laborData.data || []);
      setStaffReliability(reliabilityData.data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateEventSummaryPDF = (event: LaborReport) => {
    const summary = `
EVENT SUMMARY
═══════════════════════════════════════

Event: ${event.event_name}
Date: ${new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Venue: ${event.venue}

STAFFING DETAILS
───────────────────────────────────────
Positions Needed: ${event.positions_needed}
Total Staff Assigned: ${event.total_staff}
Total Hours Worked: ${event.total_hours_worked.toFixed(2)} hours

FINANCIAL SUMMARY
───────────────────────────────────────
Hourly Rate: ${event.hourly_rate ? `$${event.hourly_rate.toFixed(2)}/hour` : 'N/A'}
Total Labor Cost: ${event.total_labor_cost ? `$${event.total_labor_cost.toFixed(2)}` : 'N/A'}

═══════════════════════════════════════
Generated: ${new Date().toLocaleString()}
Élite Events Management
    `;

    const blob = new Blob([summary], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-summary-${event.event_name.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const calculateReliabilityRate = (onTime: number, total: number) => {
    if (total === 0) return 0;
    return ((onTime / total) * 100).toFixed(1);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-serif text-white mb-2">Reports & Analytics</h2>
        <p className="text-gray-400">Export data and generate client summaries</p>
      </div>

      <div className="flex space-x-4 mb-6 border-b border-[#D4AF37]/20">
        <button
          onClick={() => setActiveReport('labor')}
          className={`pb-4 px-6 font-medium transition-all tracking-wide ${
            activeReport === 'labor'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Labor Reports
        </button>
        <button
          onClick={() => setActiveReport('reliability')}
          className={`pb-4 px-6 font-medium transition-all tracking-wide ${
            activeReport === 'reliability'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Staff Reliability
        </button>
        <button
          onClick={() => setActiveReport('summary')}
          className={`pb-4 px-6 font-medium transition-all tracking-wide ${
            activeReport === 'summary'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Event Summaries
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {activeReport === 'labor' && (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => exportToCSV(laborReports, 'labor-report')}
                  className="btn-luxury-filled px-6 py-3 rounded-lg flex items-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Export to CSV</span>
                </button>
              </div>

              <div className="space-y-4">
                {laborReports.length === 0 ? (
                  <div className="bg-gradient-to-br from-[#1A1F2E]/50 to-[#0B1120]/50 border border-[#D4AF37]/20 rounded-xl p-12 text-center">
                    <FileText className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
                    <h3 className="text-xl font-serif text-white mb-2">No Labor Data</h3>
                    <p className="text-gray-400">Labor reports will appear once events have completed shifts</p>
                  </div>
                ) : (
                  laborReports.map((report) => (
                    <div
                      key={report.event_id}
                      className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/20 rounded-xl p-6"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-serif text-white mb-1">{report.event_name}</h3>
                          <p className="text-sm text-gray-400">
                            {new Date(report.event_date).toLocaleDateString()} • {report.venue}
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-black/30 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <DollarSign className="w-5 h-5 text-[#D4AF37]" />
                            <span className="text-sm text-gray-400">Labor Cost</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            ${report.total_labor_cost.toFixed(2)}
                          </p>
                        </div>

                        <div className="bg-black/30 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Clock className="w-5 h-5 text-[#D4AF37]" />
                            <span className="text-sm text-gray-400">Hours Worked</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {report.total_hours_worked.toFixed(1)}
                          </p>
                        </div>

                        <div className="bg-black/30 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
                            <span className="text-sm text-gray-400">Staff Count</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {report.total_staff}
                          </p>
                        </div>

                        <div className="bg-black/30 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <DollarSign className="w-5 h-5 text-[#D4AF37]" />
                            <span className="text-sm text-gray-400">Hourly Rate</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            ${report.hourly_rate?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => generateEventSummaryPDF(report)}
                        className="btn-luxury px-4 py-2 rounded-lg text-sm"
                      >
                        Generate Client Summary
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeReport === 'reliability' && (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => exportToCSV(staffReliability, 'staff-reliability')}
                  className="btn-luxury-filled px-6 py-3 rounded-lg flex items-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Export to CSV</span>
                </button>
              </div>

              <div className="space-y-4">
                {staffReliability.length === 0 ? (
                  <div className="bg-gradient-to-br from-[#1A1F2E]/50 to-[#0B1120]/50 border border-[#D4AF37]/20 rounded-xl p-12 text-center">
                    <FileText className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
                    <h3 className="text-xl font-serif text-white mb-2">No Reliability Data</h3>
                    <p className="text-gray-400">Reliability reports will appear once staff check-ins are recorded</p>
                  </div>
                ) : (
                  staffReliability.map((staff) => (
                    <div
                      key={staff.staff_id}
                      className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/20 rounded-xl p-6"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-white">{staff.full_name}</h3>
                          <p className="text-sm text-gray-400">{staff.staff_role} • {staff.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-[#D4AF37]">
                            {calculateReliabilityRate(staff.on_time_count, staff.total_shifts)}%
                          </p>
                          <p className="text-xs text-gray-400">On-Time Rate</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-black/30 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-white">{staff.total_shifts}</p>
                          <p className="text-xs text-gray-400 mt-1">Total Shifts</p>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-green-400">{staff.on_time_count}</p>
                          <p className="text-xs text-gray-400 mt-1">On Time</p>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-red-400">{staff.late_count}</p>
                          <p className="text-xs text-gray-400 mt-1">Late</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeReport === 'summary' && (
            <div>
              <div className="mb-4 bg-gradient-to-br from-[#1A1F2E]/50 to-[#0B1120]/50 border border-[#D4AF37]/20 rounded-xl p-6">
                <h3 className="text-lg font-serif text-white mb-2">Event Summaries</h3>
                <p className="text-gray-400 text-sm">
                  Generate one-page event summaries for client billing. These include venue details,
                  staff count, total hours, and labor costs.
                </p>
              </div>

              <div className="space-y-4">
                {laborReports.length === 0 ? (
                  <div className="bg-gradient-to-br from-[#1A1F2E]/50 to-[#0B1120]/50 border border-[#D4AF37]/20 rounded-xl p-12 text-center">
                    <FileText className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
                    <h3 className="text-xl font-serif text-white mb-2">No Events</h3>
                    <p className="text-gray-400">Event summaries will be available after events are completed</p>
                  </div>
                ) : (
                  laborReports.map((report) => (
                    <div
                      key={report.event_id}
                      className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/20 rounded-xl p-6 flex items-center justify-between"
                    >
                      <div>
                        <h3 className="text-lg font-medium text-white mb-1">{report.event_name}</h3>
                        <p className="text-sm text-gray-400">
                          {new Date(report.event_date).toLocaleDateString()} • {report.venue}
                        </p>
                      </div>
                      <button
                        onClick={() => generateEventSummaryPDF(report)}
                        className="btn-luxury-filled px-6 py-3 rounded-lg flex items-center space-x-2"
                      >
                        <Download className="w-5 h-5" />
                        <span>Download Summary</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
