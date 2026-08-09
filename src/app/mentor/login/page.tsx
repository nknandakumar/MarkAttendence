'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function MentorLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/mentor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push('/mentor/dashboard');
      } else {
        setError(data.message || 'Invalid username or password.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#f5f5f5] text-[#0a0a0a]">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[18px] bg-[#0a0a0a] text-[#ffffff] mb-1">
            <ShieldCheck className="w-6 h-6 text-[#ffffff] shrink-0" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
            Mentor Portal
          </h1>
          <p className="text-sm text-[#737373]">
            Sign in to manage classes, students & attendance reports
          </p>
        </div>

        {/* Paper Card */}
        <div className="ui-card p-6 sm:p-8 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-[#e7000b] text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#e7000b]" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                Username
              </label>
              <div className="flex items-center space-x-2.5 ui-input px-3.5 py-2.5">
                <User className="w-4 h-4 text-[#737373] shrink-0" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter Username"
                  required
                  autoFocus
                  className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-sm font-medium focus:outline-none focus:ring-0 p-0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">
                Password
              </label>
              <div className="flex items-center space-x-2.5 ui-input px-3.5 py-2.5">
                <Lock className="w-4 h-4 text-[#737373] shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-transparent border-none text-[#0a0a0a] placeholder-[#737373] text-sm font-medium focus:outline-none focus:ring-0 p-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#737373] hover:text-[#0a0a0a] focus:outline-none shrink-0 cursor-pointer"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 shrink-0" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full mt-2 disabled:opacity-40 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div className="text-center">
          <a
            href="/"
            className="text-xs font-medium text-[#737373] hover:text-[#0a0a0a] transition underline"
          >
            ← Back to Student Attendance Page
          </a>
        </div>

      </div>
    </main>
  );
}
