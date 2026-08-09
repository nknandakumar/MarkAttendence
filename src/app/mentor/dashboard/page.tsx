'use client';

import { useState, useEffect } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import Link from 'next/link';
import {
  BookOpen,
  Users,
  CalendarCheck,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Plus,
} from 'lucide-react';

export default function MentorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get mentor info
      const meRes = await fetch('/api/mentor/me');
      const meData = await meRes.json();
      if (!meRes.ok || !meData.authenticated) {
        window.location.href = '/mentor/login';
        return;
      }
      setMentor(meData.mentor);

      // Get classes
      const classRes = await fetch('/api/classes');
      const classData = await classRes.json();
      if (classData.success) {
        setClasses(classData.classes);
      }

      // Get total students
      const studRes = await fetch('/api/students');
      const studData = await studRes.json();
      if (studData.success) {
        setTotalStudentsCount(studData.students.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalTodayPresent = classes.reduce((sum, c) => sum + (c.todayPresent || 0), 0);

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                        <span className="text-xs font-bold text-[#737373]">{todayAbsent}</span>
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
