'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  CalendarCheck,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/mentor/dashboard', icon: LayoutDashboard },
  { label: 'Classes', href: '/mentor/classes', icon: BookOpen },
  { label: 'Students', href: '/mentor/students', icon: Users },
  { label: 'Attendance', href: '/mentor/attendance', icon: CalendarCheck },
  { label: 'Reports', href: '/mentor/reports', icon: BarChart3 },
  { label: 'Settings', href: '/mentor/settings', icon: Settings },
];

export default function MentorNavbar({ mentorName }: { mentorName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/mentor/logout', { method: 'POST' });
      router.push('/mentor/login');
    } catch {
      router.push('/mentor/login');
    }
  };

  return (
    <header className="bg-[#ffffff] border-b border-[#e5e5e5] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          
          {/* Brand Logo */}
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-[18px] bg-[#0a0a0a] text-[#ffffff] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[#ffffff] shrink-0" />
            </div>
            <div>
              <Link href="/mentor/dashboard" className="text-sm font-semibold text-[#0a0a0a] tracking-tight hover:opacity-80 transition">
                Classroom Suite
              </Link>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[18px] text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#0a0a0a] text-[#ffffff]'
                      : 'text-[#737373] hover:bg-[#f5f5f5] hover:text-[#0a0a0a]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User info & Logout */}
          <div className="hidden md:flex items-center space-x-2.5">
            {mentorName && (
              <span className="badge-soft">
                {mentorName}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="btn-outline !py-1 !px-3 !text-xs !rounded-[18px]"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile menu trigger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 rounded-[18px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
            >
              {mobileOpen ? <X className="w-5 h-5 shrink-0" /> : <Menu className="w-5 h-5 shrink-0" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-[#e5e5e5] bg-[#ffffff] px-4 pt-2 pb-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center space-x-2.5 px-3 py-2 rounded-[18px] text-xs font-medium ${
                  isActive
                    ? 'bg-[#0a0a0a] text-[#ffffff]'
                    : 'text-[#737373] hover:bg-[#f5f5f5] hover:text-[#0a0a0a]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="pt-2 border-t border-[#e5e5e5] flex items-center justify-between">
            {mentorName && <span className="text-xs text-[#737373]">{mentorName}</span>}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 text-xs font-medium text-[#0a0a0a]"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
