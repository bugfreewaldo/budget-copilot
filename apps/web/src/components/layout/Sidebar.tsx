'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  emoji: string;
  description?: string;
  requiresPro?: boolean;
}

interface UserPlan {
  plan: 'free' | 'pro' | 'premium';
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    emoji: '🏠',
    description: 'Financial overview',
  },
  {
    href: '/transacciones',
    label: 'Transactions',
    emoji: '💸',
    description: 'Manage your transactions',
  },
  // TODO: Temporarily hidden - re-enable when presupuesto is ready
  // {
  //   href: '/presupuesto',
  //   label: 'Budget',
  //   emoji: '📊',
  //   description: 'Manage your envelopes',
  // },
  {
    href: '/alcancia',
    label: 'Piggy Bank',
    emoji: '🐷',
    description: 'Save little by little',
  },
  {
    href: '/recurrentes',
    label: 'Recurring',
    emoji: '🔄',
    description: 'Fixed payments and income',
  },
  {
    href: '/deudas',
    label: 'Debt Copilot',
    emoji: '💀',
    description: 'Crush your debts',
  },
  {
    href: '/metas',
    label: 'Goal Tracking',
    emoji: '🎯',
    description: 'Reach your dreams',
  },
  {
    href: '/categories',
    label: 'Categories',
    emoji: '🏷️',
    description: 'Organize your expenses',
  },
  {
    href: '/familia',
    label: 'Family',
    emoji: '👨‍👩‍👧‍👦',
    description: 'Share with your family',
  },
  {
    href: '/advisor',
    label: 'Financial Advisor',
    emoji: '🧠',
    description: 'Update your financial situation',
    requiresPro: true,
  },
];

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [userPlan, setUserPlan] = useState<UserPlan['plan']>('free');
  const pathname = usePathname();
  const router = useRouter();

  // Check authentication and get user plan
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.user?.plan) {
          setUserPlan(data.user.plan);
        }
        setAuthChecked(true);
      } catch {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) {
      setIsCollapsed(stored === 'true');
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Show loading state while checking auth
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <span className="font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Budget Copilot
            </span>
          </Link>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <Link
              href="/dashboard"
              className="flex items-center gap-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className="text-2xl">🧠</span>
              <span className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Budget Copilot
              </span>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Close menu"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const isLocked = item.requiresPro && userPlan === 'free';
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-xl">{item.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          {item.label}
                          {isLocked && (
                            <span className="text-yellow-500 text-sm">🔒</span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-500">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-gray-800">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </Link>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:bg-gray-900/50 lg:backdrop-blur-xl lg:border-r lg:border-gray-800 transition-all duration-300 ${
          isCollapsed ? 'lg:w-16' : 'lg:w-64'
        }`}
      >
        {/* Logo */}
        <div
          className={`flex items-center gap-2 py-5 border-b border-gray-800 ${isCollapsed ? 'px-3 justify-center' : 'px-6'}`}
        >
          <span className="text-2xl">🧠</span>
          {!isCollapsed && (
            <Link
              href="/dashboard"
              className="font-bold text-xl bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent hover:from-cyan-300 hover:to-purple-300 transition-all"
            >
              Budget Copilot
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-2">
          {!isCollapsed && (
            <div className="mb-4 px-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Features
              </span>
            </div>
          )}
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const isLocked = item.requiresPro && userPlan === 'free';
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={
                      isCollapsed
                        ? `${item.label}${isLocked ? ' 🔒' : ''}`
                        : undefined
                    }
                    className={`flex items-center gap-3 rounded-lg transition-all group ${
                      isCollapsed ? 'px-3 py-2.5 justify-center' : 'px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    <span
                      className={`text-lg transition-transform ${isActive ? '' : 'group-hover:scale-110'}`}
                    >
                      {item.emoji}
                    </span>
                    {!isCollapsed && (
                      <span className="font-medium text-sm flex items-center gap-2">
                        {item.label}
                        {isLocked && (
                          <span className="text-yellow-500 text-xs">🔒</span>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse Toggle Button */}
        <div className="p-2 border-t border-gray-800">
          <button
            onClick={toggleCollapsed}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all text-sm"
            title={isCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* Footer */}
        <div
          className={`p-2 border-t border-gray-800 ${isCollapsed ? 'flex justify-center' : ''}`}
        >
          <Link
            href="/"
            title={isCollapsed ? 'Sign Out' : undefined}
            className={`flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all text-sm ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {!isCollapsed && <span>Sign Out</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`pt-14 lg:pt-0 transition-all duration-300 ${isCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}
      >
        {children}
      </main>
    </div>
  );
}
