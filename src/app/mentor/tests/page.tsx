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
  Download,
  X,
  Check,
  Eye,
  ArrowUpDown,
  Filter,
  FileSpreadsheet,
  AlertTriangle,
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
  classId: number | null;
  className: string;
  classDeleted?: boolean;
  title: string;
  testDate: string;
  maxMarks: number;
  maxMarksM1: number;
  maxMarksM2: number;
  maxMarksMI: number;
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
  marksM1: number | null | '';
  isAbsentM1: boolean;
  marksM2: number | null | '';
  isAbsentM2: boolean;
  marksMI: number | null | '';
  isAbsentMI: boolean;
  marksObtained: number | null | '';
  isAbsent: boolean;
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
  const [formMaxM1, setFormMaxM1] = useState<string>('50');
  const [formMaxM2, setFormMaxM2] = useState<string>('50');
  const [formMaxMI, setFormMaxMI] = useState<string>('50');
  const [savingTest, setSavingTest] = useState(false);
  const [testError, setTestError] = useState('');

  // Edit Marks Modal State (Full-Screen Excel Spreadsheet)
  const [marksModalOpen, setMarksModalOpen] = useState(false);
  const [activeTest, setActiveTest] = useState<TestItem | null>(null);
  const [studentMarks, setStudentMarks] = useState<StudentMarkRow[]>([]);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);
  const [marksSearch, setMarksSearch] = useState('');
  const [marksError, setMarksError] = useState('');

  // View Marks / Results Modal State (Full-Screen Excel Spreadsheet)
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

      // 2. Classes dropdown (only active classes — used for creating new tests)
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

  // Compute test counts per class (including deleted classes via stored className)
  const classTestStats = useMemo(() => {
    const activeClassMap = new Map<number, { id: number; name: string; testCount: number; studentCount: number; isDeleted: boolean }>();
    for (const c of classes) {
      activeClassMap.set(c.id, {
        id: c.id,
        name: c.name,
        testCount: 0,
        studentCount: c.studentCount || 0,
        isDeleted: false,
      });
    }

    const deletedClassNames = new Map<string, number>();
    for (const t of tests) {
      if (t.classId && activeClassMap.has(t.classId)) {
        const cls = activeClassMap.get(t.classId)!;
        cls.testCount += 1;
      } else if (t.classDeleted || !t.classId) {
        deletedClassNames.set(t.className, (deletedClassNames.get(t.className) || 0) + 1);
      }
    }

    const result: { id: number | string; name: string; testCount: number; studentCount: number; isDeleted: boolean }[] = [];
    for (const cls of activeClassMap.values()) {
      result.push(cls);
    }
    for (const [name, count] of deletedClassNames.entries()) {
      result.push({
        id: `deleted-${name}`,
        name,
        testCount: count,
        studentCount: 0,
        isDeleted: true,
      });
    }

    return result;
  }, [classes, tests]);

  // Open Create Test Modal
  const openCreateTestModal = () => {
    setEditingTest(null);
    const initialClassId = selectedClassFilter || (classes[0]?.id ? String(classes[0].id) : '');
    const initialClassName = classes.find((c) => String(c.id) === initialClassId)?.name || 'Batch';
    setFormClassId(initialClassId);
    setFormTitle(`${initialClassName} Evaluation`);
    setFormDate(getISTDateStr());
    setFormMaxM1('50');
    setFormMaxM2('50');
    setFormMaxMI('50');
    setTestError('');
    setTestModalOpen(true);
  };

  // Open Edit Test Metadata Modal
  const openEditTestModal = (test: TestItem) => {
    setEditingTest(test);
    setFormClassId(test.classId ? String(test.classId) : '');
    setFormTitle(test.title);
    setFormDate(test.testDate);
    setFormMaxM1(String(test.maxMarksM1 ?? 50));
    setFormMaxM2(String(test.maxMarksM2 ?? 50));
    setFormMaxMI(String(test.maxMarksMI ?? 50));
    setTestError('');
    setTestModalOpen(true);
  };

  // Handle Save Test (Create or Update)
  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formClassId || !formDate || savingTest) return;

    const m1Num = parseInt(formMaxM1, 10);
    const m2Num = parseInt(formMaxM2, 10);
    const miNum = parseInt(formMaxMI, 10);

    if (isNaN(m1Num) || m1Num <= 0 || isNaN(m2Num) || m2Num <= 0 || isNaN(miNum) || miNum <= 0) {
      setTestError('Maximum marks for Mock 1, Mock 2, and Mock Interview must be positive numbers.');
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
        maxMarksM1: m1Num,
        maxMarksM2: m2Num,
        maxMarksMI: miNum,
        maxMarks: m1Num + m2Num + miNum,
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
            marksM1: s.marksM1 !== null && s.marksM1 !== undefined ? s.marksM1 : '',
            isAbsentM1: Boolean(s.isAbsentM1),
            marksM2: s.marksM2 !== null && s.marksM2 !== undefined ? s.marksM2 : '',
            isAbsentM2: Boolean(s.isAbsentM2),
            marksMI: s.marksMI !== null && s.marksMI !== undefined ? s.marksMI : '',
            isAbsentMI: Boolean(s.isAbsentMI),
            marksObtained: s.marksObtained !== null && s.marksObtained !== undefined ? s.marksObtained : '',
            isAbsent: Boolean(s.isAbsent),
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
            marksM1: s.marksM1 !== null && s.marksM1 !== undefined ? s.marksM1 : '',
            isAbsentM1: Boolean(s.isAbsentM1),
            marksM2: s.marksM2 !== null && s.marksM2 !== undefined ? s.marksM2 : '',
            isAbsentM2: Boolean(s.isAbsentM2),
            marksMI: s.marksMI !== null && s.marksMI !== undefined ? s.marksMI : '',
            isAbsentMI: Boolean(s.isAbsentMI),
            marksObtained: s.marksObtained !== null && s.marksObtained !== undefined ? s.marksObtained : '',
            isAbsent: Boolean(s.isAbsent),
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

  // Helper to recompute total score
  const computeTotalScore = (
    marksM1: number | null | '',
    isAbsentM1: boolean,
    marksM2: number | null | '',
    isAbsentM2: boolean,
    marksMI: number | null | '',
    isAbsentMI: boolean
  ): { total: number | null | ''; isAllAbsent: boolean } => {
    const isAllAbsent = isAbsentM1 && isAbsentM2 && isAbsentMI;
    const hasAnyScore =
      (!isAbsentM1 && marksM1 !== '' && marksM1 !== null) ||
      (!isAbsentM2 && marksM2 !== '' && marksM2 !== null) ||
      (!isAbsentMI && marksMI !== '' && marksMI !== null);

    if (isAllAbsent) return { total: '', isAllAbsent: true };
    if (!hasAnyScore) return { total: '', isAllAbsent: false };

    const score =
      (!isAbsentM1 && marksM1 !== '' && marksM1 !== null ? Number(marksM1) : 0) +
      (!isAbsentM2 && marksM2 !== '' && marksM2 !== null ? Number(marksM2) : 0) +
      (!isAbsentMI && marksMI !== '' && marksMI !== null ? Number(marksMI) : 0);

    return { total: score, isAllAbsent: false };
  };

  // Update student mark in local state for M1, M2, or MI
  const handleMarkChange = (studentId: number, field: 'marksM1' | 'marksM2' | 'marksMI', val: string) => {
    if (!activeTest) return;

    const maxLimit =
      field === 'marksM1'
        ? activeTest.maxMarksM1 ?? 50
        : field === 'marksM2'
        ? activeTest.maxMarksM2 ?? 50
        : activeTest.maxMarksMI ?? 50;

    const absentField = field === 'marksM1' ? 'isAbsentM1' : field === 'marksM2' ? 'isAbsentM2' : 'isAbsentMI';

    setStudentMarks((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;

        let newMarkVal: number | '' = '';
        if (val !== '') {
          const numVal = parseInt(val, 10);
          if (isNaN(numVal)) return s;
          newMarkVal = Math.max(0, Math.min(maxLimit, numVal));
        }

        const updated = {
          ...s,
          [field]: newMarkVal,
          [absentField]: false,
        };

        const { total, isAllAbsent } = computeTotalScore(
          updated.marksM1,
          updated.isAbsentM1,
          updated.marksM2,
          updated.isAbsentM2,
          updated.marksMI,
          updated.isAbsentMI
        );

        return {
          ...updated,
          marksObtained: total,
          isAbsent: isAllAbsent,
        };
      })
    );
  };

  // Toggle student absent status for M1, M2, or MI
  const handleAbsentToggle = (studentId: number, field: 'isAbsentM1' | 'isAbsentM2' | 'isAbsentMI') => {
    const markField = field === 'isAbsentM1' ? 'marksM1' : field === 'isAbsentM2' ? 'marksM2' : 'marksMI';

    setStudentMarks((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
        const nextAbsent = !s[field];

        const updated = {
          ...s,
          [field]: nextAbsent,
          [markField]: nextAbsent ? '' : s[markField],
        };

        const { total, isAllAbsent } = computeTotalScore(
          updated.marksM1,
          updated.isAbsentM1,
          updated.marksM2,
          updated.isAbsentM2,
          updated.marksMI,
          updated.isAbsentMI
        );

        return {
          ...updated,
          marksObtained: total,
          isAbsent: isAllAbsent,
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
        marksM1: s.isAbsentM1 || s.marksM1 === '' ? null : Number(s.marksM1),
        isAbsentM1: s.isAbsentM1,
        marksM2: s.isAbsentM2 || s.marksM2 === '' ? null : Number(s.marksM2),
        isAbsentM2: s.isAbsentM2,
        marksMI: s.isAbsentMI || s.marksMI === '' ? null : Number(s.marksMI),
        isAbsentMI: s.isAbsentMI,
        marksObtained: s.marksObtained === '' ? null : Number(s.marksObtained),
        isAbsent: s.isAbsent,
        notes: null,
      }));

      const res = await fetch(`/api/tests/${activeTest.id}/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marks: payloadMarks }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
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

  // Export marks for a test to Excel (.xlsx) with M1, M2, MI, and Total
  const handleExportTestMarks = (test: TestItem, marksData?: StudentMarkRow[]) => {
    const filename = `${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_Marks_${test.testDate}.xlsx`;

    const prepareAndDownload = (rows: any[]) => {
      const exportData = rows.map((r, index) => ({
        '#': index + 1,
        'Student Name': r.studentName,
        'Phone Number': r.studentPhone,
        'Class': test.className,
        'Evaluation': test.title,
        'Date': test.testDate,
        [`Mock Test 1 (Max ${test.maxMarksM1 ?? 50})`]: r.isAbsentM1
          ? 'ABSENT'
          : r.marksM1 !== '' && r.marksM1 !== null
          ? r.marksM1
          : '–',
        [`Mock Test 2 (Max ${test.maxMarksM2 ?? 50})`]: r.isAbsentM2
          ? 'ABSENT'
          : r.marksM2 !== '' && r.marksM2 !== null
          ? r.marksM2
          : '–',
        [`Mock Interview (Max ${test.maxMarksMI ?? 50})`]: r.isAbsentMI
          ? 'ABSENT'
          : r.marksMI !== '' && r.marksMI !== null
          ? r.marksMI
          : '–',
        [`Total Marks (Max ${test.maxMarks})`]:
          r.marksObtained !== '' && r.marksObtained !== null ? r.marksObtained : '–',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Test Marks');
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

    if (viewSearch.trim()) {
      const q = viewSearch.toLowerCase();
      list = list.filter(
        (s) => s.studentName.toLowerCase().includes(q) || s.studentPhone.includes(q)
      );
    }

    if (viewStatusFilter === 'present') {
      list = list.filter((s) => !s.isAbsent && s.marksObtained !== '' && s.marksObtained !== null);
    } else if (viewStatusFilter === 'absent') {
      list = list.filter((s) => s.isAbsent);
    } else if (viewStatusFilter === 'pending') {
      list = list.filter((s) => !s.isAbsent && (s.marksObtained === '' || s.marksObtained === null));
    }

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
              Every assessment automatically tracks Mock Test 1, Mock Test 2, and Mock Interview in a unified Excel spreadsheet.
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

        {/* Class Test Overview Cards */}
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
            {classTestStats.map((cls) => {
              const isSelected = selectedClassFilter === String(cls.id);
              return (
                <div
                  key={cls.id}
                  onClick={() => {
                    if (typeof cls.id === 'number') {
                      setSelectedClassFilter(isSelected ? '' : String(cls.id));
                    }
                  }}
                  className={`p-4 ui-card transition-all ${
                    typeof cls.id === 'number' ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    isSelected
                      ? 'border-[#0a0a0a] bg-[#fafafa] ring-1 ring-[#0a0a0a]'
                      : typeof cls.id === 'number' ? 'hover:border-[#737373]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0a0a0a] truncate" title={cls.name}>
                      {cls.name}
                    </span>
                    <div className="flex items-center space-x-1">
                      {cls.isDeleted && (
                        <span className="inline-flex items-center space-x-0.5 text-[9px] font-bold text-[#e7000b] bg-[#fef2f2] border border-[#fecaca] rounded-full px-1.5 py-0.5">
                          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                          <span>Deleted</span>
                        </span>
                      )}
                      <GraduationCap className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                    </div>
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
                : 'Click "Create New Test" to evaluate Mock Test 1, Mock Test 2, and Mock Interview.'}
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
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="badge-solid text-[11px]">
                          {test.className}
                        </span>
                        {test.classDeleted && (
                          <span className="inline-flex items-center space-x-0.5 text-[9px] font-bold text-[#e7000b] bg-[#fef2f2] border border-[#fecaca] rounded-full px-1.5 py-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span>Class Deleted</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleExportTestMarks(test)}
                          className="p-1 rounded-[18px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
                          title="Export Marks to Excel"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        {!test.classDeleted && (
                          <button
                            onClick={() => openEditTestModal(test)}
                            className="p-1 rounded-[18px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
                            title="Edit Test Details"
                          >
                            <Edit2 className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        )}
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
                      <div className="flex items-center space-x-2 text-xs text-[#737373] mt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{test.testDate}</span>
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-[#0a0a0a]">
                          Total Max: {test.maxMarks}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Badges for M1, M2, MI */}
                    <div className="flex items-center space-x-2 pt-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-[#fafafa] border border-[#e5e5e5] font-semibold text-[#0a0a0a]">
                        M1: {test.maxMarksM1 ?? 50}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#fafafa] border border-[#e5e5e5] font-semibold text-[#0a0a0a]">
                        M2: {test.maxMarksM2 ?? 50}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#fafafa] border border-[#e5e5e5] font-semibold text-[#0a0a0a]">
                        MI: {test.maxMarksMI ?? 50}
                      </span>
                    </div>
                  </div>

                  {/* Submission Progress Bar */}
                  <div className="space-y-2 py-2 px-3 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5]">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="text-[#737373]">
                        Students Evaluated: <strong className="text-[#0a0a0a] font-bold">{test.gradedCount}</strong> / {test.enrolledCount}
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

                  {/* Two Action Buttons */}
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
      {/* VIEW RESULTS — FULL-SCREEN EXCEL-STYLE SPREADSHEET MODAL                 */}
      {/* ========================================================================= */}
      {viewModalOpen && viewTest && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/50 backdrop-blur-sm flex flex-col">
          <div className="flex-1 flex flex-col bg-[#ffffff] overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-5 sm:px-8 py-4 border-b border-[#e5e5e5] bg-[#ffffff] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-sm">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="badge-solid text-[10px]">{viewTest.className}</span>
                  {viewTest.classDeleted && (
                    <span className="inline-flex items-center space-x-0.5 text-[9px] font-bold text-[#e7000b] bg-[#fef2f2] border border-[#fecaca] rounded-full px-1.5 py-0.5">
                      <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                      <span>Class Deleted</span>
                    </span>
                  )}
                  <span className="text-xs text-[#737373]">📅 {viewTest.testDate}</span>
                  <span className="badge-soft text-[10px]">Total Max: {viewTest.maxMarks}</span>
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">
                  <FileSpreadsheet className="w-5 h-5 inline-block mr-1.5 -mt-0.5" />
                  {viewTest.title} — Evaluation Results (M1, M2 & Mock Interview)
                </h2>
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
            <div className="px-5 sm:px-8 py-3 bg-[#fafafa] border-b border-[#e5e5e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
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

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                  <select
                    value={viewSortBy}
                    onChange={(e: any) => setViewSortBy(e.target.value)}
                    className="px-2.5 py-1 ui-input text-xs font-semibold cursor-pointer"
                  >
                    <option value="default">Default Order</option>
                    <option value="highest">Highest to Lowest Score</option>
                    <option value="lowest">Lowest to Highest Score</option>
                    <option value="name">Student Name (A-Z)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1">
                  <Filter className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                  <select
                    value={viewStatusFilter}
                    onChange={(e: any) => setViewStatusFilter(e.target.value)}
                    className="px-2.5 py-1 ui-input text-xs font-semibold cursor-pointer"
                  >
                    <option value="all">All Students</option>
                    <option value="present">Only Present / Evaluated</option>
                    <option value="absent">Only Absent</option>
                    <option value="pending">Only Pending</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Excel-Style Spreadsheet Table */}
            <div className="flex-1 overflow-auto">
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
                <div className="min-w-[750px]">
                  <table className="w-full text-left text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '50px' }} />
                      <col style={{ width: '28%' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '150px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '100px' }} />
                    </colgroup>
                    <thead className="bg-[#f0f0f0] border-b-2 border-[#d4d4d4] text-[11px] font-bold uppercase tracking-wider text-[#525252] sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-3 text-center border-r border-[#d4d4d4]">#</th>
                        <th className="py-3 px-4 border-r border-[#d4d4d4]">Student Name</th>
                        <th className="py-3 px-3 text-center border-r border-[#d4d4d4]">
                          Mock 1 <span className="text-[10px] lowercase font-normal">(/ {viewTest.maxMarksM1 ?? 50})</span>
                        </th>
                        <th className="py-3 px-3 text-center border-r border-[#d4d4d4]">
                          Mock 2 <span className="text-[10px] lowercase font-normal">(/ {viewTest.maxMarksM2 ?? 50})</span>
                        </th>
                        <th className="py-3 px-3 text-center border-r border-[#d4d4d4]">
                          Mock Interview <span className="text-[10px] lowercase font-normal">(/ {viewTest.maxMarksMI ?? 50})</span>
                        </th>
                        <th className="py-3 px-3 text-center border-r border-[#d4d4d4] bg-[#e5e5e5]/50">
                          Total <span className="text-[10px] lowercase font-normal">(/ {viewTest.maxMarks})</span>
                        </th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredAndSortedViewMarks.map((s, idx) => {
                        const hasScore = s.marksObtained !== '' && s.marksObtained !== null;

                        return (
                          <tr
                            key={s.studentId}
                            className={`border-b border-[#e5e5e5] transition-colors ${
                              s.isAbsent
                                ? 'bg-[#fef2f2]/40'
                                : idx % 2 === 0
                                ? 'bg-[#ffffff]'
                                : 'bg-[#fafafa]'
                            } hover:bg-[#f0f4ff]`}
                          >
                            <td className="py-3 px-3 text-center font-mono text-xs text-[#737373] border-r border-[#e5e5e5]">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-4 border-r border-[#e5e5e5]">
                              <p className="font-semibold text-[#0a0a0a] text-xs sm:text-sm truncate">{s.studentName}</p>
                              <p className="text-[11px] font-mono text-[#737373]">{s.studentPhone}</p>
                            </td>
                            {/* Mock 1 */}
                            <td className="py-3 px-3 text-center font-semibold text-xs border-r border-[#e5e5e5]">
                              {s.isAbsentM1 ? (
                                <span className="text-[#e7000b] font-bold">ABSENT</span>
                              ) : s.marksM1 !== '' && s.marksM1 !== null ? (
                                <span className="text-[#0a0a0a] font-bold">{s.marksM1}</span>
                              ) : (
                                <span className="text-[#a3a3a3] italic">–</span>
                              )}
                            </td>
                            {/* Mock 2 */}
                            <td className="py-3 px-3 text-center font-semibold text-xs border-r border-[#e5e5e5]">
                              {s.isAbsentM2 ? (
                                <span className="text-[#e7000b] font-bold">ABSENT</span>
                              ) : s.marksM2 !== '' && s.marksM2 !== null ? (
                                <span className="text-[#0a0a0a] font-bold">{s.marksM2}</span>
                              ) : (
                                <span className="text-[#a3a3a3] italic">–</span>
                              )}
                            </td>
                            {/* Mock Interview */}
                            <td className="py-3 px-3 text-center font-semibold text-xs border-r border-[#e5e5e5]">
                              {s.isAbsentMI ? (
                                <span className="text-[#e7000b] font-bold">ABSENT</span>
                              ) : s.marksMI !== '' && s.marksMI !== null ? (
                                <span className="text-[#0a0a0a] font-bold">{s.marksMI}</span>
                              ) : (
                                <span className="text-[#a3a3a3] italic">–</span>
                              )}
                            </td>
                            {/* Total Marks */}
                            <td className="py-3 px-3 text-center font-bold text-sm border-r border-[#e5e5e5] bg-[#fafafa]">
                              {s.isAbsent ? (
                                <span className="text-[#e7000b] text-xs font-bold">ABSENT</span>
                              ) : hasScore ? (
                                <span className="text-[#0a0a0a] font-extrabold">{s.marksObtained}</span>
                              ) : (
                                <span className="text-[#a3a3a3] text-xs italic">Unmarked</span>
                              )}
                            </td>
                            {/* Status */}
                            <td className="py-3 px-3 text-center">
                              {s.isAbsent ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef2f2] text-[#e7000b] border border-[#fecaca]">
                                  Absent
                                </span>
                              ) : hasScore ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]">
                                  Present
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f5f5f5] text-[#737373] border border-[#e5e5e5]">
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-8 py-3.5 bg-[#fafafa] border-t border-[#e5e5e5] flex items-center justify-between shrink-0">
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
      {/* CREATE / EDIT TEST MODAL (NO TEST TYPE DROPDOWN; SET MAX MARKS FOR M1, M2, MI) */}
      {/* ========================================================================= */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ui-card w-full max-w-lg p-6 space-y-5">
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
                  onChange={(e) => {
                    const newClassId = e.target.value;
                    setFormClassId(newClassId);
                    if (!editingTest) {
                      const cName = classes.find((c) => String(c.id) === newClassId)?.name || 'Batch';
                      setFormTitle(`${cName} Evaluation`);
                    }
                  }}
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

              {/* Test Title / Assessment Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Test Title / Evaluation Name <span className="text-[#e7000b]">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. React & Node Assessment"
                  required
                  className="w-full px-3.5 py-2.5 ui-input text-sm font-medium"
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Test Date <span className="text-[#e7000b]">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 ui-input text-sm font-medium"
                />
              </div>

              {/* Max Marks for M1, M2, and Mock Interview */}
              <div className="space-y-2 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[14px]">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">
                    Evaluation Max Marks (M1, M2 & MI)
                  </label>
                  <span className="text-xs font-bold text-[#0a0a0a]">
                    Total Max: {(parseInt(formMaxM1, 10) || 0) + (parseInt(formMaxM2, 10) || 0) + (parseInt(formMaxMI, 10) || 0)}
                  </span>
                </div>
                <p className="text-[11px] text-[#737373]">
                  Every test includes Mock Test 1, Mock Test 2, and Mock Interview by default. Specify the max marks for each below:
                </p>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-[#737373] uppercase truncate">
                      Mock Test 1 (M1)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={formMaxM1}
                      onChange={(e) => setFormMaxM1(e.target.value)}
                      required
                      placeholder="50"
                      className="w-full px-2.5 py-2 ui-input text-xs font-bold text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-[#737373] uppercase truncate">
                      Mock Test 2 (M2)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={formMaxM2}
                      onChange={(e) => setFormMaxM2(e.target.value)}
                      required
                      placeholder="50"
                      className="w-full px-2.5 py-2 ui-input text-xs font-bold text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-[#737373] uppercase truncate">
                      Mock Interview (MI)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={formMaxMI}
                      onChange={(e) => setFormMaxMI(e.target.value)}
                      required
                      placeholder="50"
                      className="w-full px-2.5 py-2 ui-input text-xs font-bold text-center"
                    />
                  </div>
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
      {/* MARKS ENTRY / EDIT — FULL-SCREEN EXCEL-STYLE SPREADSHEET (M1, M2, MI)    */}
      {/* ========================================================================= */}
      {marksModalOpen && activeTest && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/50 backdrop-blur-sm flex flex-col">
          <div className="flex-1 flex flex-col bg-[#ffffff] overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-5 sm:px-8 py-4 border-b border-[#e5e5e5] bg-[#ffffff] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-sm">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="badge-solid text-[10px]">{activeTest.className}</span>
                  {activeTest.classDeleted && (
                    <span className="inline-flex items-center space-x-0.5 text-[9px] font-bold text-[#e7000b] bg-[#fef2f2] border border-[#fecaca] rounded-full px-1.5 py-0.5">
                      <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                      <span>Class Deleted</span>
                    </span>
                  )}
                  <span className="text-xs text-[#737373]">📅 {activeTest.testDate}</span>
                  <span className="badge-soft text-[10px]">
                    Max: M1 ({activeTest.maxMarksM1 ?? 50}) + M2 ({activeTest.maxMarksM2 ?? 50}) + MI ({activeTest.maxMarksMI ?? 50}) = {activeTest.maxMarks}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">
                  <FileSpreadsheet className="w-5 h-5 inline-block mr-1.5 -mt-0.5" />
                  Enter / Edit Marks: {activeTest.title}
                </h2>
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
              <div className="mx-5 sm:mx-8 mt-3 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#e7000b] text-xs font-medium flex items-center space-x-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#e7000b]" />
                <span>{marksError}</span>
              </div>
            )}

            {/* Search Filter for Student Table */}
            <div className="px-5 sm:px-8 py-2.5 border-b border-[#e5e5e5] flex items-center justify-between gap-3 shrink-0 bg-[#fafafa]">
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

            {/* Excel-Style Spreadsheet Table */}
            <div className="flex-1 overflow-auto">
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
                <div className="min-w-[850px]">
                  <table className="w-full text-left text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '50px' }} />
                      <col style={{ width: '26%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '80px' }} />
                    </colgroup>
                    <thead className="bg-[#f0f0f0] border-b-2 border-[#d4d4d4] text-[11px] font-bold uppercase tracking-wider text-[#525252] sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-3 text-center border-r border-[#d4d4d4]">#</th>
                        <th className="py-3 px-4 border-r border-[#d4d4d4]">Student Name</th>
                        <th className="py-3 px-3 text-center border-r border-[#d4d4d4]">
                          Mock Test 1 <span className="lowercase font-normal">(/ {activeTest.maxMarksM1 ?? 50})</span>
                        </th>
                        <th className="py-3 px-3 text-center border-r border-[#d4d4d4]">
                          Mock Test 2 <span className="lowercase font-normal">(/ {activeTest.maxMarksM2 ?? 50})</span>
                        </th>
                        <th className="py-3 px-3 text-center border-r border-[#d4d4d4]">
                          Mock Interview <span className="lowercase font-normal">(/ {activeTest.maxMarksMI ?? 50})</span>
                        </th>
                        <th className="py-3 px-3 text-center bg-[#e5e5e5]/50">
                          Total <span className="lowercase font-normal">(/ {activeTest.maxMarks})</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredStudentMarks.map((s, idx) => {
                        return (
                          <tr
                            key={s.studentId}
                            className={`border-b border-[#e5e5e5] transition-colors ${
                              s.isAbsent
                                ? 'bg-[#fef2f2]/40'
                                : idx % 2 === 0
                                ? 'bg-[#ffffff]'
                                : 'bg-[#fafafa]'
                            } hover:bg-[#f0f4ff]`}
                          >
                            <td className="py-3 px-3 text-center font-mono text-xs text-[#737373] border-r border-[#e5e5e5]">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-4 border-r border-[#e5e5e5]">
                              <p className="font-semibold text-[#0a0a0a] text-xs sm:text-sm truncate">{s.studentName}</p>
                              <p className="text-[11px] font-mono text-[#737373]">{s.studentPhone}</p>
                            </td>

                            {/* Mock Test 1 Input & Absent */}
                            <td className="py-2.5 px-3 border-r border-[#e5e5e5]">
                              <div className="flex items-center space-x-2 justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={activeTest.maxMarksM1 ?? 50}
                                  value={s.isAbsentM1 ? '' : (s.marksM1 ?? '')}
                                  disabled={s.isAbsentM1}
                                  onChange={(e) => handleMarkChange(s.studentId, 'marksM1', e.target.value)}
                                  placeholder={s.isAbsentM1 ? 'ABSENT' : '–'}
                                  className="w-16 px-2 py-1.5 text-center text-xs font-bold bg-[#f5f5f5] border border-[#d4d4d4] rounded-md focus:outline-none focus:border-[#0a0a0a] focus:bg-white disabled:bg-[#e5e5e5] disabled:text-[#a3a3a3]"
                                />
                                <label className="inline-flex items-center space-x-1 cursor-pointer select-none text-[10px]">
                                  <input
                                    type="checkbox"
                                    checked={s.isAbsentM1}
                                    onChange={() => handleAbsentToggle(s.studentId, 'isAbsentM1')}
                                    className="w-3.5 h-3.5 rounded border-[#d4d4d4] text-[#0a0a0a] cursor-pointer"
                                  />
                                  <span className={s.isAbsentM1 ? 'text-[#e7000b] font-bold' : 'text-[#737373]'}>
                                    Abs
                                  </span>
                                </label>
                              </div>
                            </td>

                            {/* Mock Test 2 Input & Absent */}
                            <td className="py-2.5 px-3 border-r border-[#e5e5e5]">
                              <div className="flex items-center space-x-2 justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={activeTest.maxMarksM2 ?? 50}
                                  value={s.isAbsentM2 ? '' : (s.marksM2 ?? '')}
                                  disabled={s.isAbsentM2}
                                  onChange={(e) => handleMarkChange(s.studentId, 'marksM2', e.target.value)}
                                  placeholder={s.isAbsentM2 ? 'ABSENT' : '–'}
                                  className="w-16 px-2 py-1.5 text-center text-xs font-bold bg-[#f5f5f5] border border-[#d4d4d4] rounded-md focus:outline-none focus:border-[#0a0a0a] focus:bg-white disabled:bg-[#e5e5e5] disabled:text-[#a3a3a3]"
                                />
                                <label className="inline-flex items-center space-x-1 cursor-pointer select-none text-[10px]">
                                  <input
                                    type="checkbox"
                                    checked={s.isAbsentM2}
                                    onChange={() => handleAbsentToggle(s.studentId, 'isAbsentM2')}
                                    className="w-3.5 h-3.5 rounded border-[#d4d4d4] text-[#0a0a0a] cursor-pointer"
                                  />
                                  <span className={s.isAbsentM2 ? 'text-[#e7000b] font-bold' : 'text-[#737373]'}>
                                    Abs
                                  </span>
                                </label>
                              </div>
                            </td>

                            {/* Mock Interview Input & Absent */}
                            <td className="py-2.5 px-3 border-r border-[#e5e5e5]">
                              <div className="flex items-center space-x-2 justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={activeTest.maxMarksMI ?? 50}
                                  value={s.isAbsentMI ? '' : (s.marksMI ?? '')}
                                  disabled={s.isAbsentMI}
                                  onChange={(e) => handleMarkChange(s.studentId, 'marksMI', e.target.value)}
                                  placeholder={s.isAbsentMI ? 'ABSENT' : '–'}
                                  className="w-16 px-2 py-1.5 text-center text-xs font-bold bg-[#f5f5f5] border border-[#d4d4d4] rounded-md focus:outline-none focus:border-[#0a0a0a] focus:bg-white disabled:bg-[#e5e5e5] disabled:text-[#a3a3a3]"
                                />
                                <label className="inline-flex items-center space-x-1 cursor-pointer select-none text-[10px]">
                                  <input
                                    type="checkbox"
                                    checked={s.isAbsentMI}
                                    onChange={() => handleAbsentToggle(s.studentId, 'isAbsentMI')}
                                    className="w-3.5 h-3.5 rounded border-[#d4d4d4] text-[#0a0a0a] cursor-pointer"
                                  />
                                  <span className={s.isAbsentMI ? 'text-[#e7000b] font-bold' : 'text-[#737373]'}>
                                    Abs
                                  </span>
                                </label>
                              </div>
                            </td>

                            {/* Total Computed Score */}
                            <td className="py-2.5 px-3 text-center font-extrabold text-xs bg-[#fafafa]">
                              {s.isAbsent ? (
                                <span className="text-[#e7000b]">ABS</span>
                              ) : s.marksObtained !== '' && s.marksObtained !== null ? (
                                <span className="text-[#0a0a0a]">{s.marksObtained}</span>
                              ) : (
                                <span className="text-[#a3a3a3] font-normal">–</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-8 py-4 bg-[#fafafa] border-t border-[#e5e5e5] flex items-center justify-between gap-3 shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
              <p className="text-xs text-[#737373] hidden sm:block">
                Clicking <strong>Save Student Marks</strong> saves all M1, M2, and MI marks and automatically closes the screen.
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
