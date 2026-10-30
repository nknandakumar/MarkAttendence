'use client';

import { useState, useEffect, useMemo } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import {
  Users,
  UserPlus,
  Search,
  Upload,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { fetchWithCache, invalidateCache } from '@/lib/cache/client-cache';
import * as XLSX from 'xlsx';

export default function StudentManagementPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [studentForm, setStudentForm] = useState({
    name: '',
    phone: '',
    classIds: [] as number[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Import Modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [selectedImportClassId, setSelectedImportClassId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [importError, setImportError] = useState('');

  const [notification, setNotification] = useState('');

  // Check URL query parameters for classId on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cId = params.get('classId');
      if (cId) {
        setSelectedClassFilter(cId);
      }
    }
  }, []);

  const loadData = async (forceFresh = false) => {
    setLoading(true);
    if (forceFresh) {
      invalidateCache('/api/reports?type=students');
      invalidateCache('/api/students');
    }

    try {
      // Mentor profile
      const meData = await fetchWithCache('/api/mentor/me', 60 * 1000);
      if (!meData || !meData.authenticated) {
        window.location.href = '/mentor/login';
        return;
      }
      setMentor(meData.mentor);

      // Classes list
      const classData = await fetchWithCache('/api/classes', 30 * 1000);
      if (classData && classData.success) {
        setClasses(classData.classes || []);
      }

      if (!selectedClassFilter) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Fetch student roster with full attendance statistics
      const reportUrl = `/api/reports?type=students&classId=${selectedClassFilter}`;
      const reportRes = forceFresh
        ? await fetch(reportUrl).then((r) => r.json())
        : await fetchWithCache(reportUrl, 15 * 1000);

      if (reportRes && reportRes.success) {
        setStudents(reportRes.reports || []);
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.error('Error loading student records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClassFilter]);

  const openAddModal = () => {
    setEditingStudent(null);
    const initialClassIds = selectedClassFilter ? [Number(selectedClassFilter)] : [];
    setStudentForm({ name: '', phone: '', classIds: initialClassIds });
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (student: any) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name,
      phone: student.phone,
      classIds: student.classes ? student.classes.map((c: any) => c.id) : [],
    });
    setError('');
    setModalOpen(true);
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.phone.trim() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const url = editingStudent ? `/api/students/${editingStudent.id}` : '/api/students';
      const method = editingStudent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setModalOpen(false);
        setNotification(editingStudent ? 'Student updated successfully.' : 'Student registered successfully.');
        setTimeout(() => setNotification(''), 4000);
        loadData(true);
      } else {
        setError(data.message || 'Failed to save student.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete student "${name}"?`)) return;

    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Student "${name}" deleted.`);
        setTimeout(() => setNotification(''), 4000);
        loadData(true);
      } else {
        alert(data.message || 'Failed to delete student.');
      }
    } catch {
      alert('Failed to delete student.');
    }
  };

  const handleFileImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || importing) return;

    setImporting(true);
    setImportError('');
    setImportSummary(null);

    const formData = new FormData();
    formData.append('file', importFile);
    if (selectedImportClassId) {
      formData.append('classId', selectedImportClassId);
    }

    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setImportSummary(data.summary);
        setNotification(data.message);
        setTimeout(() => setNotification(''), 4000);
        loadData(true);
      } else {
        setImportError(data.message || 'Import failed.');
      }
    } catch {
      setImportError('An error occurred while uploading file.');
    } finally {
      setImporting(false);
    }
  };

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.phone?.includes(q)
    );
  }, [students, search]);

  const selectedClassName = classes.find((c) => String(c.id) === selectedClassFilter)?.name;

  // Export to Excel
  const handleExportExcel = (dataToExport: any[]) => {
    const filename = `Student_Directory_${
      selectedClassName ? selectedClassName.replace(/[^a-zA-Z0-9]/g, '_') : 'All_Classes'
    }_${new Date().toISOString().split('T')[0]}.xlsx`;

    const exportData = dataToExport.map((s, index) => ({
      '#': index + 1,
      'Student Name': s.name,
      'Phone Number': s.phone,
      'Enrolled Classes': s.enrolledClassNames || '–',
      'Total Sessions': s.totalSessions,
      'Present': s.present ?? s.totalAttended,
      'Absent': s.absent,
      'Attendance Rate': `${s.attendanceRate}%`,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col">
      <MentorNavbar mentorName={mentor?.name} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">
              Student Directory
            </h1>
            <p className="text-sm text-[#737373]">
              Manage registered students, live attendance metrics, and class enrollments.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => handleExportExcel(filteredStudents)}
              className="btn-secondary"
              title="Download filtered roster to Excel"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={() => {
                setImportFile(null);
                setImportError('');
                setImportSummary(null);
                setSelectedImportClassId(selectedClassFilter);
                setImportModalOpen(true);
              }}
              className="btn-secondary"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>Import Excel / CSV</span>
            </button>

            <button
              onClick={openAddModal}
              className="btn-primary"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Register Student</span>
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {notification && (
          <div className="flex items-center space-x-2 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#0a0a0a] text-xs font-semibold shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Filters Toolbar (Search on left, FILTER CLASS on right) */}
        <div className="bg-[#ffffff] border border-[#e5e5e5] rounded-[18px] px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-2.5 w-full sm:w-auto flex-1">
            <Search className="w-4 h-4 text-[#737373] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!selectedClassFilter}
              placeholder="Filter student by name or phone..."
              className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-sm focus:outline-none font-medium disabled:opacity-40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 rounded-full text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5] transition cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto shrink-0">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider whitespace-nowrap">
              FILTER CLASS:
            </span>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3.5 py-1.5 ui-input text-xs font-bold text-[#0a0a0a] cursor-pointer min-w-[180px]"
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Excel-Style Spreadsheet Table */}
        <div className="bg-[#ffffff] border border-[#e5e5e5] rounded-[18px] overflow-hidden shadow-xs">
          {!selectedClassFilter ? (
            <div className="py-16 text-center text-[#737373] space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#f0f9ff] border border-[#bae6fd] flex items-center justify-center mx-auto text-[#0284c7]">
                <Users className="w-6 h-6 shrink-0" />
              </div>
              <p className="text-base font-semibold text-[#0a0a0a]">Select a Classroom</p>
              <p className="text-xs text-[#737373] max-w-sm mx-auto">
                Please select a classroom from the "FILTER CLASS" dropdown above to view and manage student records.
              </p>
            </div>
          ) : loading ? (
            <div className="py-20 text-center text-[#737373] space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0a0a0a]" />
              <p className="text-sm font-medium">Loading student directory...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-16 text-center text-[#737373] space-y-3">
              <Users className="w-8 h-8 mx-auto text-[#737373]" />
              <p className="text-base font-semibold text-[#0a0a0a]">No students found.</p>
              <p className="text-xs text-[#737373] max-w-sm mx-auto">
                No students are enrolled in ${selectedClassName || 'this class'}. Click "Register Student" or "Import Excel" to add students.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[950px]">
                <table className="w-full text-left text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '50px' }} />
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '85px' }} />
                    <col style={{ width: '85px' }} />
                    <col style={{ width: '85px' }} />
                    <col style={{ width: '90px' }} />
                  </colgroup>
                  <thead className="bg-[#f0f0f0] border-b-2 border-[#d4d4d4] text-[11px] font-bold uppercase tracking-wider text-[#525252] sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-3 text-center border-r border-[#d4d4d4] whitespace-nowrap">#</th>
                      <th className="py-3 px-4 border-r border-[#d4d4d4] whitespace-nowrap">STUDENT NAME</th>
                      <th className="py-3 px-3 border-r border-[#d4d4d4] whitespace-nowrap">PHONE</th>
                      <th className="py-3 px-4 border-r border-[#d4d4d4] whitespace-nowrap">ENROLLED CLASSES</th>
                      <th className="py-3 px-3 text-center border-r border-[#d4d4d4] whitespace-nowrap">TOTAL SESSIONS</th>
                      <th className="py-3 px-3 text-center border-r border-[#d4d4d4] whitespace-nowrap">PRESENT</th>
                      <th className="py-3 px-3 text-center border-r border-[#d4d4d4] whitespace-nowrap">ABSENT</th>
                      <th className="py-3 px-3 text-center border-r border-[#d4d4d4] whitespace-nowrap">RATE</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">ACTIONS</th>
                    </tr>
                  </thead>
                <tbody className="text-sm">
                  {filteredStudents.map((s, idx) => {
                    const rate = Number(s.attendanceRate ?? 0);
                    return (
                      <tr
                        key={s.id || s.studentId}
                        className={`border-b border-[#e5e5e5] transition-colors ${
                          idx % 2 === 0 ? 'bg-[#ffffff]' : 'bg-[#fafafa]'
                        } hover:bg-[#f0f4ff]`}
                      >
                        <td className="py-3.5 px-3 text-center font-mono text-xs text-[#737373] border-r border-[#e5e5e5]">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#0a0a0a] text-xs sm:text-sm truncate border-r border-[#e5e5e5] whitespace-nowrap">
                          {s.name}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[#737373] border-r border-[#e5e5e5] whitespace-nowrap">
                          {s.phone}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#525252] truncate border-r border-[#e5e5e5] whitespace-nowrap" title={s.enrolledClassNames}>
                          {s.enrolledClassNames || '–'}
                        </td>
                        <td className="py-3.5 px-3 text-center text-xs font-bold text-[#0a0a0a] border-r border-[#e5e5e5]">
                          {s.totalSessions ?? 0}
                        </td>
                        <td className="py-3.5 px-3 text-center text-xs font-bold text-[#16a34a] border-r border-[#e5e5e5]">
                          {s.present ?? s.totalAttended ?? 0}
                        </td>
                        <td className="py-3.5 px-3 text-center text-xs font-bold text-[#dc2626] border-r border-[#e5e5e5]">
                          {s.absent ?? 0}
                        </td>
                        <td className="py-3.5 px-3 text-center text-xs font-bold border-r border-[#e5e5e5]">
                          <span
                            className={
                              rate >= 75
                                ? 'text-[#16a34a]'
                                : rate >= 50
                                ? 'text-[#d97706]'
                                : 'text-[#dc2626]'
                            }
                          >
                            {rate}%
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center space-x-1">
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1 rounded-[10px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#e5e5e5] transition"
                            title="Edit Student"
                          >
                            <Edit2 className="w-3.5 h-3.5 shrink-0 inline" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id || s.studentId, s.name)}
                            className="p-1 rounded-[10px] text-[#737373] hover:text-[#dc2626] hover:bg-[#e5e5e5] transition"
                            title="Delete Student"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Table Footer */}
          {!loading && filteredStudents.length > 0 && (
            <div className="px-5 py-3 bg-[#fafafa] border-t border-[#e5e5e5] flex items-center justify-between text-xs text-[#737373]">
              <span>
                Showing <strong>{filteredStudents.length}</strong> {filteredStudents.length === 1 ? 'student' : 'students'}
                {selectedClassName ? ` in ${selectedClassName}` : ''}
              </span>
              <span className="text-[11px] font-medium text-[#737373]">
                Excel-Style Student Records
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Student Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ui-card w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
              <h2 className="text-lg font-bold text-[#0a0a0a]">
                {editingStudent ? 'Edit Student' : 'Register New Student'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-[#737373] hover:text-[#0a0a0a]">
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleStudentSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#e7000b] text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#e7000b]" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  required
                  className="w-full px-3.5 py-2.5 ui-input text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Phone Number (Primary Identifier)
                </label>
                <input
                  type="tel"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  required
                  className="w-full px-3.5 py-2.5 ui-input text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Enroll in Classes
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5]">
                  {classes.map((cls) => {
                    const isChecked = studentForm.classIds.includes(cls.id);
                    return (
                      <label key={cls.id} className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-[#0a0a0a]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStudentForm({
                                ...studentForm,
                                classIds: [...studentForm.classIds, cls.id],
                              });
                            } else {
                              setStudentForm({
                                ...studentForm,
                                classIds: studentForm.classIds.filter((id) => id !== cls.id),
                              });
                            }
                          }}
                          className="rounded border-[#e5e5e5] text-[#0a0a0a] focus:ring-[#0a0a0a] w-4 h-4"
                        />
                        <span>{cls.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary !py-2 !px-4 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !studentForm.name.trim() || !studentForm.phone.trim()}
                  className="btn-primary !py-2 !px-4 !text-xs disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingStudent ? 'Save Changes' : 'Register Student'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ui-card w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-[#0a0a0a] shrink-0" />
                <h2 className="text-lg font-bold text-[#0a0a0a]">Bulk Import Students</h2>
              </div>
              <button onClick={() => setImportModalOpen(false)} className="text-[#737373] hover:text-[#0a0a0a]">
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleFileImport} className="space-y-4">
              {importError && (
                <div className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#e7000b] text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#e7000b]" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Select Excel / CSV File (.xlsx, .xls, .csv)
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  required
                  className="w-full text-xs text-[#737373] file:mr-3 file:py-1.5 file:px-3 file:rounded-[18px] file:border-0 file:text-xs file:font-semibold file:bg-[#f5f5f5] file:text-[#0a0a0a] hover:file:bg-[#e5e5e5] cursor-pointer"
                />
                <p className="text-[11px] text-[#737373]">
                  File columns can contain <strong>Email Address</strong>, <strong>full name</strong>, and <strong>Phone number</strong> headers. Duplicate/existing students are automatically enrolled without being skipped.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Enroll Imported Students in Class (Optional)
                </label>
                <select
                  value={selectedImportClassId}
                  onChange={(e) => setSelectedImportClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 ui-input text-xs font-medium cursor-pointer"
                >
                  <option value="">No automatic class enrollment</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {importSummary && (
                <div className="p-3.5 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5] space-y-2 text-xs text-[#0a0a0a]">
                  <h4 className="font-semibold text-[#0a0a0a]">Import Result Summary</h4>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 bg-[#ffffff] rounded-[10px] border border-[#e5e5e5]">
                      <span className="block text-[10px] text-[#737373]">Imported</span>
                      <span className="font-bold text-[#0a0a0a] text-xs">{importSummary.importedCount}</span>
                    </div>
                    <div className="p-2 bg-[#ffffff] rounded-[10px] border border-[#e5e5e5]">
                      <span className="block text-[10px] text-[#737373]">Duplicates</span>
                      <span className="font-bold text-[#737373] text-xs">{importSummary.duplicateCount}</span>
                    </div>
                    <div className="p-2 bg-[#ffffff] rounded-[10px] border border-[#e5e5e5]">
                      <span className="block text-[10px] text-[#737373]">Invalid</span>
                      <span className="font-bold text-[#e7000b] text-xs">{importSummary.invalidCount}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="btn-secondary !py-2 !px-4 !text-xs"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="btn-primary !py-2 !px-4 !text-xs disabled:opacity-40"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Upload & Process</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
