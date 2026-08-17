'use client';

import { useState, useEffect } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import Link from 'next/link';
import {
  UserCheck,
  BookOpen,
  User,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import { fetchWithCache, invalidateCache } from '@/lib/cache/client-cache';

/** Returns today's date string in IST as YYYY-MM-DD */
function getISTDateStr() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  return istDate.toISOString().split('T')[0];
}

export default function AdminManualAttendancePage() {
  const [mentor, setMentor] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Form State
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [attendanceDate, setAttendanceDate] = useState<string>(getISTDateStr());
  const [status, setStatus] = useState<'Present' | 'Absent'>('Present');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/mentor/me');
      const meData = await meRes.json();
      if (!meData.authenticated) {
        window.location.href = '/mentor/login';
        return;
      }
      setMentor(meData.mentor);

      const classRes = await fetch('/api/classes');
      const classData = await classRes.json();
      if (classData.success) {
        setClasses(classData.classes);
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

  // Fetch enrolled students whenever selectedClassId changes
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setSelectedStudentId('');
      return;
    }

    const fetchStudentsForClass = async () => {
      setLoadingStudents(true);
      setSelectedStudentId('');
      try {
        const res = await fetch(`/api/students?classId=${selectedClassId}`);
        const data = await res.json();
        if (data.success) {
          setStudents(data.students);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudentsForClass();
  }, [selectedClassId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClassId || !selectedStudentId || !attendanceDate) {
      setErrorMsg('Please select a class, student, and date.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/mentor/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: Number(selectedClassId),
          studentId: Number(selectedStudentId),
          attendanceDate,
          status,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Attendance marked successfully.');
        invalidateCache('/api/attendance');
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setErrorMsg(data.message || 'Failed to mark attendance.');
      }
    } catch {
      setErrorMsg('An error occurred while saving attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col">
      <MentorNavbar mentorName={mentor?.name} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Navigation Back */}
        <Link
          href="/mentor/attendance"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#737373] hover:text-[#0a0a0a] transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Back to Attendance Logs</span>
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">
            Admin Manual Attendance Entry
          </h1>
          <p className="text-sm text-[#737373]">
            Manually update attendance for students who missed registration, with full admin override privileges.
          </p>
        </div>

        {/* Admin Banner Note */}
        <div className="flex items-start space-x-3 p-4 bg-[#f0f9ff] border border-[#bae6fd] rounded-[18px] text-xs text-[#0369a1] leading-relaxed">
          <ShieldAlert className="w-5 h-5 text-[#0284c7] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-[#0284c7]">Admin Full Permissions Mode:</span>
            <p className="mt-0.5">
              This form bypasses all classroom Wi-Fi network restrictions, session time expiration windows, and weekend/holiday blocks.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#737373] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm">Loading attendance options...</p>
          </div>
        ) : (
          <div className="ui-card p-6 sm:p-8 space-y-6">
            
            {/* Feedback Alerts */}
            {successMsg && (
              <div className="flex items-center space-x-2 p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-[18px] text-[#15803d] text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center space-x-2 p-3.5 bg-[#fef2f2] border border-[#fecaca] rounded-[18px] text-[#dc2626] text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* 1. Select Class */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Select Class
                </label>
                <div className="flex items-center space-x-2.5 ui-input px-3.5 py-2.5">
                  <BookOpen className="w-4 h-4 text-[#737373] shrink-0" />
                  <select
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setErrorMsg('');
                    }}
                    required
                    className="w-full bg-transparent border-none text-[#0a0a0a] text-sm font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled>-- Select Subject / Class --</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Select Student */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Select Student
                </label>
                <div className="flex items-center space-x-2.5 ui-input px-3.5 py-2.5">
                  <User className="w-4 h-4 text-[#737373] shrink-0" />
                  <select
                    value={selectedStudentId}
                    onChange={(e) => {
                      setSelectedStudentId(e.target.value);
                      setErrorMsg('');
                    }}
                    required
                    disabled={!selectedClassId || loadingStudents}
                    className="w-full bg-transparent border-none text-[#0a0a0a] text-sm font-medium focus:outline-none cursor-pointer disabled:opacity-40"
                  >
                    <option value="" disabled>
                      {!selectedClassId
                        ? '-- Select Class First --'
                        : loadingStudents
                        ? 'Loading students...'
                        : students.length === 0
                        ? 'No students found in this class'
                        : '-- Select Student --'}
                    </option>
                    {students.map((stud) => (
                      <option key={stud.id} value={stud.id}>
                        {stud.name} ({stud.phone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Attendance Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Attendance Date
                </label>
                <div className="flex items-center space-x-2.5 ui-input px-3.5 py-2.5">
                  <Calendar className="w-4 h-4 text-[#737373] shrink-0" />
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => {
                      setAttendanceDate(e.target.value);
                      setErrorMsg('');
                    }}
                    required
                    className="w-full bg-transparent border-none text-[#0a0a0a] text-sm font-medium focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* 4. Status Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Attendance Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus('Present')}
                    className={`py-2.5 px-4 rounded-[14px] text-xs font-bold border transition flex items-center justify-center space-x-2 cursor-pointer ${
                      status === 'Present'
                        ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]'
                        : 'bg-[#fafafa] border-[#e5e5e5] text-[#737373] hover:text-[#0a0a0a]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Mark Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('Absent')}
                    className={`py-2.5 px-4 rounded-[14px] text-xs font-bold border transition flex items-center justify-center space-x-2 cursor-pointer ${
                      status === 'Absent'
                        ? 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]'
                        : 'bg-[#fafafa] border-[#e5e5e5] text-[#737373] hover:text-[#0a0a0a]'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Mark Absent</span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={submitting || !selectedClassId || !selectedStudentId || !attendanceDate}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>Saving Attendance...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span>Save Attendance Record</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        )}

      </main>
    </div>
  );
}
