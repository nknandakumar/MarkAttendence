'use client';

import { useState, useEffect, useMemo } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import {
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Users,
  BookOpen,
  AlertCircle,
  Search,
  X,
} from 'lucide-react';

export default function AttendanceReportsPage() {
  const [reportType, setReportType] = useState<'students' | 'classes'>('students');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(false);
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
    if (!selectedClassId) {
      setReportsData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const url = `/api/reports?type=${reportType}&classId=${selectedClassId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setReportsData(data.reports || []);
      } else {
        setReportsData([]);
      }
    } catch (err) {
      console.error(err);
      setReportsData([]);
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
    if (!selectedClassId) {
      alert('Please select a class first to export reports.');
      return;
    }
    const exportUrl = `/api/reports?type=${reportType}&format=${format}&classId=${selectedClassId}`;
    window.open(exportUrl, '_blank');
  };

  const selectedClassName = classes.find((c) => String(c.id) === selectedClassId)?.name;

  // Filter report data by search query
  const filteredReportsData = useMemo(() => {
    if (!search.trim()) return reportsData;
    const q = search.toLowerCase();
    return reportsData.filter((r) => {
      const nameMatch = r.name?.toLowerCase().includes(q);
      const phoneMatch = r.phone?.includes(q);
      const classMatch = (r.className || r.enrolledClassNames)?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || classMatch;
    });
  }, [reportsData, search]);

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
              disabled={!selectedClassId}
              className="btn-secondary disabled:opacity-40"
            >
              <FileText className="w-4 h-4 shrink-0 text-[#0a0a0a]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('xlsx')}
              disabled={!selectedClassId}
              className="btn-primary disabled:opacity-40"
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
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-[18px] text-xs font-semibold transition cursor-pointer ${
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
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-[18px] text-xs font-semibold transition cursor-pointer ${
                reportType === 'classes'
                  ? 'bg-[#0a0a0a] text-[#ffffff]'
                  : 'text-[#737373] hover:text-[#0a0a0a]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Class Summary</span>
            </button>
          </div>

          {/* Search & Filter Class */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            {/* Search Bar with Cancel Button */}
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#f5f5f5] rounded-[18px] border border-transparent w-full sm:w-64">
              <Search className="w-4 h-4 text-[#737373] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!selectedClassId}
                placeholder="Search student or phone..."
                className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-xs font-medium focus:outline-none disabled:opacity-40"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="p-0.5 rounded-full text-[#737373] hover:text-[#0a0a0a] transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
            </div>

            {/* Filter Class Dropdown (No All Classes) */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-[#737373] uppercase tracking-wider whitespace-nowrap">
                Filter Class:
              </span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3.5 py-1.5 ui-input text-xs font-bold text-[#0a0a0a] cursor-pointer min-w-[170px]"
              >
                <option value="">-- Select Class --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Reports Content */}
        {!selectedClassId ? (
          <div className="ui-card p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#f0f9ff] border border-[#bae6fd] flex items-center justify-center mx-auto text-[#0284c7]">
              <BookOpen className="w-6 h-6 shrink-0" />
            </div>
            <h3 className="text-base font-bold text-[#0a0a0a]">Select a Classroom</h3>
            <p className="text-xs text-[#737373] max-w-sm mx-auto leading-relaxed">
              Please select a classroom from the "Filter Class" dropdown above to view the attendance report.
            </p>
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-[#737373] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm">Calculating attendance metrics...</p>
          </div>
        ) : filteredReportsData.length === 0 ? (
          <div className="ui-card p-12 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-[#737373] mx-auto shrink-0" />
            <p className="text-sm text-[#737373]">
              {search ? 'No results match your search query.' : 'No report data available for this class.'}
            </p>
          </div>
        ) : reportType === 'students' ? (
          <div className="ui-card overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[850px]">
                <table className="w-full text-left text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '50px' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '90px' }} />
                  </colgroup>
                  <thead className="bg-[#f0f0f0] border-b-2 border-[#d4d4d4] text-[11px] font-bold uppercase tracking-wider text-[#525252] sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-3 text-center border-r border-[#d4d4d4] whitespace-nowrap">#</th>
                      <th className="py-3 px-4 border-r border-[#d4d4d4] whitespace-nowrap">STUDENT NAME</th>
                      <th className="py-3 px-3 border-r border-[#d4d4d4] whitespace-nowrap">PHONE</th>
                      <th className="py-3 px-4 border-r border-[#d4d4d4] whitespace-nowrap">CLASS</th>
                      <th className="py-3 px-3 text-center border-r border-[#d4d4d4] whitespace-nowrap">TOTAL SESSIONS</th>
                      <th className="py-3 px-3 text-center border-r border-[#d4d4d4] whitespace-nowrap">PRESENT</th>
                      <th className="py-3 px-3 text-center border-r border-[#d4d4d4] whitespace-nowrap">ABSENT</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">RATE</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filteredReportsData.map((row, idx) => {
                      const totalSessionsVal = row.totalSessions ?? 0;
                      const presentVal = row.present ?? row.totalAttended ?? 0;
                      const absentVal = row.absent ?? 0;
                      const rateVal = row.attendanceRate ?? row.rawPercentage ?? 0;

                      return (
                        <tr
                          key={row.studentId || row.id || idx}
                          className={`border-b border-[#e5e5e5] transition-colors ${
                            idx % 2 === 0 ? 'bg-[#ffffff]' : 'bg-[#fafafa]'
                          } hover:bg-[#f0f4ff]`}
                        >
                          <td className="py-3.5 px-3 text-center font-mono text-xs text-[#737373] border-r border-[#e5e5e5] whitespace-nowrap">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#0a0a0a] text-xs sm:text-sm truncate border-r border-[#e5e5e5] whitespace-nowrap">
                            {row.name}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-xs text-[#737373] border-r border-[#e5e5e5] whitespace-nowrap">
                            {row.phone}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#525252] truncate border-r border-[#e5e5e5] whitespace-nowrap">
                            {row.enrolledClassNames || selectedClassName || '–'}
                          </td>
                          <td className="py-3.5 px-3 text-center text-xs font-bold text-[#0a0a0a] border-r border-[#e5e5e5] whitespace-nowrap">
                            {totalSessionsVal}
                          </td>
                          <td className="py-3.5 px-3 text-center text-xs font-bold text-[#16a34a] border-r border-[#e5e5e5] whitespace-nowrap">
                            {presentVal}
                          </td>
                          <td className="py-3.5 px-3 text-center text-xs font-bold text-[#dc2626] border-r border-[#e5e5e5] whitespace-nowrap">
                            {absentVal}
                          </td>
                          <td className="py-3.5 px-3 text-center text-xs font-bold whitespace-nowrap">
                            <span
                              className={
                                rateVal >= 75
                                  ? 'text-[#16a34a]'
                                  : rateVal >= 50
                                  ? 'text-[#d97706]'
                                  : 'text-[#dc2626]'
                              }
                            >
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

            {/* Table Footer */}
            <div className="px-5 py-3 bg-[#fafafa] border-t border-[#e5e5e5] flex items-center justify-between text-xs text-[#737373]">
              <span>
                Showing <strong>{filteredReportsData.length}</strong> {filteredReportsData.length === 1 ? 'student' : 'students'}
                {selectedClassName ? ` in ${selectedClassName}` : ''}
              </span>
              <span className="text-[11px] font-medium text-[#737373]">
                TOTAL SESSIONS • PRESENT • ABSENT • RATE
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredReportsData.map((row, idx) => (
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
