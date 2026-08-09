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
} from 'lucide-react';
import { fetchWithCache, invalidateCache } from '@/lib/cache/client-cache';

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
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (cls: any) => {
    setEditingClass(cls);
    setName(cls.name);
    setDescription(cls.description || '');
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    setError('');

    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : '/api/classes';
      const method = editingClass ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
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
    if (!confirm(`Are you sure you want to delete class "${className}"? All attendance records for this class will also be removed.`)) {
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
              Classrooms Management
            </h1>
            <p className="text-sm text-[#737373]">
              Create, edit, and organize classroom subjects for student enrollment.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="btn-primary shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Create New Class</span>
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="flex items-center space-x-2 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#0a0a0a] text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-[#0a0a0a] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="ui-card p-3 flex items-center space-x-3">
          <Search className="w-4 h-4 text-[#737373] shrink-0 ml-1" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classes by name or description..."
            className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-sm focus:outline-none font-medium"
          />
        </div>

        {/* Classes Grid */}
        {loading ? (
          <div className="py-12 text-center text-[#737373] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm">Loading classroom list...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="ui-card p-12 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-[#737373] mx-auto shrink-0" />
            <p className="text-sm text-[#737373]">No classes found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredClasses.map((cls) => (
              <div key={cls.id} className="ui-card p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-[#0a0a0a] shrink-0" />
                      </div>
                      <h3 className="text-base font-bold text-[#0a0a0a]">{cls.name}</h3>
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
                    View Roster →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ui-card w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold text-[#0a0a0a]">
              {editingClass ? 'Edit Classroom' : 'Create New Classroom'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#e7000b] text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#e7000b]" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Class Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Python Programming"
                  required
                  className="w-full px-3.5 py-2.5 ui-input text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional class details or schedule"
                  rows={3}
                  className="w-full px-3.5 py-2.5 ui-input text-sm font-medium resize-none"
                />
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
                  disabled={saving || !name.trim()}
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
