'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface InviteDetails {
  role: string;
  email: string | null;
  expiresAt: number;
  household: {
    id: string;
    name: string;
    memberCount: number;
  };
  invitedBy: {
    name: string | null;
    email: string;
  } | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export default function InvitePage(): React.ReactElement {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Load invite details and check auth status in parallel
        const [inviteRes, authRes] = await Promise.all([
          fetch(`/api/v1/households/invite/${token}`),
          fetch('/api/v1/auth/me', { credentials: 'include' }),
        ]);

        // Handle invite response
        const inviteData = await inviteRes.json();
        if (!inviteRes.ok) {
          throw new Error(inviteData.error?.message || 'Invalid invite');
        }
        setInvite(inviteData.invite);

        // Handle auth response
        setIsAuthenticated(authRes.ok);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load the invitation'
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/households/invite/${token}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to accept invite');
      }

      // Success! Redirect to family page
      router.push('/familia');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to accept the invitation'
      );
      setIsAccepting(false);
    }
  };

  // Determine which view to show
  const viewState = loading ? 'loading' : error && !invite ? 'error' : 'invite';

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {viewState === 'loading' && (
        <div
          key="loading"
          className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"
        />
      )}

      {viewState === 'error' && (
        <div key="error" className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Invalid Invitation
          </h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl font-medium"
          >
            Go to Sign In
          </Link>
        </div>
      )}

      {viewState === 'invite' && (
        <div
          key="invite"
          className="max-w-md w-full bg-gray-900 rounded-2xl p-8 border border-gray-800"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 mb-4">
              <span className="text-4xl">👨‍👩‍👧‍👦</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Household Invitation
            </h1>
            <p className="text-gray-400">You've been invited to join</p>
          </div>

          {/* Household Info */}
          <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-2">
              {invite?.household.name}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Your role:</span>
                <span className="text-cyan-400 font-medium">
                  {ROLE_LABELS[invite?.role || ''] || invite?.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Current members:</span>
                <span className="text-white">
                  {invite?.household.memberCount}
                </span>
              </div>
              {invite?.invitedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Invited by:</span>
                  <span className="text-white">
                    {invite.invitedBy.name || invite.invitedBy.email}
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions - different based on auth status */}
          {isAuthenticated ? (
            <div className="space-y-3">
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAccepting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Join Household
                  </>
                )}
              </button>
              <Link
                href="/dashboard"
                className="block w-full py-3 bg-gray-800 text-gray-300 text-center rounded-xl font-medium hover:bg-gray-700"
              >
                Cancel
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-gray-400 text-sm">
                Create an account or sign in to join this household
              </p>
              <div className="space-y-3">
                <Link
                  href={`/register?redirect=/invite/${token}`}
                  className="block w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-center rounded-xl font-medium transition-all"
                >
                  Create Account
                </Link>
                <Link
                  href={`/login?redirect=/invite/${token}`}
                  className="block w-full py-3 bg-gray-800 text-gray-300 text-center rounded-xl font-medium hover:bg-gray-700"
                >
                  I already have an account
                </Link>
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-gray-500">
            This invitation expires on{' '}
            {invite?.expiresAt
              ? new Date(invite.expiresAt).toLocaleDateString('en-US')
              : ''}
          </p>
        </div>
      )}
    </div>
  );
}
