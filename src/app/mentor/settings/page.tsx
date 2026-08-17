'use client';

import { useState, useEffect } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import {
  Settings,
  Shield,
  CheckCircle2,
  Lock,
  RefreshCw,
  User,
  CalendarOff,
  Plus,
  Trash2,
  AlertCircle,
  CalendarX,
} from 'lucide-react';

interface HolidayItem {
  id: number;
  date: string;
  reason: string;
}

export default function MentorSettingsPage() {
  const [mentor, setMentor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Holidays state
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayReason, setHolidayReason] = useState('');
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayError, setHolidayError] = useState('');
  const [holidaySuccess, setHolidaySuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/mentor/me');
      const meData = await meRes.json();
      if (meData.authenticated) {
        setMentor(meData.mentor);
      }
      await loadHolidays();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHolidays = async () => {
    try {
      const res = await fetch('/api/holidays');
      const data = await res.json();
      if (data.success) {
        setHolidays(data.holidays);
      }
    } catch (err) {
      console.error('Failed to load holidays:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayReason.trim() || holidaySaving) return;

    setHolidaySaving(true);
    setHolidayError('');
    setHolidaySuccess('');

    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: holidayDate, reason: holidayReason.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHolidaySuccess('Holiday added successfully!');
        setHolidayDate('');
        setHolidayReason('');
        await loadHolidays();
        setTimeout(() => setHolidaySuccess(''), 4000);
      } else {
        setHolidayError(data.message || 'Failed to save holiday.');
      }
    } catch {
      setHolidayError('An error occurred. Please try again.');
    } finally {
      setHolidaySaving(false);
    }
  };

  const handleDeleteHoliday = async (id: number, date: string) => {
    if (!confirm(`Remove holiday on ${formatDate(date)}?`)) return;
    try {
      const res = await fetch(`/api/holidays?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setHolidaySuccess('Holiday removed.');
        await loadHolidays();
        setTimeout(() => setHolidaySuccess(''), 3000);
      }
    } catch {
      setHolidayError('Failed to remove holiday.');
    }
  };

  /** Format YYYY-MM-DD to a readable string */
  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  };

  /** Categorize holidays as upcoming / past */
  const today = new Date().toISOString().split('T')[0];
  const upcomingHolidays = holidays.filter((h) => h.date >= today);
  const pastHolidays = holidays.filter((h) => h.date < today);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col">
      <MentorNavbar mentorName={mentor?.name} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">
            Application Settings
          </h1>
          <p className="text-sm text-[#737373]">
            System configuration, holiday management, and security status.
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#737373]">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm mt-2">Loading system settings...</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Holiday & No-Class Management ── */}
            <div className="ui-card p-6 sm:p-8 space-y-5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] flex items-center justify-center">
                  <CalendarOff className="w-4 h-4 text-[#0a0a0a] shrink-0" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0a0a0a]">Holiday & No-Class Management</h2>
                  <p className="text-xs text-[#737373]">
                    Weekends (Sat & Sun) are always blocked. Add public holidays or ad-hoc no-class dates below.
                  </p>
                </div>
              </div>

              {/* Feedback messages */}
              {holidaySuccess && (
                <div className="flex items-center space-x-2 p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-[18px] text-[#15803d] text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{holidaySuccess}</span>
                </div>
              )}
              {holidayError && (
                <div className="flex items-center space-x-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-[18px] text-[#dc2626] text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{holidayError}</span>
                </div>
              )}

              {/* Add Holiday Form */}
              <form onSubmit={handleAddHoliday} className="space-y-3">
                <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Add New Holiday / No-Class Date</p>
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3 items-end">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[#737373]">Date</label>
                    <input
                      type="date"
                      id="holiday-date"
                      value={holidayDate}
                      onChange={(e) => {
                        setHolidayDate(e.target.value);
                        setHolidayError('');
                      }}
                      required
                      className="px-3.5 py-2.5 ui-input text-sm font-medium w-full sm:w-auto"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[#737373]">Reason / Name</label>
                    <input
                      type="text"
                      id="holiday-reason"
                      value={holidayReason}
                      onChange={(e) => {
                        setHolidayReason(e.target.value);
                        setHolidayError('');
                      }}
                      placeholder="e.g. Diwali, Republic Day, No class today"
                      required
                      className="w-full px-3.5 py-2.5 ui-input text-sm font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={holidaySaving || !holidayDate || !holidayReason.trim()}
                    className="btn-primary !py-2.5 disabled:opacity-40 shrink-0"
                  >
                    {holidaySaving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>Add</span>
                  </button>
                </div>
              </form>

              {/* Holidays List */}
              {holidays.length === 0 ? (
                <div className="py-6 text-center space-y-1.5">
                  <CalendarX className="w-5 h-5 text-[#737373] mx-auto shrink-0" />
                  <p className="text-xs text-[#737373]">No holidays added yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Upcoming */}
                  {upcomingHolidays.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider">
                        Upcoming ({upcomingHolidays.length})
                      </p>
                      <div className="space-y-2">
                        {upcomingHolidays.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-center justify-between p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[14px] text-xs"
                          >
                            <div className="space-y-0.5">
                              <span className="block font-bold text-[#0a0a0a]">{h.reason}</span>
                              <span className="block text-[#737373]">{formatDate(h.date)}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteHoliday(h.id, h.date)}
                              className="p-1.5 rounded-[10px] text-[#737373] hover:text-[#dc2626] hover:bg-[#fef2f2] transition"
                              title="Remove holiday"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past */}
                  {pastHolidays.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider">
                        Past ({pastHolidays.length})
                      </p>
                      <div className="space-y-2">
                        {pastHolidays.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-center justify-between p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[14px] text-xs opacity-60"
                          >
                            <div className="space-y-0.5">
                              <span className="block font-bold text-[#0a0a0a]">{h.reason}</span>
                              <span className="block text-[#737373]">{formatDate(h.date)}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteHoliday(h.id, h.date)}
                              className="p-1.5 rounded-[10px] text-[#737373] hover:text-[#dc2626] hover:bg-[#fef2f2] transition"
                              title="Remove holiday"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Weekends note */}
              <div className="flex items-start space-x-2 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[14px] text-xs text-[#737373]">
                <CalendarOff className="w-4 h-4 shrink-0 mt-0.5 text-[#0a0a0a]" />
                <p>
                  <span className="font-semibold text-[#0a0a0a]">Weekends are automatically blocked.</span>{' '}
                  Saturday and Sunday attendance is disabled at the server level — no manual entry needed.
                </p>
              </div>
            </div>

            {/* ── General App Info ── */}
            <div className="ui-card p-6 sm:p-8 space-y-5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] flex items-center justify-center">
                  <Settings className="w-4 h-4 text-[#0a0a0a] shrink-0" />
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">General Application Settings</h2>
              </div>

              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                    Application Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Classroom Attendance"
                    className="w-full px-3.5 py-2.5 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#0a0a0a] font-medium text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ── Classroom Network Security ── */}
            <div className="ui-card p-6 sm:p-8 space-y-5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] flex items-center justify-center">
                  <Shield className="w-4 h-4 text-[#0a0a0a] shrink-0" />
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">Classroom Network Verification</h2>
              </div>

              <div className="space-y-3 pt-1">
                <div className="p-3.5 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0a0a0a]">Status</span>
                    <span className="inline-flex items-center space-x-1 text-xs font-semibold text-[#0a0a0a] bg-[#ffffff] px-2.5 py-0.5 rounded-[18px] border border-[#e5e5e5]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Configured &amp; Enforced</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#e5e5e5] text-xs text-[#737373]">
                    <span>Server IP Verification</span>
                    <span className="font-mono text-[#0a0a0a] font-semibold">CLASSROOM_ALLOWED_IPS</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5 p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-xs text-[#737373] leading-relaxed">
                  <Lock className="w-4 h-4 text-[#0a0a0a] shrink-0 mt-0.5" />
                  <p>
                    For security purposes, classroom allowed public IPs cannot be edited through the browser UI. They are configured via the server environment variable <code className="bg-[#ffffff] px-1.5 py-0.5 rounded font-mono text-[#0a0a0a] border border-[#e5e5e5]">CLASSROOM_ALLOWED_IPS</code> on Vercel or your hosting environment.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Mentor Account ── */}
            <div className="ui-card p-6 sm:p-8 space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] flex items-center justify-center">
                  <User className="w-4 h-4 text-[#0a0a0a] shrink-0" />
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">Mentor Profile</h2>
              </div>

              {mentor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#0a0a0a]">
                  <div className="p-3.5 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5] space-y-1">
                    <span className="block font-semibold text-[#737373] uppercase">Mentor Name</span>
                    <span className="text-sm font-bold text-[#0a0a0a]">{mentor.name}</span>
                  </div>
                  <div className="p-3.5 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5] space-y-1">
                    <span className="block font-semibold text-[#737373] uppercase">Email Address</span>
                    <span className="text-sm font-bold text-[#0a0a0a]">{mentor.email}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
