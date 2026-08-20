'use client';

import { useState, useEffect } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import Link from 'next/link';
import {
  BookOpen,
  Users,
  CalendarCheck,
  GraduationCap,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Plus,
  Clock,
} from 'lucide-react';
import { fetchWithCache } from '@/lib/cache/client-cache';

/** Returns current time in IST as "HH:MM" */
function getISTTimeStr() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  const h = istDate.getUTCHours();
  const m = istDate.getUTCMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convert 24h "HH:MM" to "H:MM AM/PM" */
function formatTime12h(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function MentorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(getISTTimeStr());

  // Update current time every minute so absent count can update automatically
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getISTTimeStr());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (isInitial = true) => {
    if (isInitial && classes.length === 0) {
      setLoading(true);
    }
    try {
      // Single request returns mentor info + classes + total students count
      // Cached 15s server-side — handles concurrent load from 50+ students
      const data = await fetchWithCache('/api/dashboard', 15_000);
      if (!data || !data.success) {
        window.location.href = '/mentor/login';
        return;
      }
      setMentor(data.mentor);
      setClasses(data.classes ?? []);
      setTotalStudentsCount(data.totalStudents ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const totalTodayPresent = classes.reduce((sum, c) => sum + (c.todayPresent || 0), 0);

  /**
   * Determines whether the absent count should be shown for a class.
   * Rule: Absent number is only shown AFTER the session end time has passed.
   * Until the session is done, absent count shows '–'.
   */
  function shouldShowAbsent(cls: any): boolean {
    if (!cls.sessionEnd) return false;
    return currentTime >= cls.sessionEnd;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col">
      <MentorNavbar mentorName={mentor?.name} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">
              Dashboard Overview
            </h1>
            <p className="text-sm text-[#737373]">
              Manage live classroom attendance, active classes, and student metrics.
            </p>
          </div>

          <Link
            href="/mentor/classes"
            className="btn-primary shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Manage Classes</span>
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="ui-card p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Total Classes</span>
              <p className="text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">{classes.length}</p>
            </div>
            <div className="w-10 h-10 rounded-[18px] bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center">
              <BookOpen className="w-5 h-5 shrink-0" />
            </div>
          </div>

          <div className="ui-card p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Total Students</span>
              <p className="text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">{totalStudentsCount}</p>
            </div>
            <div className="w-10 h-10 rounded-[18px] bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center">
              <Users className="w-5 h-5 shrink-0" />
            </div>
          </div>

          <div className="ui-card p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Today's Attendance</span>
              <p className="text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">{totalTodayPresent}</p>
            </div>
            <div className="w-10 h-10 rounded-[18px] bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 shrink-0" />
            </div>
          </div>

          <Link
            href="/mentor/tests"
            className="ui-card p-5 flex items-center justify-between hover:border-[#737373] transition group"
          >
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Assessments</span>
              <p className="text-xs font-bold text-[#0a0a0a] group-hover:underline flex items-center space-x-1 pt-1.5">
                <span>Manage Tests</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </p>
            </div>
            <div className="w-10 h-10 rounded-[18px] bg-[#0a0a0a] text-[#ffffff] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 shrink-0 text-[#ffffff]" />
            </div>
          </Link>
        </div>

        {/* Classes Table / Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0a0a0a]">Classrooms Summary</h2>
            <Link href="/mentor/reports" className="text-xs font-semibold text-[#0a0a0a] hover:underline flex items-center space-x-1">
              <span>Full Reports</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-2 text-[#737373]">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
              <p className="text-sm">Loading classroom data...</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="ui-card p-8 text-center space-y-3">
              <AlertCircle className="w-6 h-6 text-[#737373] mx-auto shrink-0" />
              <p className="text-sm text-[#737373]">No classes found. Create your first class to get started!</p>
              <Link href="/mentor/classes" className="btn-primary !py-1.5 !px-3 !text-xs">
                Create Class
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {classes.map((cls) => {
                const totalStudents = cls.studentCount || 0;
                const todayPresent = cls.todayPresent || 0;
                const todayAbsent = Math.max(0, totalStudents - todayPresent);
                const percentage = totalStudents > 0 ? Math.round((todayPresent / totalStudents) * 100) : 0;
                const showAbsent = shouldShowAbsent(cls);

                return (
                  <div
                    key={cls.id}
                    className="ui-card p-5 space-y-4 transition hover:border-[#737373]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-bold text-[#0a0a0a]">{cls.name}</h3>
                        </div>
                        <p className="text-xs text-[#737373] line-clamp-1 mt-0.5">
                          {cls.description || 'No description provided.'}
                        </p>
                      </div>
                    </div>

                    {/* Session timing indicator */}
                    {cls.sessionStart && cls.sessionEnd && (
                      <div className="flex items-center space-x-1.5 px-2 py-1 bg-[#f0f9ff] border border-[#bae6fd] rounded-[8px] w-fit">
                        <Clock className="w-3 h-3 text-[#0284c7] shrink-0" />
                        <span className="text-[10px] font-semibold text-[#0284c7]">
                          {formatTime12h(cls.sessionStart)} – {formatTime12h(cls.sessionEnd)}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center py-2.5 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5]">
                      <div>
                        <span className="block text-[10px] text-[#737373] uppercase font-semibold">Enrolled</span>
                        <span className="text-xs font-bold text-[#0a0a0a]">{totalStudents}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#737373] uppercase font-semibold">Present</span>
                        <span className="text-xs font-bold text-[#0a0a0a]">{todayPresent}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#737373] uppercase font-semibold">Absent</span>
                        {showAbsent ? (
                          <span className="text-xs font-bold text-[#737373]">{todayAbsent}</span>
                        ) : (
                          <span
                            className="text-xs font-bold text-[#d4d4d4]"
                            title={cls.sessionEnd ? `Shown after session ends at ${formatTime12h(cls.sessionEnd)}` : ''}
                          >
                            –
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[#737373]">Today's Attendance</span>
                        <span className="text-[#0a0a0a] font-bold">{percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#e5e5e5] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0a0a0a] rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2 text-xs">
                      <Link
                        href={`/mentor/attendance?classId=${cls.id}`}
                        className="btn-secondary flex-1 !py-1.5 !px-3 !text-xs"
                      >
                        Attendance
                      </Link>
                      <Link
                        href={`/mentor/students?classId=${cls.id}`}
                        className="btn-outline flex-1 !py-1.5 !px-3 !text-xs"
                      >
                        Students
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
