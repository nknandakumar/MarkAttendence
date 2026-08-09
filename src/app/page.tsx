'use client';

import { useState, useEffect } from 'react';
import { Wifi, CheckCircle2, AlertCircle, Lock, RefreshCw, PhoneCall, UserCheck, BookOpen } from 'lucide-react';

interface ClassItem {
  id: number;
  name: string;
  description?: string | null;
}

export default function StudentAttendancePage() {
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'allowed' | 'rejected'>('checking');
  const [networkMessage, setNetworkMessage] = useState<string>('Checking classroom network...');
  const [phone, setPhone] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  const [resultState, setResultState] = useState<{
    type: 'idle' | 'success' | 'duplicate' | 'error';
    message: string;
    studentName?: string;
    className?: string;
  }>({ type: 'idle', message: '' });

  // Fetch available classes created by mentor
  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/public/classes', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.classes)) {
        setClassesList(data.classes);
      }
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    }
  };

  // Verify network on load
  const checkNetwork = async () => {
    setNetworkStatus('checking');
    setNetworkMessage('Checking classroom network...');
    try {
      const res = await fetch('/api/attendance/check-network');
      const data = await res.json();
      if (res.ok && data.isAllowed) {
        setNetworkStatus('allowed');
        setNetworkMessage('Classroom network verified');
      } else {
        setNetworkStatus('rejected');
        setNetworkMessage(data.message || 'Connect to the classroom Wi-Fi to mark attendance.');
      }
    } catch {
      setNetworkStatus('rejected');
      setNetworkMessage('Connect to the classroom Wi-Fi to mark attendance.');
    }
  };

  useEffect(() => {
    checkNetwork();
    fetchClasses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClassId) {
      setResultState({
        type: 'error',
        message: 'Please select your class from the dropdown options.',
      });
      return;
    }

    if (!phone.trim() || submitting) return;

    setSubmitting(true);
    setResultState({ type: 'idle', message: '' });

    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone, 
          classId: Number(selectedClassId) 
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResultState({
          type: 'success',
          message: data.message || 'Attendance marked successfully.',
          studentName: data.studentName,
          className: data.className,
        });
      } else if (data.code === 'ALREADY_MARKED') {
        setResultState({
          type: 'duplicate',
          message: data.message || 'Attendance already marked today.',
          studentName: data.studentName,
        });
      } else if (data.code === 'CLASSROOM_NETWORK_REQUIRED') {
        setNetworkStatus('rejected');
        setResultState({
          type: 'error',
          message: 'Connect to the classroom Wi-Fi to mark attendance.',
        });
      } else {
        setResultState({
          type: 'error',
          message: data.message || 'Something went wrong.',
        });
      }
    } catch {
      setResultState({
        type: 'error',
        message: 'Something went wrong. Please check connection and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#f5f5f5] text-[#0a0a0a]">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header Section */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[18px] bg-[#0a0a0a] text-[#ffffff] mb-1">
            <UserCheck className="w-6 h-6 text-[#ffffff] shrink-0" />
          </div>
          <h1 className="text-3xl font-bold tracking-[-1px] text-[#0a0a0a]">
            Mark Attendance
          </h1>
        
        </div>

        {/* Card Container (shadcn/ui Paper Card — 24px Radius, Hairline Border & Elevation) */}
        <div className="ui-card p-6 sm:p-8 space-y-6">
          
          {/* Status Indicator */}
          <div className="space-y-4">
            {networkStatus === 'checking' && (
              <div className="flex items-center justify-center space-x-2.5 py-3 px-4 bg-[#f5f5f5] rounded-[18px] border border-[#e5e5e5]">
                <RefreshCw className="w-4 h-4 text-[#0a0a0a] animate-spin shrink-0" />
                <span className="text-xs font-medium text-[#737373]">Checking classroom network...</span>
              </div>
            )}

            {networkStatus === 'allowed' && (
              <div className="flex items-center justify-between py-2.5 px-4 bg-[#f0fdf4] rounded-[18px] border border-[#bbf7d0] text-[#15803d] text-xs font-semibold">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                  <span>Classroom network verified</span>
                </div>
                <Wifi className="w-3.5 h-3.5 text-[#16a34a] animate-pulse shrink-0" />
              </div>
            )}

            {networkStatus === 'rejected' && (
              <div className="space-y-3 text-center py-2 bg-[#fef2f2] p-4 rounded-[18px] border border-[#fecaca]">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-[18px] bg-[#fee2e2] text-[#dc2626] border border-[#fca5a5]">
                  <Lock className="w-5 h-5 text-[#dc2626] shrink-0" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#dc2626]">Classroom Wi-Fi Required</h3>
                  <p className="text-xs text-[#991b1b] leading-relaxed">
                    Connect to the classroom Wi-Fi to mark attendance.
                  </p>
                </div>
                <button
                  onClick={checkNetwork}
                  className="btn-secondary w-full !bg-[#ffffff] !border-[#fca5a5] text-[#dc2626] hover:!bg-[#fee2e2]"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Re-check Network</span>
                </button>
              </div>
            )}
          </div>

          {/* Form when Network is Approved */}
          {networkStatus === 'allowed' && (
            <div className="space-y-5">
              
              {resultState.type === 'success' ? (
                <div className="py-6 text-center space-y-3 bg-[#f0fdf4] rounded-[18px] border border-[#bbf7d0] p-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#16a34a] text-[#ffffff]">
                    <CheckCircle2 className="w-6 h-6 text-[#ffffff] shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#15803d]">✓ Attendance Marked</h3>
                    {resultState.studentName && (
                      <p className="text-sm font-semibold text-[#15803d] mt-1">
                        {resultState.studentName}
                      </p>
                    )}
                    {resultState.className && (
                      <p className="text-xs text-[#166534] mt-0.5 font-medium uppercase tracking-wider">
                        Class: {resultState.className}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setResultState({ type: 'idle', message: '' });
                      setPhone('');
                    }}
                    className="mt-1 text-xs font-semibold text-[#15803d] hover:underline transition"
                  >
                    Mark another student
                  </button>
                </div>
              ) : resultState.type === 'duplicate' ? (
                <div className="py-6 text-center space-y-3 bg-[#fef2f2] rounded-[18px] border border-[#fecaca] p-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-[18px] bg-[#fee2e2] text-[#dc2626]">
                    <AlertCircle className="w-5 h-5 text-[#dc2626] shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#dc2626]">Attendance Already Marked Today</h3>
                    {resultState.studentName && (
                      <p className="text-xs font-medium text-[#991b1b] mt-1">
                        Student: {resultState.studentName}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setResultState({ type: 'idle', message: '' })}
                    className="text-xs font-semibold text-[#dc2626] hover:underline"
                  >
                    Try another phone number
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Class Selection Dropdown */}
                  {classesList.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                        Select Class
                      </label>
                      <div className="flex items-center space-x-2.5 ui-input px-3.5 py-2.5 relative">
                        <BookOpen className="w-4 h-4 text-[#737373] shrink-0" />
                        <select
                          value={selectedClassId}
                          onChange={(e) => {
                            setSelectedClassId(e.target.value);
                            if (resultState.type === 'error') {
                              setResultState({ type: 'idle', message: '' });
                            }
                          }}
                          className="w-full bg-transparent border-none text-[#0a0a0a] text-sm font-medium focus:outline-none focus:ring-0 p-0 appearance-none cursor-pointer pr-6"
                        >
                          <option value="" disabled className="bg-[#ffffff] text-[#737373]">
                            -- Select Your Class --
                          </option>
                          {classesList.map((cls) => (
                            <option key={cls.id} value={cls.id} className="bg-[#ffffff] text-[#0a0a0a]">
                              {cls.name} {cls.description ? `(${cls.description})` : ''}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#737373] text-[10px]">
                          ▼
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                      Registered Phone Number
                    </label>
                    <div className="flex items-center space-x-2.5 ui-input px-3.5 py-2.5">
                      <PhoneCall className="w-4 h-4 text-[#737373] shrink-0" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter Phone Number"
                        required
                        autoFocus
                        className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-sm font-medium focus:outline-none focus:ring-0 p-0"
                      />
                    </div>
                  </div>

                  {resultState.type === 'error' && (
                    <div className="flex items-center space-x-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-[18px] text-[#dc2626] text-xs font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#dc2626]" />
                      <span>{resultState.message}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !phone.trim() || !selectedClassId}
                    className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed mt-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Submit Attendance</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Footer Link */}
        <div className="text-center">
          <a
            href="/mentor/login"
            className="text-xs font-medium text-[#737373] hover:text-[#0a0a0a] transition underline"
          >
            Mentor Access Portal →
          </a>
        </div>

      </div>
    </main>
  );
}
