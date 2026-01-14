import { useState } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Sparkles, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EventFormData {
  eventName: string;
  date: string;
  venue: string;
  dressCode: string;
  guestCount: string;
  startTime: string;
  endTime: string;
  openShifts: string;
}

interface SmartUploadProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function SmartUpload({ onClose, onSuccess }: SmartUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [aiExtracted, setAiExtracted] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [formData, setFormData] = useState<EventFormData>({
    eventName: '',
    date: '',
    venue: '',
    dressCode: '',
    guestCount: '',
    startTime: '',
    endTime: '',
    openShifts: '',
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const isValidExtension = ['pdf', 'xlsx', 'xls', 'csv'].includes(fileExtension || '');

    if (!validTypes.includes(selectedFile.type) && !isValidExtension) {
      setError('Please upload a PDF, Excel (.xlsx, .xls), or CSV file');
      return;
    }
    setFile(selectedFile);
    setError(null);

    await extractWithAI(selectedFile);
  };

  const extractWithAI = async (selectedFile: File) => {
    setExtracting(true);
    setError(null);

    try {
      // Refresh the session to ensure we have a valid token
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession) {
        console.error('Session refresh failed:', refreshError);

        // Session cannot be refreshed - sign out the user
        await supabase.auth.signOut();

        throw new Error('Your session has expired and could not be refreshed. You have been signed out. Please sign in again to continue.');
      }

      console.log('Session refreshed successfully');

      // Verify the user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('User verification error:', userError);
        await supabase.auth.signOut();
        throw new Error('Authentication failed. You have been signed out. Please sign in again.');
      }

      console.log('User verified:', user.email);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-beo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${refreshedSession.access_token}`,
          },
          body: formData,
        }
      );

      let result;
      const responseText = await response.text();

      try {
        result = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Failed to parse response:', responseText);
        throw new Error(`Server error: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorMessage = result.error || result.details || 'Extraction failed';
        console.error('Server error:', result);

        // Show detailed error message
        if (result.error && result.details) {
          throw new Error(`${result.error}: ${result.details}`);
        }
        throw new Error(errorMessage);
      }

      if (result.success && result.draftEvent) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else if (result.extractedData) {
        setFormData({
          eventName: result.extractedData.eventName || '',
          date: result.extractedData.date || '',
          venue: result.extractedData.venue || '',
          dressCode: 'Black Tie',
          guestCount: result.extractedData.guestCount?.toString() || '',
          startTime: result.extractedData.startTime || '',
          endTime: result.extractedData.endTime || '',
          openShifts: '',
        });
        setAiExtracted(true);
        setShowForm(true);
      } else {
        setShowForm(true);
      }
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err instanceof Error ? err.message : 'Extraction failed. Please fill in the details manually.');
      setShowForm(true);
    } finally {
      setExtracting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const runDiagnostics = async () => {
    setTestingApi(true);
    setDiagnosticResult(null);

    try {
      // Refresh the session to ensure we have a valid token
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession) {
        console.error('Session refresh failed:', refreshError);

        // Session cannot be refreshed - sign out the user
        await supabase.auth.signOut();

        setDiagnosticResult({
          success: false,
          summary: 'Your session has expired and could not be refreshed. You have been signed out. Please sign in again to continue.',
        });
        return;
      }

      console.log('Session refreshed successfully for diagnostics');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-api-config`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${refreshedSession.access_token}`,
          },
        }
      );

      const result = await response.json();
      setDiagnosticResult(result);
    } catch (err) {
      setDiagnosticResult({
        success: false,
        summary: 'Failed to run diagnostics',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setTestingApi(false);
    }
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to create events.');
      }

      const guestCount = parseInt(formData.guestCount) || 0;
      const openShifts = formData.openShifts ? parseInt(formData.openShifts) : Math.ceil(guestCount / 50);

      const { error: eventError } = await supabase
        .from('events')
        .insert({
          title: formData.eventName || 'Untitled Event',
          event_date: formData.date || new Date().toISOString().split('T')[0],
          venue: formData.venue || 'TBD',
          dress_code: formData.dressCode || 'Black Tie',
          start_time: formData.startTime || '00:00',
          end_time: formData.endTime || '00:00',
          open_shifts: openShifts || 5,
          status: 'draft',
          beo_source: file?.name || 'Manual Entry',
          created_by: user.id,
        });

      if (eventError) {
        throw new Error('Failed to create draft event: ' + eventError.message);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1120] border border-[#D4AF37]/30 rounded-xl max-w-2xl w-full p-8 animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="w-7 h-7 text-[#D4AF37]" />
            <h2 className="text-3xl font-serif text-white">BEO Upload</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-300 mb-0 leading-relaxed mr-4">
            Upload a Banquet Event Order (BEO) document and the system will automatically extract event details.
          </p>
          <a
            href="/docs/beo_upload_template.csv"
            download
            className="text-sm text-[#D4AF37] hover:text-[#B8941F] transition-colors"
          >
            Download BEO Template
          </a>
        </div>

        <div className="mb-6">
          <button
            onClick={runDiagnostics}
            disabled={testingApi}
            className="text-sm text-[#D4AF37] hover:text-[#B8941F] transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            <Activity className="w-4 h-4" />
            <span>{testingApi ? 'Testing API Configuration...' : 'Test API Configuration'}</span>
          </button>

          {diagnosticResult && (
            <div className={`mt-3 p-4 rounded-lg border ${
              diagnosticResult.success
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-start space-x-3">
                {diagnosticResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium mb-2 ${
                    diagnosticResult.success ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {diagnosticResult.summary}
                  </p>

                  {diagnosticResult.diagnostics?.checks && (
                    <div className="space-y-2 text-sm">
                      {diagnosticResult.diagnostics.checks.map((check: any, idx: number) => (
                        <div key={idx} className="pl-3 border-l-2 border-gray-600">
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs font-medium ${
                              check.status === 'passed' ? 'text-green-400' :
                              check.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {check.status.toUpperCase()}
                            </span>
                            <span className="text-gray-300">{check.name}</span>
                          </div>
                          <p className="text-gray-400 mt-1">{check.message}</p>
                          {check.action && (
                            <p className="text-gray-300 mt-1">
                              Action: {check.action}
                            </p>
                          )}
                          {check.helpUrl && (
                            <a
                              href={check.helpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#D4AF37] hover:text-[#B8941F] text-xs mt-1 inline-block"
                            >
                              View Help →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {!success ? (
          <>
            {extracting ? (
              <div className="text-center py-12">
                <div className="inline-block mb-4">
                  <Sparkles className="w-16 h-16 text-[#D4AF37] animate-pulse" />
                </div>
                <h3 className="text-xl font-serif text-white mb-2">Extracting Event Details...</h3>
                <p className="text-gray-400">Processing your BEO document</p>
                <div className="mt-6 flex justify-center">
                  <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            ) : !showForm ? (
              <>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
                    dragActive
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                      : 'border-[#D4AF37]/30 hover:border-[#D4AF37]/50'
                  }`}
                >
                  <Upload className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">
                    Drag and drop your BEO file here, or click to browse
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports PDF, Excel (.xlsx, .xls), and CSV files
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-block mt-4 btn-luxury px-6 py-2 rounded-lg cursor-pointer"
                  >
                    Select File
                  </label>
                </div>

                {error && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-red-300 text-sm whitespace-pre-wrap">{error}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {aiExtracted && (
                  <div className="mb-4 p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                    <p className="text-sm text-[#D4AF37] font-medium">Auto-extracted data - Review and edit as needed</p>
                  </div>
                )}

                <div className="mb-6 p-4 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-[#D4AF37]" />
                    <div>
                      <p className="text-white font-medium">{file?.name}</p>
                      <p className="text-sm text-gray-400">
                        {file ? (file.size / 1024 / 1024).toFixed(2) : '0'} MB
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCreateDraft} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Event Name *
                    </label>
                    <input
                      type="text"
                      name="eventName"
                      value={formData.eventName}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-[#1A1F2E] border border-[#D4AF37]/30 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                      placeholder="e.g., Annual Gala Dinner"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Event Date *
                      </label>
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        required
                        className="w-full bg-[#1A1F2E] border border-[#D4AF37]/30 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Venue *
                      </label>
                      <input
                        type="text"
                        name="venue"
                        value={formData.venue}
                        onChange={handleInputChange}
                        required
                        className="w-full bg-[#1A1F2E] border border-[#D4AF37]/30 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                        placeholder="e.g., Grand Ballroom"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Dress Code *
                    </label>
                    <input
                      type="text"
                      name="dressCode"
                      value={formData.dressCode}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-[#1A1F2E] border border-[#D4AF37]/30 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                      placeholder="e.g., Black Tie, Business Formal, All Black"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        name="startTime"
                        value={formData.startTime}
                        onChange={handleInputChange}
                        required
                        className="w-full bg-[#1A1F2E] border border-[#D4AF37]/30 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        End Time *
                      </label>
                      <input
                        type="time"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleInputChange}
                        required
                        className="w-full bg-[#1A1F2E] border border-[#D4AF37]/30 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Guest Count
                      </label>
                      <input
                        type="number"
                        name="guestCount"
                        value={formData.guestCount}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full bg-[#1A1F2E] border border-[#D4AF37]/30 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                        placeholder="200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Open Shifts
                    </label>
                    <input
                      type="number"
                      name="openShifts"
                      value={formData.openShifts}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full bg-[#1A1F2E] border border-[#D4AF37]/30 rounded-lg px-4 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                      placeholder="Auto-calculated from guest count"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty to auto-calculate (1 shift per 50 guests)</p>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-red-300 text-sm whitespace-pre-wrap">{error}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-4 pt-4">
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 btn-luxury-filled py-3 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Creating Draft...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          <span>Create Draft Event</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setFile(null);
                        setFormData({
                          eventName: '',
                          date: '',
                          venue: '',
                          dressCode: '',
                          guestCount: '',
                          startTime: '',
                          endTime: '',
                          openShifts: '',
                        });
                      }}
                      disabled={creating}
                      className="btn-luxury px-6 py-3 rounded-lg disabled:opacity-50"
                    >
                      Back
                    </button>
                  </div>
                </form>
              </>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <h3 className="text-lg font-medium text-white">Draft Event Created Successfully!</h3>
              </div>
              {aiExtracted && (
                <div className="mb-4 flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                  <p className="text-sm text-[#D4AF37]">Automatically extracted and processed your BEO</p>
                </div>
              )}
              <p className="text-gray-300 text-sm">
                The draft event has been created. Review and edit the event details in the Draft Events section before publishing to staff.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
