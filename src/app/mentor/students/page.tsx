'use client';

import { useState, useEffect } from 'react';
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
  BookOpen,
} from 'lucide-react';
import { fetchWithCache, invalidateCache } from '@/lib/cache/client-cache';

export default function StudentManagementPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
    if (forceFresh) {
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

      // Classes dropdown list
      const classData = await fetchWithCache('/api/classes', 30 * 1000);
      if (classData && classData.success) {
        setClasses(classData.classes);
      }

      // If no class filter is selected, do NOT fetch all students
      if (!selectedClassFilter) {
        setStudents([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Fetch students for the selected class ONLY
      const studUrl = `/api/students?classId=${selectedClassFilter}`;
      const studData = forceFresh
        ? await fetch(studUrl).then((r) => r.json())
        : await fetchWithCache(studUrl, 20 * 1000);

      if (studData && studData.success) {
        setStudents(studData.students);
      }
    } catch (err) {
      console.error(err);
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

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search);
    return matchesSearch;
  });

  const selectedClassName = classes.find((c) => String(c.id) === selectedClassFilter)?.name;

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
              Manage registered students, phone numbers, and subject class enrollments.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
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
          <div className="flex items-center space-x-2 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#0a0a0a] text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-[#0a0a0a] shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Filters & Search Toolbar */}
        <div className="ui-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 w-full sm:w-auto flex-1 ml-1">
            <Search className="w-4 h-4 text-[#737373] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name or phone..."
              disabled={!selectedClassFilter}
              className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-sm focus:outline-none font-medium disabled:opacity-40"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider whitespace-nowrap">Select Class:</span>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3 py-1.5 ui-input text-xs font-semibold text-[#0a0a0a] cursor-pointer"
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

        {/* Main Content Area */}
        {!selectedClassFilter ? (
          /* Empty state: No class selected */
          <div className="ui-card p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#fafafa] border border-[#e5e5e5] flex items-center justify-center mx-auto text-[#737373]">
              <BookOpen className="w-6 h-6 shrink-0 text-[#0a0a0a]" />
            </div>
            <h3 className="text-lg font-bold text-[#0a0a0a]">Select a Class</h3>
            <p className="text-xs text-[#737373] max-w-sm mx-auto leading-relaxed">
              Please choose a class from the dropdown above to view its enrolled students.
            </p>
          </div>
        ) : loading ? (
          /* Loading state */
          <div className="py-12 text-center text-[#737373] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm">Loading enrolled students...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          /* Empty state: Class selected but zero students */
          <div className="ui-card p-12 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-[#737373] mx-auto shrink-0" />
            <p className="text-sm font-semibold text-[#0a0a0a]">No students enrolled in {selectedClassName}.</p>
            <p className="text-xs text-[#737373]">Click "Register Student" or "Import Excel" to add students to this class.</p>
          </div>
        ) : (
          /* Students Table */
          <div className="ui-card overflow-hidden">
            <div className="px-5 py-3 bg-[#fafafa] border-b border-[#e5e5e5] flex items-center justify-between">
              <span className="text-xs font-bold text-[#0a0a0a] uppercase tracking-wider">
                {selectedClassName} — Enrolled Students ({filteredStudents.length})
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#ffffff] border-b border-[#e5e5e5] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  <tr>
                    <th className="py-3 px-5">Student Name</th>
                    <th className="py-3 px-5">Phone Number</th>
                    <th className="py-3 px-5">Enrolled Classes</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5] text-sm">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-[#fafafa] transition">
                      <td className="py-3.5 px-5 font-semibold text-[#0a0a0a]">
                        {student.name}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-[#737373]">
                        {student.phone}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap gap-1">
                          {student.classes && student.classes.length > 0 ? (
                            student.classes.map((cls: any) => (
                              <span
                                key={cls.id}
                                className="badge-soft"
                              >
                                {cls.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#737373] italic">Not enrolled</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-1">
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-1 rounded-[18px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
                          title="Edit Student"
                        >
                          <Edit2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <button
                          onClick={() => handleDelete(student.id, student.name)}
                          className="p-1 rounded-[18px] text-[#737373] hover:text-[#e7000b] hover:bg-[#f5f5f5]"
                          title="Delete Student"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
