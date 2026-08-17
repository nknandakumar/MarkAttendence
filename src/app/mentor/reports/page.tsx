'use client';

import { useState, useEffect } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import {
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Users,
  BookOpen,
  AlertCircle,
} from 'lucide-react';

export default function AttendanceReportsPage() {
  const [reportType, setReportType] = useState<'students' | 'classes'>('students');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState<any[]>([]);
  const [mentor, setMentor] = useState<any>(null);

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

  const loadReports = async () => {
    setLoading(true);
    try {
      let url = `/api/reports?type=${reportType}&`;
      if (selectedClassId) url += `classId=${selectedClassId}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setReportsData(data.reports);
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
    loadReports();
  }, [reportType, selectedClassId]);

  const handleExport = (format: 'csv' | 'xlsx') => {
    let exportUrl = `/api/reports?type=${reportType}&format=${format}&`;
    if (selectedClassId) exportUrl += `classId=${selectedClassId}&`;
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col">
      <MentorNavbar mentorName={mentor?.name} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">
              Attendance Reports & Analytics
            </h1>
            <p className="text-sm text-[#737373]">
              Detailed statistics, student attendance rates, and data exports.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => handleExport('csv')}
              className="btn-secondary"
            >
              <FileText className="w-4 h-4 shrink-0 text-[#0a0a0a]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('xlsx')}
              className="btn-primary"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-[#ffffff]" />
              <span>Export Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="ui-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tab Selection */}
          <div className="flex items-center space-x-1.5 bg-[#f5f5f5] p-1 rounded-[18px] border border-transparent">
            <button
              onClick={() => setReportType('students')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-[18px] text-xs font-semibold transition ${
                reportType === 'students'
                  ? 'bg-[#0a0a0a] text-[#ffffff]'
                  : 'text-[#737373] hover:text-[#0a0a0a]'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Student Breakdown</span>
            </button>

            <button
              onClick={() => setReportType('classes')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-[18px] text-xs font-semibold transition ${
                reportType === 'classes'
                  ? 'bg-[#0a0a0a] text-[#ffffff]'
                  : 'text-[#737373] hover:text-[#0a0a0a]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Class Summary</span>
            </button>
          </div>

          {/* Filter Class Dropdown */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider whitespace-nowrap">Filter Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-1.5 ui-input text-xs font-semibold text-[#0a0a0a] cursor-pointer"
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

        {/* Reports Content */}
        {loading ? (
          <div className="py-12 text-center text-[#737373] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm">Calculating attendance metrics...</p>
          </div>
        ) : reportsData.length === 0 ? (
          <div className="ui-card p-12 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-[#737373] mx-auto shrink-0" />
            <p className="text-sm text-[#737373]">No report data available for the selected filters.</p>
          </div>
        ) : reportType === 'students' ? (
          <div className="ui-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fafafa] border-b border-[#e5e5e5] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-5">Student Name</th>
                    <th className="py-3 px-5">Phone Number</th>
                    <th className="py-3 px-5 text-center">Total Classes Attended</th>
                    <th className="py-3 px-5 text-center">Last Active Date</th>
                    <th className="py-3 px-5 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5] text-sm">
                  {reportsData.map((row, idx) => {
                    const totalAttendedVal = row.totalAttended ?? row.present ?? 0;
                    const rateVal = row.attendanceRate ?? row.rawPercentage ?? 0;
                    const lastDateVal = row.lastAttendedDate || 'N/A';

                    return (
                      <tr key={row.studentId || row.id || idx} className="hover:bg-[#fafafa] transition">
                        <td className="py-3.5 px-4 text-center font-mono text-xs text-[#737373] font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-[#0a0a0a]">
                          {row.name}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-xs text-[#737373]">
                          {row.phone}
                        </td>
                        <td className="py-3.5 px-5 text-center font-bold text-[#0a0a0a]">
                          {totalAttendedVal}
                        </td>
                        <td className="py-3.5 px-5 text-center text-xs text-[#737373]">
                          {lastDateVal}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <span className="badge-solid">
                            {rateVal}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reportsData.map((row, idx) => (
              <div key={row.classId || row.id || idx} className="ui-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#0a0a0a]">{row.className || row.name}</h3>
                  <span className="badge-soft">
                    {row.totalStudents ?? row.totalEnrolled ?? 0} Students
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 py-2.5 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5] text-center">
                  <div>
                    <span className="block text-[10px] text-[#737373] uppercase font-semibold">Total Sessions</span>
                    <span className="text-xs font-bold text-[#0a0a0a]">{row.totalSessions ?? 0}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#737373] uppercase font-semibold">Avg Attendance</span>
                    <span className="text-xs font-bold text-[#0a0a0a]">{row.averageAttendance ?? row.todayPercentage ?? '0%'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
