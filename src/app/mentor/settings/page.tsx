'use client';

import { useState, useEffect } from 'react';
import MentorNavbar from '@/components/mentor/Navbar';
import {
  Settings,
  Shield,
  CheckCircle2,
  Lock,
  RefreshCw,
  User,
} from 'lucide-react';

export default function MentorSettingsPage() {
  const [mentor, setMentor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/mentor/me');
      const meData = await meRes.json();
      if (meData.authenticated) {
        setMentor(meData.mentor);
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

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col">
      <MentorNavbar mentorName={mentor?.name} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.75px] text-[#0a0a0a]">
            Application Settings
          </h1>
          <p className="text-sm text-[#737373]">
            System configuration and security network status.
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#737373]">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0a0a0a] shrink-0" />
            <p className="text-sm mt-2">Loading system settings...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* General Info Card */}
            <div className="ui-card p-6 sm:p-8 space-y-5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] flex items-center justify-center">
                  <Settings className="w-4 h-4 text-[#0a0a0a] shrink-0" />
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">General Application Settings</h2>
              </div>

              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                    Application Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Classroom Attendance"
                    className="w-full px-3.5 py-2.5 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#0a0a0a] font-medium text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Classroom Network Security Card */}
            <div className="ui-card p-6 sm:p-8 space-y-5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] flex items-center justify-center">
                  <Shield className="w-4 h-4 text-[#0a0a0a] shrink-0" />
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">Classroom Network Verification</h2>
              </div>

              <div className="space-y-3 pt-1">
                <div className="p-3.5 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0a0a0a]">Status</span>
                    <span className="inline-flex items-center space-x-1 text-xs font-semibold text-[#0a0a0a] bg-[#ffffff] px-2.5 py-0.5 rounded-[18px] border border-[#e5e5e5]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Configured & Enforced</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#e5e5e5] text-xs text-[#737373]">
                    <span>Server IP Verification</span>
                    <span className="font-mono text-[#0a0a0a] font-semibold">CLASSROOM_ALLOWED_IPS</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5 p-3.5 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-xs text-[#737373] leading-relaxed">
                  <Lock className="w-4 h-4 text-[#0a0a0a] shrink-0 mt-0.5" />
                  <p>
                    For security purposes, classroom allowed public IPs cannot be edited through the browser UI. They are configured via the server environment variable <code className="bg-[#ffffff] px-1.5 py-0.5 rounded font-mono text-[#0a0a0a] border border-[#e5e5e5]">CLASSROOM_ALLOWED_IPS</code> on Vercel or your hosting environment.
                  </p>
                </div>
              </div>
            </div>

            {/* Mentor Account Card */}
            <div className="ui-card p-6 sm:p-8 space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] flex items-center justify-center">
                  <User className="w-4 h-4 text-[#0a0a0a] shrink-0" />
                </div>
                <h2 className="text-lg font-bold text-[#0a0a0a]">Mentor Profile</h2>
              </div>

              {mentor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#0a0a0a]">
                  <div className="p-3.5 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5] space-y-1">
                    <span className="block font-semibold text-[#737373] uppercase">Mentor Name</span>
                    <span className="text-sm font-bold text-[#0a0a0a]">{mentor.name}</span>
                  </div>
                  <div className="p-3.5 bg-[#fafafa] rounded-[18px] border border-[#e5e5e5] space-y-1">
                    <span className="block font-semibold text-[#737373] uppercase">Email Address</span>
                    <span className="text-sm font-bold text-[#0a0a0a]">{mentor.email}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
