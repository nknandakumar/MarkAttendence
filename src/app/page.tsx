'use client';

import { useState, useEffect } from 'react';
import { Wifi, CheckCircle2, AlertCircle, Lock, RefreshCw, PhoneCall, UserCheck, BookOpen, CalendarOff, Clock } from 'lucide-react';
import { fetchWithCache } from '@/lib/cache/client-cache';

interface ClassItem {
  id: number;
  name: string;
  description?: string | null;
  sessionStart?: string | null;
  sessionEnd?: string | null;
}

interface HolidayInfo {
  isHoliday: boolean;
  reason?: string;
}

/** Convert 24h "HH:MM" to "H:MM AM/PM" */
function formatTime12h(t?: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Returns today's date as YYYY-MM-DD in IST */
function getISTDateStr() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  return istDate.toISOString().split('T')[0];
}

/** Returns current time as "HH:MM" in IST */
function getISTTimeStr() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  const h = istDate.getUTCHours();
  const m = istDate.getUTCMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Check if today (IST) is a weekend */
function isTodayWeekend(): { is: boolean; day: string } {
  const todayStr = getISTDateStr();
  const dayOfWeek = new Date(todayStr + 'T00:00:00Z').getUTCDay();
  if (dayOfWeek === 0) return { is: true, day: 'Sunday' };
  if (dayOfWeek === 6) return { is: true, day: 'Saturday' };
  return { is: false, day: '' };
}

export default function StudentAttendancePage() {
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'allowed' | 'rejected'>('checking');
  const [phone, setPhone] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [holidayInfo, setHolidayInfo] = useState<HolidayInfo>({ isHoliday: false });
  const [currentTime, setCurrentTime] = useState<string>(getISTTimeStr());

  const [resultState, setResultState] = useState<{
    type: 'idle' | 'success' | 'duplicate' | 'error' | 'session_closed' | 'holiday';
    message: string;
    studentName?: string;
    className?: string;
  }>({ type: 'idle', message: '' });

  // Update live clock every 10 seconds to auto-detect active class window transitions
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getISTTimeStr());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch available classes
  const fetchClasses = async () => {
    try {
      const data = await fetchWithCache('/api/public/classes', 30 * 1000);
      if (data && data.success && Array.isArray(data.classes)) {
        setClassesList(data.classes);
      }
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    }
  };

  /** Check if today is a holiday (weekend or admin-defined) */
  const checkHoliday = async () => {
    const weekend = isTodayWeekend();
    if (weekend.is) {
      setHolidayInfo({ isHoliday: true, reason: `It's ${weekend.day} — No class today! 🎉` });
      return;
    }

    try {
      const todayStr = getISTDateStr();
      const res = await fetch('/api/holidays');
      const data = await res.json();
      if (data.success && Array.isArray(data.holidays)) {
        const todayHoliday = data.holidays.find((h: any) => h.date === todayStr);
        if (todayHoliday) {
          setHolidayInfo({ isHoliday: true, reason: todayHoliday.reason });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to check holidays:', err);
    }

    setHolidayInfo({ isHoliday: false });
  };

  // Verify network on load
  const checkNetwork = async () => {
    setNetworkStatus('checking');
    try {
      const res = await fetch('/api/attendance/check-network');
      const data = await res.json();
      if (res.ok && data.isAllowed) {
        setNetworkStatus('allowed');
      } else {
        setNetworkStatus('rejected');
      }
    } catch {
      setNetworkStatus('rejected');
    }
  };

  useEffect(() => {
    checkNetwork();
    fetchClasses();
    checkHoliday();
  }, []);

  // Find the currently active class based on assigned timings
  const activeClass = classesList.find((cls) => {
    if (!cls.sessionStart || !cls.sessionEnd) return false;
    return currentTime >= cls.sessionStart && currentTime <= cls.sessionEnd;
  });

  // Scheduled classes for display when no session is active
  const scheduledClasses = classesList.filter((c) => c.sessionStart && c.sessionEnd);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeClass) {
      setResultState({
        type: 'session_closed',
        message: 'No active class session right now.',
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
          classId: activeClass.id 
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
      } else if (data.code === 'SESSION_CLOSED') {
        setResultState({
          type: 'session_closed',
          message: data.message || 'Session is closed.',
        });
      } else if (data.code === 'SESSION_HOLIDAY') {
        setResultState({
          type: 'holiday',
          message: data.message || 'No class today.',
        });
      } else if (data.code === 'CLASSROOM_NETWORK_REQUIRED') {
        setNetworkStatus('rejected');
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
          <div className="flex justify-center mb-1">
            <img
              src="/logo.png"
              alt="Check In Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-[-1px] text-[#0a0a0a]">
            Check In
          </h1>
        </div>

        {/* Card Container */}
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

          {/* Holiday Banner — shown when network is allowed but it's a holiday */}
          {networkStatus === 'allowed' && holidayInfo.isHoliday && (
            <div className="py-6 text-center space-y-3 bg-[#fefce8] rounded-[18px] border border-[#fde68a] p-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#fde68a] text-[#92400e]">
                <CalendarOff className="w-6 h-6 shrink-0" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#92400e]">No Class Today 🎉</h3>
                <p className="text-sm text-[#78350f] mt-1 font-medium">{holidayInfo.reason}</p>
                <p className="text-xs text-[#a16207] mt-1">Attendance is not available. See you next time!</p>
              </div>
            </div>
          )}

          {/* Form when Network is Approved and not a holiday */}
          {networkStatus === 'allowed' && !holidayInfo.isHoliday && (
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
                    className="mt-1 text-xs font-semibold text-[#15803d] hover:underline transition cursor-pointer"
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
                    className="text-xs font-semibold text-[#dc2626] hover:underline cursor-pointer"
                  >
                    Try another phone number
                  </button>
                </div>
              ) : !activeClass ? (
                /* No Active Session View */
                <div className="py-6 text-center space-y-4 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5] p-5">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#ffffff] text-[#737373] border border-[#e5e5e5]">
                    <Clock className="w-6 h-6 shrink-0" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-[#0a0a0a]">No Active Class Session</h3>
                    <p className="text-xs text-[#737373] leading-relaxed max-w-xs mx-auto">
                      Attendance can only be submitted during an active class session time window.
                    </p>
                  </div>

                  {scheduledClasses.length > 0 && (
                    <div className="pt-3 border-t border-[#e5e5e5] text-left space-y-2">
                      <p className="text-[10px] font-bold text-[#737373] uppercase tracking-wider">Class Timings Today:</p>
                      <div className="space-y-1.5">
                        {scheduledClasses.map((cls) => (
                          <div key={cls.id} className="flex items-center justify-between text-xs p-2.5 bg-[#ffffff] rounded-[12px] border border-[#e5e5e5]">
                            <span className="font-semibold text-[#0a0a0a]">{cls.name}</span>
                            <span className="font-mono text-[#0284c7] font-semibold">{formatTime12h(cls.sessionStart)} – {formatTime12h(cls.sessionEnd)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Active Session Form */
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Active Class Session Card */}
                  <div className="p-4 bg-[#f0f9ff] border border-[#bae6fd] rounded-[18px] flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-[14px] bg-[#0284c7] text-[#ffffff] flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 shrink-0" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                          <h3 className="text-base font-bold text-[#0284c7]">{activeClass.name}</h3>
                        </div>
                        <p className="text-xs text-[#0369a1] font-semibold mt-0.5">
                          Session Open: {formatTime12h(activeClass.sessionStart)} – {formatTime12h(activeClass.sessionEnd)}
                        </p>
                      </div>
                    </div>
                  </div>

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
                    disabled={submitting || !phone.trim()}
                    className="w-full font-bold text-sm text-[#ffffff] bg-[#2385EB] hover:bg-[#1b6ecc] active:bg-[#165bb0] py-3 px-4 rounded-[18px] transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2 cursor-pointer shadow-sm flex items-center justify-center space-x-2"
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

        {/* Footer Link & Contribution */}
        <div className="text-center space-y-2 pt-2">
          <div>
            <a
              href="/mentor/login"
              className="text-xs font-medium text-[#737373] hover:text-[#0a0a0a] transition underline"
            >
              Mentor Access Portal →
            </a>
          </div>

          <p className="text-[11px] font-medium text-[#737373]">
            Designed and Developed by{' '}
            <a
              href="https://www.linkedin.com/in/nandakumarm-/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#0a0a0a] hover:text-[#2385EB] transition underline"
            >
              Nanda Kumar
            </a>
          </p>
        </div>

      </div>
    </main>
  );
}
