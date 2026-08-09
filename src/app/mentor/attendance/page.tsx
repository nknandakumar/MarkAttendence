'use client';

import { useState, useEffect } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import {
  CalendarCheck,
  Search,
  RefreshCw,
  Clock,
  Globe,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function AttendanceHistoryPage() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState<any>(null);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState<string>('');

  const loadClasses = async () => {
    try {
      const meRes = await fetch('/api/mentor/me');
      const meData = await meRes.json();
      if (meData.authenticated) setMentor(meData.mentor);

      const res = await fetch('/api/classes');
      const data = await res.json();
      if (data.success) {
        setClasses(data.classes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      let queryUrl = '/api/attendance?';
      if (selectedClassId) queryUrl += `classId=${selectedClassId}&`;
      if (dateFilter) queryUrl += `date=${dateFilter}&`;

      const res = await fetch(queryUrl);
      const data = await res.json();
      if (data.success) {
        setAttendance(data.attendance);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [selectedClassId, dateFilter]);

  const filteredAttendance = attendance.filter((item) => {
    const matchesSearch =
      item.studentName.toLowerCase().includes(search.toLowerCase()) ||
      item.studentPhone.includes(search) ||
      item.className.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col">
      <MentorNavbar mentorName={mentor?.name} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">
              Live Attendance Logs
            </h1>
            <p className="text-sm text-[#737373]">
              Real-time daily verification records and classroom network logs.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={loadAttendance}
              className="btn-secondary"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="ui-card p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="flex items-center space-x-2.5 px-3 py-1.5 bg-[#f5f5f5] rounded-[18px] border border-transparent">
            <Search className="w-4 h-4 text-[#737373] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name or phone..."
              className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-xs font-medium focus:outline-none"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider whitespace-nowrap">Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-1.5 ui-input text-xs font-semibold text-[#0a0a0a] cursor-pointer"
            />
          </div>

          {/* Class Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider whitespace-nowrap">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-1.5 ui-input text-xs font-semibold text-[#0a0a0a] cursor-pointer"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Attendance Log Table */}
        {loading ? (
          <div className="py-12 text-center text-[#737373] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm">Loading attendance logs...</p>
          </div>
        ) : filteredAttendance.length === 0 ? (
          <div className="ui-card p-12 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-[#737373] mx-auto shrink-0" />
            <p className="text-sm text-[#737373]">No attendance records found for the selected filters.</p>
          </div>
        ) : (
          <div className="ui-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fafafa] border-b border-[#e5e5e5] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  <tr>
                    <th className="py-3 px-5">Student Name</th>
                    <th className="py-3 px-5">Phone Number</th>
                    <th className="py-3 px-5">Classroom</th>
                    <th className="py-3 px-5">Marked Time</th>
                    <th className="py-3 px-5">Verification IP</th>
                    <th className="py-3 px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5] text-sm">
                  {filteredAttendance.map((log) => {
                    const markedTime = new Date(log.markedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <tr key={log.id} className="hover:bg-[#fafafa] transition">
                        <td className="py-3.5 px-5 font-semibold text-[#0a0a0a]">
                          {log.studentName}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-xs text-[#737373]">
                          {log.studentPhone}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="badge-soft">
                            {log.className}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-[#737373]">
                          <div className="flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                            <span>{markedTime}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs font-mono text-[#737373]">
                          <div className="flex items-center space-x-1.5">
                            <Globe className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                            <span>{log.ipAddress || 'Internal'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <span className="badge-solid">
                            Present
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
