'use client';

import { useState, useEffect, useMemo } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Users,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Calendar,
  Award,
  Download,
  X,
  Check,
  Eye,
  ArrowUpDown,
  Filter,
  BookOpen,
} from 'lucide-react';
import { fetchWithCache, invalidateCache } from '@/lib/cache/client-cache';
import * as XLSX from 'xlsx';

/** Returns current date in IST as "YYYY-MM-DD" */
function getISTDateStr() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  return istDate.toISOString().split('T')[0];
}

interface TestItem {
  id: number;
  classId: number;
  className: string;
  title: string;
  testDate: string;
  maxMarks: number;
  enrolledCount: number;
  gradedCount: number;
  absentCount: number;
  averageMarks: number | null;
  averagePercentage: number | null;
  highestMarks: number | null;
  lowestMarks: number | null;
  highestScorers?: string[];
  createdAt: string;
}

interface StudentMarkRow {
  studentId: number;
  studentName: string;
  studentPhone: string;
  markId: number | null;
  marksObtained: number | null | '';
  isAbsent: boolean;
  notes: string | null;
  percentage: number | null;
}

export default function MentorTestsPage() {
  const [mentor, setMentor] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [notification, setNotification] = useState('');

  // Create / Edit Test Modal State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<TestItem | null>(null);
  const [formClassId, setFormClassId] = useState<string>('');
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(getISTDateStr());
  const [formMaxMarks, setFormMaxMarks] = useState<string>('50');
  const [savingTest, setSavingTest] = useState(false);
  const [testError, setTestError] = useState('');

  // Edit Marks Modal State
  const [marksModalOpen, setMarksModalOpen] = useState(false);
  const [activeTest, setActiveTest] = useState<TestItem | null>(null);
  const [studentMarks, setStudentMarks] = useState<StudentMarkRow[]>([]);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);
  const [marksSearch, setMarksSearch] = useState('');
  const [marksError, setMarksError] = useState('');

  // View Marks / Results Modal State
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewTest, setViewTest] = useState<TestItem | null>(null);
  const [viewStudentMarks, setViewStudentMarks] = useState<StudentMarkRow[]>([]);
  const [loadingView, setLoadingView] = useState(false);
  const [viewSortBy, setViewSortBy] = useState<'highest' | 'lowest' | 'name' | 'default'>('default');
  const [viewStatusFilter, setViewStatusFilter] = useState<'all' | 'present' | 'absent' | 'pending'>('all');
  const [viewSearch, setViewSearch] = useState('');

  const loadData = async (forceFresh = false) => {
    if (forceFresh) {
      invalidateCache('/api/tests');
    }
    if (tests.length === 0) setLoading(true);

    try {
      // 1. Mentor profile
      const meData = await fetchWithCache('/api/mentor/me', 60 * 1000);
      if (!meData || !meData.authenticated) {
        window.location.href = '/mentor/login';
        return;
      }
      setMentor(meData.mentor);

      // 2. Classes dropdown
      const classData = await fetchWithCache('/api/classes', 30 * 1000);
      if (classData && classData.success) {
        setClasses(classData.classes);
      }

      // 3. Tests list
      const testUrl = selectedClassFilter
        ? `/api/tests?classId=${selectedClassFilter}`
        : '/api/tests';

      const testRes = forceFresh
        ? await fetch(testUrl).then((r) => r.json())
        : await fetchWithCache(testUrl, 15 * 1000);

      if (testRes && testRes.success) {
        setTests(testRes.tests || []);
      }
    } catch (err) {
      console.error('Error loading tests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClassFilter]);

  // Compute test counts per class
  const classTestStats = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of tests) {
      map.set(t.classId, (map.get(t.classId) || 0) + 1);
    }
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      testCount: map.get(c.id) || 0,
      studentCount: c.studentCount || 0,
    }));
  }, [classes, tests]);

  // Open Create Test Modal
  const openCreateTestModal = () => {
    setEditingTest(null);
    setFormClassId(selectedClassFilter || (classes[0]?.id ? String(classes[0].id) : ''));
    setFormTitle('');
    setFormDate(getISTDateStr());
    setFormMaxMarks('50');
    setTestError('');
    setTestModalOpen(true);
  };

  // Open Edit Test Metadata Modal
  const openEditTestModal = (test: TestItem) => {
    setEditingTest(test);
    setFormClassId(String(test.classId));
    setFormTitle(test.title);
    setFormDate(test.testDate);
    setFormMaxMarks(String(test.maxMarks));
    setTestError('');
    setTestModalOpen(true);
  };

  // Handle Save Test (Create or Update)
  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formClassId || !formDate || !formMaxMarks || savingTest) return;

    const maxMarksNum = parseInt(formMaxMarks, 10);
    if (isNaN(maxMarksNum) || maxMarksNum <= 0) {
      setTestError('Maximum marks must be a positive number.');
      return;
    }

    setSavingTest(true);
    setTestError('');

    try {
      const url = editingTest ? `/api/tests/${editingTest.id}` : '/api/tests';
      const method = editingTest ? 'PUT' : 'POST';

      const payload: any = {
        title: formTitle.trim(),
        testDate: formDate,
        maxMarks: maxMarksNum,
      };

      if (!editingTest) {
        payload.classId = parseInt(formClassId, 10);
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTestModalOpen(false);
        setNotification(editingTest ? 'Test updated successfully!' : 'Test created successfully!');
        setTimeout(() => setNotification(''), 4000);
        loadData(true);
      } else {
        setTestError(data.message || 'Failed to save test.');
      }
    } catch {
      setTestError('An error occurred. Please try again.');
    } finally {
      setSavingTest(false);
    }
  };

  // Handle Delete Test
  const handleDeleteTest = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete test "${title}"? All student marks recorded for this test will be permanently deleted.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/tests/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Test "${title}" deleted.`);
        setTimeout(() => setNotification(''), 4000);
        loadData(true);
      } else {
        alert(data.message || 'Failed to delete test.');
      }
    } catch {
      alert('Failed to delete test.');
    }
  };

  // Open Marks Editor Modal for a specific Test
  const openMarksManager = async (test: TestItem) => {
    setActiveTest(test);
    setMarksSearch('');
    setMarksError('');
    setLoadingMarks(true);
    setMarksModalOpen(true);

    try {
      const res = await fetch(`/api/tests/${test.id}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setActiveTest(data.test);
        setStudentMarks(
          (data.students || []).map((s: any) => ({
            studentId: s.studentId,
            studentName: s.studentName,
            studentPhone: s.studentPhone,
            markId: s.markId,
            marksObtained: s.marksObtained !== null && s.marksObtained !== undefined ? s.marksObtained : '',
            isAbsent: Boolean(s.isAbsent),
            notes: s.notes || '',
            percentage: s.percentage,
          }))
        );
      } else {
        setMarksError(data.message || 'Failed to load student marks.');
      }
    } catch {
      setMarksError('Failed to fetch marks.');
    } finally {
      setLoadingMarks(false);
    }
  };

  // Open View Marks / Results Modal
  const openViewMarksModal = async (test: TestItem) => {
    setViewTest(test);
    setViewSortBy('default');
    setViewStatusFilter('all');
    setViewSearch('');
    setLoadingView(true);
    setViewModalOpen(true);

    try {
      const res = await fetch(`/api/tests/${test.id}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setViewTest(data.test);
        setViewStudentMarks(
          (data.students || []).map((s: any) => ({
            studentId: s.studentId,
            studentName: s.studentName,
            studentPhone: s.studentPhone,
            markId: s.markId,
            marksObtained: s.marksObtained !== null && s.marksObtained !== undefined ? s.marksObtained : '',
            isAbsent: Boolean(s.isAbsent),
            notes: s.notes || '',
            percentage: s.percentage,
          }))
        );
      } else {
        alert(data.message || 'Failed to load test results.');
      }
    } catch {
      alert('Failed to fetch test results.');
    } finally {
      setLoadingView(false);
    }
  };

  // Update student mark in local state
  const handleMarkChange = (studentId: number, val: string) => {
    if (!activeTest) return;

    setStudentMarks((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;

        if (val === '') {
          return { ...s, marksObtained: '', percentage: null };
        }

        const numVal = parseInt(val, 10);
        if (isNaN(numVal)) return s;

        const validNum = Math.max(0, Math.min(activeTest.maxMarks, numVal));
        const pct = activeTest.maxMarks > 0 ? Math.round((validNum / activeTest.maxMarks) * 1000) / 10 : null;

        return {
          ...s,
          marksObtained: validNum,
          isAbsent: false,
          percentage: pct,
        };
      })
    );
  };

  // Toggle student absent status
  const handleAbsentToggle = (studentId: number) => {
    setStudentMarks((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
        const nextAbsent = !s.isAbsent;
        return {
          ...s,
          isAbsent: nextAbsent,
          marksObtained: nextAbsent ? '' : s.marksObtained,
          percentage: nextAbsent ? null : s.percentage,
        };
      })
    );
  };

  // Save student marks and AUTO-CLOSE the modal
  const handleSaveMarks = async () => {
    if (!activeTest || savingMarks) return;

    setSavingMarks(true);
    setMarksError('');

    try {
      const payloadMarks = studentMarks.map((s) => ({
        studentId: s.studentId,
        marksObtained: s.isAbsent || s.marksObtained === '' ? null : Number(s.marksObtained),
        isAbsent: s.isAbsent,
        notes: s.notes ? s.notes.trim() : null,
      }));

      const res = await fetch(`/api/tests/${activeTest.id}/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marks: payloadMarks }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Close modal automatically after save
        setMarksModalOpen(false);
        setNotification(`Marks for "${activeTest.title}" saved successfully!`);
        setTimeout(() => setNotification(''), 4000);
        loadData(true);
      } else {
        setMarksError(data.message || 'Failed to save marks.');
      }
    } catch {
      setMarksError('An error occurred while saving marks.');
    } finally {
      setSavingMarks(false);
    }
  };

  // Export marks for a test to Excel (.xlsx)
  const handleExportTestMarks = (test: TestItem, marksData?: StudentMarkRow[]) => {
    const filename = `${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_Marks_${test.testDate}.xlsx`;

    const prepareAndDownload = (rows: any[]) => {
      const exportData = rows.map((r, index) => ({
        '#': index + 1,
        'Student Name': r.studentName,
        'Phone Number': r.studentPhone,
        'Class': test.className,
        'Test Title': test.title,
        'Test Date': test.testDate,
        'Max Marks': test.maxMarks,
        'Marks Obtained': r.isAbsent ? 'ABSENT' : r.marksObtained !== '' && r.marksObtained !== null ? r.marksObtained : 'NOT ENTERED',
        'Percentage': r.isAbsent ? 'ABSENT' : r.marksObtained !== '' && r.marksObtained !== null ? `${r.percentage ?? Math.round((Number(r.marksObtained) / test.maxMarks) * 100)}%` : '-',
        'Status': r.isAbsent ? 'Absent' : r.marksObtained !== '' && r.marksObtained !== null ? 'Present & Scored' : 'Pending',
        'Remarks': r.notes || '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Marks');
      XLSX.writeFile(wb, filename);
    };

    if (marksData && marksData.length > 0) {
      prepareAndDownload(marksData);
    } else {
      fetch(`/api/tests/${test.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.students) {
            prepareAndDownload(data.students);
          } else {
            alert('Failed to export test marks.');
          }
        })
        .catch(() => alert('Export failed.'));
    }
  };

  // Filter tests list
  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.className.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [tests, search]);

  // Filter student rows in Marks Modal
  const filteredStudentMarks = useMemo(() => {
    if (!marksSearch.trim()) return studentMarks;
    const q = marksSearch.toLowerCase();
    return studentMarks.filter(
      (s) => s.studentName.toLowerCase().includes(q) || s.studentPhone.includes(q)
    );
  }, [studentMarks, marksSearch]);

  // Filter and sort students in View Results Modal
  const filteredAndSortedViewMarks = useMemo(() => {
    let list = [...viewStudentMarks];

    // 1. Search
    if (viewSearch.trim()) {
      const q = viewSearch.toLowerCase();
      list = list.filter(
        (s) => s.studentName.toLowerCase().includes(q) || s.studentPhone.includes(q)
      );
    }

    // 2. Status filter
    if (viewStatusFilter === 'present') {
      list = list.filter((s) => !s.isAbsent && s.marksObtained !== '' && s.marksObtained !== null);
    } else if (viewStatusFilter === 'absent') {
      list = list.filter((s) => s.isAbsent);
    } else if (viewStatusFilter === 'pending') {
      list = list.filter((s) => !s.isAbsent && (s.marksObtained === '' || s.marksObtained === null));
    }

    // 3. Sorting
    if (viewSortBy === 'highest') {
      list.sort((a, b) => {
        const valA = a.isAbsent || a.marksObtained === '' || a.marksObtained === null ? -1 : Number(a.marksObtained);
        const valB = b.isAbsent || b.marksObtained === '' || b.marksObtained === null ? -1 : Number(b.marksObtained);
        return valB - valA;
      });
    } else if (viewSortBy === 'lowest') {
      list.sort((a, b) => {
        const valA = a.isAbsent || a.marksObtained === '' || a.marksObtained === null ? 999999 : Number(a.marksObtained);
        const valB = b.isAbsent || b.marksObtained === '' || b.marksObtained === null ? 999999 : Number(b.marksObtained);
        return valA - valB;
      });
    } else if (viewSortBy === 'name') {
      list.sort((a, b) => a.studentName.localeCompare(b.studentName));
    }

    return list;
  }, [viewStudentMarks, viewSearch, viewStatusFilter, viewSortBy]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col">
      <MentorNavbar mentorName={mentor?.name} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">
              Class Tests & Marks
            </h1>
            <p className="text-sm text-[#737373]">
              Schedule class tests, record student marks, and view detailed student results.
            </p>
          </div>

          <button
            onClick={openCreateTestModal}
            className="btn-primary shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Create New Test</span>
          </button>
        </div>

        {/* Toast Alert */}
        {notification && (
          <div className="flex items-center space-x-2 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#0a0a0a] text-xs font-semibold shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-[#0a0a0a] shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CLASS TEST STATS CARDS (Shows each class and total tests count)           */}
        {/* ========================================================================= */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">
              Classes & Tests Overview
            </span>
            {selectedClassFilter && (
              <button
                onClick={() => setSelectedClassFilter('')}
                className="text-xs font-semibold text-[#0a0a0a] hover:underline"
              >
                Clear Filter (Show All)
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* Individual Class Cards */}
            {classTestStats.map((cls) => {
              const isSelected = selectedClassFilter === String(cls.id);
              return (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClassFilter(isSelected ? '' : String(cls.id))}
                  className={`p-4 ui-card cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#0a0a0a] bg-[#fafafa] ring-1 ring-[#0a0a0a]'
                      : 'hover:border-[#737373]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0a0a0a] truncate" title={cls.name}>
                      {cls.name}
                    </span>
                    <GraduationCap className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-[#0a0a0a]">{cls.testCount}</span>
                    <span className="text-[11px] text-[#737373] font-medium">
                      {cls.testCount === 1 ? 'Test' : 'Tests'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="ui-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 w-full sm:w-auto flex-1 ml-1">
            <Search className="w-4 h-4 text-[#737373] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tests by title or class name..."
              className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-sm focus:outline-none font-medium"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider whitespace-nowrap">Filter Class:</span>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
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

        {/* Tests List / Cards Grid */}
        {loading ? (
          <div className="py-12 text-center text-[#737373] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm">Loading tests...</p>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="ui-card p-12 text-center space-y-3">
            <GraduationCap className="w-8 h-8 text-[#737373] mx-auto shrink-0" />
            <h3 className="text-base font-bold text-[#0a0a0a]">No tests found</h3>
            <p className="text-xs text-[#737373] max-w-sm mx-auto">
              {search || selectedClassFilter
                ? 'Try adjusting your search or class filter.'
                : 'Click "Create New Test" to schedule your first classroom test or mock.'}
            </p>
            {!search && !selectedClassFilter && (
              <button
                onClick={openCreateTestModal}
                className="btn-primary !py-1.5 !px-3.5 !text-xs mt-2"
              >
                Create Test
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTests.map((test) => {
              const submissionRate =
                test.enrolledCount > 0
                  ? Math.round(((test.gradedCount + test.absentCount) / test.enrolledCount) * 100)
                  : 0;

              return (
                <div
                  key={test.id}
                  className="ui-card p-5 flex flex-col justify-between space-y-4 hover:border-[#737373] transition-all"
                >
                  {/* Top Bar: Class Badge & Action Buttons */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="badge-solid text-[11px]">
                        {test.className}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleExportTestMarks(test)}
                          className="p-1 rounded-[18px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
                          title="Export Marks to Excel"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <button
                          onClick={() => openEditTestModal(test)}
                          className="p-1 rounded-[18px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
                          title="Edit Test Details"
                        >
                          <Edit2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <button
                          onClick={() => handleDeleteTest(test.id, test.title)}
                          className="p-1 rounded-[18px] text-[#737373] hover:text-[#e7000b] hover:bg-[#f5f5f5]"
                          title="Delete Test"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#0a0a0a] line-clamp-1">
                        {test.title}
                      </h3>
                      <div className="flex items-center space-x-3 text-xs text-[#737373] mt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{test.testDate}</span>
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-[#0a0a0a]">
                          Max Marks: {test.maxMarks}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submission Progress / Recorded Marks Status */}
                  <div className="space-y-2 py-2 px-3 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5]">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="text-[#737373]">
                        Marks Entered: <strong className="text-[#0a0a0a] font-bold">{test.gradedCount}</strong> / {test.enrolledCount}
                      </span>
                      {test.absentCount > 0 && (
                        <span className="badge-soft text-[#e7000b] border-[#fecaca] bg-[#fef2f2] text-[10px]">
                          {test.absentCount} Absent
                        </span>
                      )}
                    </div>
                    <div className="w-full h-1.5 bg-[#e5e5e5] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0a0a0a] rounded-full transition-all duration-500"
                        style={{ width: `${submissionRate}%` }}
                      />
                    </div>
                  </div>

                  {/* TWO ACTION BUTTONS: View Results & Edit Marks */}
                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openViewMarksModal(test)}
                      className="btn-secondary !py-2 !text-xs !rounded-[18px]"
                    >
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span>View Results</span>
                    </button>

                    <button
                      onClick={() => openMarksManager(test)}
                      className="btn-primary !py-2 !text-xs !rounded-[18px]"
                    >
                      <Edit2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{test.gradedCount > 0 ? 'Edit Marks' : 'Enter Marks'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* VIEW RESULTS / MARKS MODAL (Sorted Highest/Lowest, Filter Absent)        */}
      {/* ========================================================================= */}
      {viewModalOpen && viewTest && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="ui-card w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e5e5e5] bg-[#ffffff] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="badge-solid text-[10px]">{viewTest.className}</span>
                  <span className="text-xs text-[#737373]">📅 {viewTest.testDate}</span>
                  <span className="badge-soft text-[10px]">Max Marks: {viewTest.maxMarks}</span>
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">{viewTest.title} — Student Results</h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExportTestMarks(viewTest, viewStudentMarks)}
                  className="btn-secondary !py-1.5 !px-3 !text-xs"
                  title="Download marks spreadsheet"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={() => {
                    setViewModalOpen(false);
                    openMarksManager(viewTest);
                  }}
                  className="btn-primary !py-1.5 !px-3 !text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Edit Marks</span>
                </button>
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="p-1.5 rounded-[10px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
                >
                  <X className="w-5 h-5 shrink-0" />
                </button>
              </div>
            </div>

            {/* Filter & Sort Controls Toolbar */}
            <div className="px-6 py-3 bg-[#fafafa] border-b border-[#e5e5e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              {/* Search Bar */}
              <div className="flex items-center space-x-2 flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                <input
                  type="text"
                  value={viewSearch}
                  onChange={(e) => setViewSearch(e.target.value)}
                  placeholder="Search student..."
                  className="w-full text-xs bg-transparent border-none focus:outline-none placeholder-[#737373] font-medium"
                />
              </div>

              {/* Sorting & Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Sort Dropdown */}
                <div className="flex items-center space-x-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                  <select
                    value={viewSortBy}
                    onChange={(e: any) => setViewSortBy(e.target.value)}
                    className="px-2.5 py-1 ui-input text-xs font-semibold cursor-pointer"
                  >
                    <option value="default">Default Order</option>
                    <option value="highest">Highest to Lowest</option>
                    <option value="lowest">Lowest to Highest</option>
                    <option value="name">Student Name (A-Z)</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center space-x-1">
                  <Filter className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                  <select
                    value={viewStatusFilter}
                    onChange={(e: any) => setViewStatusFilter(e.target.value)}
                    className="px-2.5 py-1 ui-input text-xs font-semibold cursor-pointer"
                  >
                    <option value="all">All Students</option>
                    <option value="present">Only Present / Scored</option>
                    <option value="absent">Only Absent</option>
                    <option value="pending">Only Unmarked</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Students Table */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {loadingView ? (
                <div className="py-16 text-center text-[#737373] space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0a0a0a]" />
                  <p className="text-sm">Loading student results...</p>
                </div>
              ) : filteredAndSortedViewMarks.length === 0 ? (
                <div className="py-12 text-center text-[#737373] space-y-2">
                  <Users className="w-6 h-6 mx-auto text-[#737373]" />
                  <p className="text-sm">
                    {viewStudentMarks.length === 0
                      ? 'No students enrolled in this class.'
                      : 'No student matches the current search / filter.'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fafafa] border-b border-[#e5e5e5] text-[11px] font-semibold uppercase tracking-wider text-[#737373] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4 w-32 text-center">Marks Obtained</th>
                      <th className="py-2.5 px-3 w-28 text-center">Percentage</th>
                      <th className="py-2.5 px-3 w-28 text-center">Status</th>
                      <th className="py-2.5 px-4">Remarks / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e5e5] text-sm">
                    {filteredAndSortedViewMarks.map((s, idx) => {
                      const isEntered = s.marksObtained !== '' && s.marksObtained !== null;
                      const markNum = isEntered ? Number(s.marksObtained) : 0;
                      const pct = s.isAbsent ? null : isEntered && viewTest.maxMarks > 0 ? Math.round((markNum / viewTest.maxMarks) * 100) : null;

                      return (
                        <tr key={s.studentId} className={`hover:bg-[#fafafa] transition ${s.isAbsent ? 'bg-[#fafafa]/50 opacity-70' : ''}`}>
                          <td className="py-3 px-3 text-center font-mono text-xs text-[#737373]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#0a0a0a] text-xs sm:text-sm">{s.studentName}</p>
                            <p className="text-[11px] font-mono text-[#737373]">{s.studentPhone}</p>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-sm">
                            {s.isAbsent ? (
                              <span className="text-[#e7000b] text-xs">ABSENT</span>
                            ) : isEntered ? (
                              <span className="text-[#0a0a0a]">{s.marksObtained} <span className="text-xs text-[#737373] font-normal">/ {viewTest.maxMarks}</span></span>
                            ) : (
                              <span className="text-[#737373] text-xs italic">Not Entered</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {s.isAbsent ? (
                              <span className="text-xs text-[#737373]">–</span>
                            ) : pct !== null ? (
                              <span
                                className={`badge-soft font-bold text-[11px] ${
                                  pct >= 75
                                    ? 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]'
                                    : pct >= 50
                                    ? 'bg-[#fefce8] text-[#ca8a04] border-[#fef08a]'
                                    : 'bg-[#fef2f2] text-[#e7000b] border-[#fecaca]'
                                }`}
                              >
                                {pct}%
                              </span>
                            ) : (
                              <span className="text-xs text-[#737373]">–</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {s.isAbsent ? (
                              <span className="badge-soft text-[#e7000b] border-[#fecaca] bg-[#fef2f2] text-[10px]">
                                Absent
                              </span>
                            ) : isEntered ? (
                              <span className="badge-soft text-[#16a34a] border-[#bbf7d0] bg-[#f0fdf4] text-[10px]">
                                Present
                              </span>
                            ) : (
                              <span className="badge-soft text-[#737373] text-[10px]">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#737373]">
                            {s.notes || <span className="italic text-[#a3a3a3]">No remarks</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-[#fafafa] border-t border-[#e5e5e5] flex items-center justify-between shrink-0">
              <span className="text-xs text-[#737373]">
                Showing <strong>{filteredAndSortedViewMarks.length}</strong> of {viewStudentMarks.length} students
              </span>
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="btn-secondary !py-1.5 !px-4 !text-xs"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT TEST METADATA MODAL                                         */}
      {/* ========================================================================= */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ui-card w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-[#0a0a0a] shrink-0" />
                <h2 className="text-lg font-bold text-[#0a0a0a]">
                  {editingTest ? 'Edit Test Details' : 'Create New Test'}
                </h2>
              </div>
              <button
                onClick={() => setTestModalOpen(false)}
                className="p-1 rounded-[10px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleSaveTest} className="space-y-4">
              {testError && (
                <div className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#e7000b] text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#e7000b]" />
                  <span>{testError}</span>
                </div>
              )}

              {/* Class Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Target Classroom <span className="text-[#e7000b]">*</span>
                </label>
                <select
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
                  disabled={Boolean(editingTest)}
                  required
                  className="w-full px-3.5 py-2.5 ui-input text-sm font-medium cursor-pointer disabled:opacity-60"
                >
                  <option value="">-- Select Class --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Test Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Test Title <span className="text-[#e7000b]">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Mock Test 1, DAX & Power Query Assessment"
                  required
                  className="w-full px-3.5 py-2.5 ui-input text-sm font-medium"
                />
              </div>

              {/* Date & Max Marks Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                    Date <span className="text-[#e7000b]">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 ui-input text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                    Maximum Marks <span className="text-[#e7000b]">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formMaxMarks}
                    onChange={(e) => setFormMaxMarks(e.target.value)}
                    required
                    className="w-full px-3 py-2 ui-input text-sm font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="btn-secondary !py-2 !px-4 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTest || !formTitle.trim() || !formClassId}
                  className="btn-primary !py-2 !px-4 !text-xs disabled:opacity-40"
                >
                  {savingTest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingTest ? 'Save Changes' : 'Create Test'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MARKS ENTRY / EDIT MODAL (With Auto-Close on Save)                       */}
      {/* ========================================================================= */}
      {marksModalOpen && activeTest && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="ui-card w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e5e5e5] bg-[#ffffff] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="badge-solid text-[10px]">{activeTest.className}</span>
                  <span className="text-xs text-[#737373]">📅 {activeTest.testDate}</span>
                  <span className="badge-soft text-[10px]">Max Marks: {activeTest.maxMarks}</span>
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">Enter / Edit Marks: {activeTest.title}</h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setMarksModalOpen(false)}
                  className="p-1.5 rounded-[10px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
                >
                  <X className="w-5 h-5 shrink-0" />
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {marksError && (
              <div className="mx-6 mt-3 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#e7000b] text-xs font-medium flex items-center space-x-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#e7000b]" />
                <span>{marksError}</span>
              </div>
            )}

            {/* Search Filter for Student Table */}
            <div className="px-6 py-2.5 border-b border-[#e5e5e5] flex items-center justify-between gap-3 shrink-0 bg-[#fafafa]">
              <div className="flex items-center space-x-2 flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                <input
                  type="text"
                  value={marksSearch}
                  onChange={(e) => setMarksSearch(e.target.value)}
                  placeholder="Filter student in this test..."
                  className="w-full text-xs bg-transparent border-none focus:outline-none placeholder-[#737373]"
                />
              </div>
              <div className="text-xs text-[#737373]">
                {filteredStudentMarks.length} students enrolled
              </div>
            </div>

            {/* Students Table */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {loadingMarks ? (
                <div className="py-16 text-center text-[#737373] space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0a0a0a]" />
                  <p className="text-sm">Loading student list...</p>
                </div>
              ) : filteredStudentMarks.length === 0 ? (
                <div className="py-12 text-center text-[#737373] space-y-2">
                  <Users className="w-6 h-6 mx-auto text-[#737373]" />
                  <p className="text-sm">
                    {studentMarks.length === 0
                      ? 'No students are currently enrolled in this class.'
                      : 'No student matches your search.'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fafafa] border-b border-[#e5e5e5] text-[11px] font-semibold uppercase tracking-wider text-[#737373] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4 w-40 text-center">
                        Marks <span className="lowercase font-normal">(/ {activeTest.maxMarks})</span>
                      </th>
                      <th className="py-2.5 px-3 w-28 text-center">Absent</th>
                      <th className="py-2.5 px-4 w-28 text-center">Percentage</th>
                      <th className="py-2.5 px-4">Notes (Optional)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e5e5] text-sm">
                    {filteredStudentMarks.map((s, idx) => {
                      const isEntered = s.marksObtained !== '' && s.marksObtained !== null;
                      const markNum = isEntered ? Number(s.marksObtained) : 0;
                      const pct = s.isAbsent ? null : isEntered && activeTest.maxMarks > 0 ? Math.round((markNum / activeTest.maxMarks) * 100) : null;

                      return (
                        <tr key={s.studentId} className={`hover:bg-[#fafafa] transition ${s.isAbsent ? 'bg-[#fafafa]/50 opacity-70' : ''}`}>
                          <td className="py-3 px-3 text-center font-mono text-xs text-[#737373]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#0a0a0a] text-xs sm:text-sm">{s.studentName}</p>
                            <p className="text-[11px] font-mono text-[#737373]">{s.studentPhone}</p>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={activeTest.maxMarks}
                              value={s.isAbsent ? '' : (s.marksObtained ?? '')}
                              disabled={s.isAbsent}
                              onChange={(e) => handleMarkChange(s.studentId, e.target.value)}
                              placeholder={s.isAbsent ? 'ABSENT' : '–'}
                              className="w-24 px-2.5 py-1.5 ui-input text-center text-sm font-bold disabled:bg-[#e5e5e5] disabled:cursor-not-allowed mx-auto"
                            />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <label className="inline-flex items-center space-x-1.5 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={s.isAbsent}
                                onChange={() => handleAbsentToggle(s.studentId)}
                                className="w-4 h-4 rounded border-[#e5e5e5] text-[#0a0a0a] focus:ring-[#0a0a0a]"
                              />
                              <span className="text-[11px] text-[#737373]">Absent</span>
                            </label>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {s.isAbsent ? (
                              <span className="badge-soft text-[#e7000b] border-[#fecaca] bg-[#fef2f2] text-[10px]">
                                Absent
                              </span>
                            ) : pct !== null ? (
                              <span
                                className={`badge-soft font-bold text-[11px] ${
                                  pct >= 75
                                    ? 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]'
                                    : pct >= 50
                                    ? 'bg-[#fefce8] text-[#ca8a04] border-[#fef08a]'
                                    : 'bg-[#fef2f2] text-[#e7000b] border-[#fecaca]'
                                }`}
                              >
                                {pct}%
                              </span>
                            ) : (
                              <span className="text-xs text-[#737373]">–</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={s.notes || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStudentMarks((prev) =>
                                  prev.map((item) =>
                                    item.studentId === s.studentId ? { ...item, notes: val } : item
                                  )
                                );
                              }}
                              placeholder="Feedback / Remarks"
                              className="w-full px-2.5 py-1 ui-input text-xs"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#fafafa] border-t border-[#e5e5e5] flex items-center justify-between gap-3 shrink-0">
              <p className="text-xs text-[#737373] hidden sm:block">
                Clicking <strong>Save Student Marks</strong> saves all entries and automatically closes the screen.
              </p>
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setMarksModalOpen(false)}
                  className="btn-secondary !py-2 !px-4 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMarks}
                  disabled={savingMarks || studentMarks.length === 0}
                  className="btn-primary !py-2 !px-5 !text-xs disabled:opacity-40"
                >
                  {savingMarks ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Saving Marks...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>Save Student Marks</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
