'use client';

import { useState, useEffect } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Users,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Clock,
  Calendar,
  X,
} from 'lucide-react';
import { fetchWithCache, invalidateCache } from '@/lib/cache/client-cache';

/** Convert 24h "HH:MM" to "H:MM AM/PM" */
function formatTime12h(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function MentorClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState<any>(null);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [classType, setClassType] = useState<'weekday' | 'weekend'>('weekday');
  const [sessionStart, setSessionStart] = useState('');
  const [sessionEnd, setSessionEnd] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async (forceFresh = false) => {
    if (forceFresh) {
      invalidateCache('/api/classes');
      invalidateCache('/api/public/classes');
    }
    if (classes.length === 0) setLoading(true);
    try {
      const meData = await fetchWithCache('/api/mentor/me', 60 * 1000);
      if (!meData || !meData.authenticated) {
        window.location.href = '/mentor/login';
        return;
      }
      setMentor(meData.mentor);

      const classData = forceFresh
        ? await fetch('/api/classes').then((r) => r.json())
        : await fetchWithCache('/api/classes', 30 * 1000);

      if (classData && classData.success) {
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

  const openCreateModal = () => {
    setEditingClass(null);
    setName('');
    setDescription('');
    setClassType('weekday');
    setSessionStart('');
    setSessionEnd('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (cls: any) => {
    setEditingClass(cls);
    setName(cls.name);
    setDescription(cls.description || '');
    setClassType(cls.classType === 'weekend' ? 'weekend' : 'weekday');
    setSessionStart(cls.sessionStart || '');
    setSessionEnd(cls.sessionEnd || '');
    setStartDate(cls.startDate || '');
    setEndDate(cls.endDate || '');
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    // Validate mandatory attendance window
    if (!sessionStart || !sessionEnd) {
      setError('Attendance window is mandatory. Please specify both Start Time and End Time.');
      return;
    }
    if (sessionStart >= sessionEnd) {
      setError('Session end time must be after start time.');
      return;
    }

    // Validate dates if both provided
    if (startDate && endDate && startDate > endDate) {
      setError('Course end date cannot be earlier than course start date.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : '/api/classes';
      const method = editingClass ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          classType,
          sessionStart,
          sessionEnd,
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsModalOpen(false);
        setSuccessMsg(editingClass ? 'Class updated successfully!' : 'Class created successfully!');
        setTimeout(() => setSuccessMsg(''), 4000);
        loadData(true);
      } else {
        setError(data.message || 'Failed to save class.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, className: string) => {
    if (!confirm(`Are you sure you want to delete "${className}"? This will remove all student enrollments and tests for this class.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(`Class "${className}" deleted.`);
        setTimeout(() => setSuccessMsg(''), 4000);
        loadData(true);
      } else {
        alert(data.message || 'Failed to delete class.');
      }
    } catch {
      alert('Failed to delete class.');
    }
  };

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col">
      <MentorNavbar mentorName={mentor?.name} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">
              Classroom Management
            </h1>
            <p className="text-sm text-[#737373]">
              Configure classrooms, weekday & weekend schedules, and mandatory session attendance windows.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="btn-primary shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Create Classroom</span>
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="flex items-center space-x-2 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#0a0a0a] text-xs font-semibold shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-[#0a0a0a] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Search Bar with Cancel Button */}
        <div className="ui-card p-3 flex items-center justify-between space-x-3">
          <div className="flex items-center space-x-2.5 flex-1">
            <Search className="w-4 h-4 text-[#737373] shrink-0 ml-1" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search classes by name or description..."
              className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-sm focus:outline-none font-medium"
            />
          </div>
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

        {/* Classes Grid */}
        {loading ? (
          <div className="py-12 text-center text-[#737373] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm">Loading classroom list...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="ui-card p-12 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-[#737373] mx-auto shrink-0" />
            <h3 className="text-base font-bold text-[#0a0a0a]">No classrooms found</h3>
            <p className="text-xs text-[#737373] max-w-sm mx-auto">
              {search
                ? 'No classes match your search query.'
                : 'Click "Create Classroom" to add your first batch or subject.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map((cls) => (
              <div
                key={cls.id}
                className="ui-card p-5 flex flex-col justify-between space-y-4 hover:border-[#737373] transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] flex items-center justify-center">
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      </div>
                      <h3 className="text-base font-bold text-[#0a0a0a] line-clamp-1">{cls.name}</h3>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditModal(cls)}
                        className="p-1 rounded-[18px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
                        title="Edit Class"
                      >
                        <Edit2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                      <button
                        onClick={() => handleDelete(cls.id, cls.name)}
                        className="p-1 rounded-[18px] text-[#737373] hover:text-[#e7000b] hover:bg-[#f5f5f5]"
                        title="Delete Class"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#737373] leading-relaxed">
                    {cls.description || 'No description provided.'}
                  </p>

                  {/* Schedule type & Attendance window badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-[10px] text-[10px] font-bold border ${
                        cls.classType === 'weekend'
                          ? 'bg-[#fefce8] text-[#854d0e] border-[#fde047]'
                          : 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]'
                      }`}
                    >
                      {cls.classType === 'weekend' ? '🗓️ Weekend (Sat-Sun)' : '📅 Weekday (Mon-Fri)'}
                    </span>

                    {cls.sessionStart && cls.sessionEnd ? (
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#f0f9ff] border border-[#bae6fd] rounded-[10px]">
                        <Clock className="w-3 h-3 text-[#0284c7] shrink-0" />
                        <span className="text-[10px] font-semibold text-[#0284c7]">
                          {formatTime12h(cls.sessionStart)} – {formatTime12h(cls.sessionEnd)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#fef2f2] border border-[#fecaca] rounded-[10px]">
                        <Clock className="w-3 h-3 text-[#dc2626] shrink-0" />
                        <span className="text-[10px] font-semibold text-[#dc2626]">Timing not set</span>
                      </div>
                    )}
                  </div>

                  {/* Course Timeline (Start & End Date) */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <div className="flex items-center space-x-1 px-2.5 py-1 bg-[#fafafa] border border-[#e5e5e5] rounded-[10px] text-[11px] text-[#737373]">
                      <Calendar className="w-3 h-3 text-[#0a0a0a] shrink-0" />
                      <span>
                        {cls.startDate ? cls.startDate : 'Start: Not set'} → {cls.endDate ? cls.endDate : 'Ongoing'}
                      </span>
                    </div>
                    {cls.endDate && new Date().toISOString().split('T')[0] > cls.endDate && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef2f2] text-[#e7000b] border border-[#fecaca]">
                        Course Completed
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#e5e5e5] flex items-center justify-between text-xs text-[#737373]">
                  <div className="flex items-center space-x-1.5 font-medium">
                    <Users className="w-3.5 h-3.5 text-[#0a0a0a] shrink-0" />
                    <span>{cls.studentCount || 0} Enrolled</span>
                  </div>
                  <Link
                    href={`/mentor/students?classId=${cls.id}`}
                    className="font-semibold text-[#0a0a0a] hover:underline"
                  >
                    View Students →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ui-card w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0a0a0a]">
                {editingClass ? 'Edit Classroom' : 'Create New Classroom'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-[10px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#e7000b] text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#e7000b]" />
                  <span>{error}</span>
                </div>
              )}

              {/* Class Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Class Name <span className="text-[#e7000b]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Power BI"
                  required
                  className="w-full px-3.5 py-2.5 ui-input text-sm font-medium"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional class details or schedule"
                  rows={2}
                  className="w-full px-3.5 py-2.5 ui-input text-sm font-medium resize-none"
                />
              </div>

              {/* Class Schedule Type: Weekday vs Weekend (Mandatory Choice) */}
              <div className="space-y-2 p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-[14px]">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">
                    Class Schedule Type <span className="text-[#e7000b]">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-[#737373] uppercase">
                    {classType === 'weekend' ? 'Sat & Sun Only' : 'Mon – Fri Only'}
                  </span>
                </div>
                <p className="text-[11px] text-[#737373]">
                  Select whether this batch runs on regular weekdays or on weekends:
                </p>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <label
                    className={`flex items-start space-x-2.5 p-3 rounded-[12px] border cursor-pointer transition select-none ${
                      classType === 'weekday'
                        ? 'border-[#0a0a0a] bg-white ring-2 ring-[#0a0a0a]'
                        : 'border-[#e5e5e5] bg-white hover:border-[#a3a3a3]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="classType"
                      value="weekday"
                      checked={classType === 'weekday'}
                      onChange={() => setClassType('weekday')}
                      className="mt-0.5 text-[#0a0a0a] focus:ring-[#0a0a0a] cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs font-bold text-[#0a0a0a]">📅 Weekday Class</span>
                      <span className="block text-[10px] text-[#737373] mt-0.5">Monday to Friday</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start space-x-2.5 p-3 rounded-[12px] border cursor-pointer transition select-none ${
                      classType === 'weekend'
                        ? 'border-[#0a0a0a] bg-white ring-2 ring-[#0a0a0a]'
                        : 'border-[#e5e5e5] bg-white hover:border-[#a3a3a3]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="classType"
                      value="weekend"
                      checked={classType === 'weekend'}
                      onChange={() => setClassType('weekend')}
                      className="mt-0.5 text-[#0a0a0a] focus:ring-[#0a0a0a] cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs font-bold text-[#0a0a0a]">🗓️ Weekend Class</span>
                      <span className="block text-[10px] text-[#737373] mt-0.5">Saturday & Sunday</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Course Timeline (No 'Optional' word) */}
              <div className="space-y-2 p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-[14px]">
                <label className="block text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">
                  Course Timeline
                </label>
                <p className="text-[11px] text-[#737373] leading-relaxed">
                  Mentors can specify the course start date now, and can add or edit the end date anytime when the course completes.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-[#737373] uppercase">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setError('');
                      }}
                      className="w-full px-3 py-2 ui-input text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-[#737373] uppercase">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setError('');
                      }}
                      className="w-full px-3 py-2 ui-input text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Attendance Window (MANDATORY) */}
              <div className="space-y-2 p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-[14px]">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">
                    Attendance Window <span className="text-[#e7000b]">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-[#e7000b] uppercase tracking-wider">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-[#737373]">
                  Students can only mark attendance within this required time window.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-[#737373] uppercase">
                      Start Time <span className="text-[#e7000b]">*</span>
                    </label>
                    <input
                      type="time"
                      value={sessionStart}
                      onChange={(e) => {
                        setSessionStart(e.target.value);
                        setError('');
                      }}
                      required
                      className="w-full px-3 py-2.5 ui-input text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-[#737373] uppercase">
                      End Time <span className="text-[#e7000b]">*</span>
                    </label>
                    <input
                      type="time"
                      value={sessionEnd}
                      onChange={(e) => {
                        setSessionEnd(e.target.value);
                        setError('');
                      }}
                      required
                      className="w-full px-3 py-2.5 ui-input text-sm font-medium"
                    />
                  </div>
                </div>
                {sessionStart && sessionEnd && (
                  <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-[10px] mt-2">
                    <Clock className="w-3 h-3 text-[#0284c7] shrink-0" />
                    <span className="text-[10px] font-semibold text-[#0284c7]">
                      Attendance Window: {formatTime12h(sessionStart)} – {formatTime12h(sessionEnd)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary !py-2 !px-4 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim() || !sessionStart || !sessionEnd}
                  className="btn-primary !py-2 !px-4 !text-xs disabled:opacity-40"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingClass ? 'Save Changes' : 'Create Class'}</span>
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
