'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@budget-copilot/ui/button';

/**
 * BudgetCopilot Homepage - Financial Decision Engine
 * Not a budgeting app. A financial decision engine.
 */

// Hook for scroll-triggered animations
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

// Animated section wrapper
function AnimatedSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isInView } = useInView();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function HomePage(): React.ReactElement {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  // Trigger hero animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Lock body scroll when menu is open
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-40 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-40 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-72 bg-gray-900 border-l border-gray-800 z-50 p-6">
            <div className="flex justify-end mb-8">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-gray-400 hover:text-white p-2"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <nav className="space-y-4">
              <Link
                href="#how"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-gray-300 hover:text-white py-2"
              >
                How It Works
              </Link>
              <Link
                href="#examples"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-gray-300 hover:text-white py-2"
              >
                Examples
              </Link>
              <Link
                href="/pricing"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-gray-300 hover:text-white py-2"
              >
                Pricing
              </Link>
              <div className="border-t border-gray-800 pt-4 mt-4 space-y-3">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-gray-300 hover:text-white py-2"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0">
                    See what to do today
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}

      {/* Header */}
      <header className="relative z-10 border-b border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl lg:text-3xl">🧠</span>
              <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                BudgetCopilot
              </h1>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-6">
              <Link
                href="#how"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                How It Works
              </Link>
              <Link
                href="#examples"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Examples
              </Link>
              <Link
                href="/pricing"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Sign In
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0"
                >
                  See what to do today
                </Button>
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white"
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
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* HERO */}
        <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            {/* Pill */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700 mb-6"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm text-gray-300">AI Decision Engine</span>
            </div>

            {/* Headline */}
            <h2
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
                transition:
                  'opacity 0.6s ease-out 0.1s, transform 0.6s ease-out 0.1s',
              }}
            >
              Stop guessing.
              <span className="block bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Do exactly what your money needs today.
              </span>
            </h2>

            {/* Subheadline */}
            <p
              className="text-lg lg:text-xl text-gray-400 mb-4 max-w-3xl mx-auto"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
                transition:
                  'opacity 0.6s ease-out 0.2s, transform 0.6s ease-out 0.2s',
              }}
            >
              BudgetCopilot uses AI to ask you the right questions, analyze your
              finances, and issue a clear financial instruction every day — what
              to pay, what to spend, or when to stop.
            </p>

            {/* Micro-line */}
            <p
              className="text-sm text-gray-500 mb-8"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
                transition:
                  'opacity 0.6s ease-out 0.3s, transform 0.6s ease-out 0.3s',
              }}
            >
              Works worldwide. Upload bank statements, screenshots, or Excel
              files. No bank connection required.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
                transition:
                  'opacity 0.6s ease-out 0.4s, transform 0.6s ease-out 0.4s',
              }}
            >
              <Link href="/register">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0 text-lg px-8 transition-transform hover:scale-105"
                >
                  See what to do today
                </Button>
              </Link>
              <Link href="#how">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-gray-600 text-gray-300 hover:bg-gray-800 text-lg transition-transform hover:scale-105"
                >
                  See how it works
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION: What This Is */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <p className="text-cyan-400 text-sm font-medium mb-4">
              THIS IS NOT A BUDGETING APP
            </p>
            <h3 className="text-3xl lg:text-4xl font-bold mb-6">
              BudgetCopilot is a financial decision engine.
            </h3>
            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              Instead of dashboards, charts, or endless configuration, an AI
              guides you through a short financial interview — and then tells
              you exactly what to do.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-gray-500">
              <span className="flex items-center gap-2">
                <span className="text-red-400">✕</span> No spreadsheets
              </span>
              <span className="flex items-center gap-2">
                <span className="text-red-400">✕</span> No manual analysis
              </span>
              <span className="flex items-center gap-2">
                <span className="text-red-400">✕</span> No guessing
              </span>
            </div>
          </AnimatedSection>
        </section>

        {/* SECTION: How It Works */}
        <section id="how" className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <h3 className="text-3xl lg:text-4xl font-bold mb-4">
                How BudgetCopilot Works
              </h3>
            </AnimatedSection>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <AnimatedSection className="relative" delay={0}>
                <div className="text-6xl font-bold text-gray-800 absolute -top-4 -left-2">
                  1
                </div>
                <div className="relative bg-gray-900/50 rounded-2xl p-6 border border-gray-800 h-full transition-all duration-300 hover:border-gray-700 hover:-translate-y-1">
                  <div className="text-4xl mb-4">🎙️</div>
                  <h4 className="text-xl font-bold mb-3 text-white">
                    The AI asks you simple questions
                  </h4>
                  <p className="text-gray-400">
                    How much you earn, what accounts you have, what you owe, how
                    much you spend. Answer what you know — estimates work.
                  </p>
                </div>
              </AnimatedSection>

              {/* Step 2 */}
              <AnimatedSection className="relative" delay={100}>
                <div className="text-6xl font-bold text-gray-800 absolute -top-4 -left-2">
                  2
                </div>
                <div className="relative bg-gray-900/50 rounded-2xl p-6 border border-gray-800 h-full transition-all duration-300 hover:border-gray-700 hover:-translate-y-1">
                  <div className="text-4xl mb-4">📄</div>
                  <h4 className="text-xl font-bold mb-3 text-white">
                    Upload what you already have (optional)
                  </h4>
                  <p className="text-gray-400">
                    PDFs, screenshots, Excel files, CSVs. The AI reads them and
                    fills in the gaps.
                  </p>
                </div>
              </AnimatedSection>

              {/* Step 3 */}
              <AnimatedSection className="relative" delay={200}>
                <div className="text-6xl font-bold text-gray-800 absolute -top-4 -left-2">
                  3
                </div>
                <div className="relative bg-gradient-to-br from-cyan-900/30 to-purple-900/30 rounded-2xl p-6 border border-cyan-500/30 h-full transition-all duration-300 hover:border-cyan-500/50 hover:-translate-y-1">
                  <div className="text-4xl mb-4">⚡</div>
                  <h4 className="text-xl font-bold mb-3 text-cyan-400">
                    You receive today's financial instruction
                  </h4>
                  <p className="text-gray-400">
                    One clear action — with consequences — valid only for today.
                  </p>
                </div>
              </AnimatedSection>
            </div>

            <AnimatedSection
              className="text-center text-gray-500 mt-8"
              delay={300}
            >
              <p>That's it.</p>
            </AnimatedSection>
          </div>
        </section>

        {/* SECTION: What Makes This Different */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <div className="max-w-4xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <h3 className="text-3xl lg:text-4xl font-bold mb-4">
                What Makes This Different
              </h3>
              <p className="text-lg text-gray-400">
                Most financial apps make you do the work. BudgetCopilot doesn't.
              </p>
            </AnimatedSection>

            <div className="grid md:grid-cols-2 gap-6">
              <AnimatedSection delay={0}>
                <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50 h-full transition-all duration-300 hover:border-gray-600 hover:-translate-y-1">
                  <div className="text-2xl mb-3">🤖</div>
                  <h4 className="text-lg font-bold mb-2 text-white">
                    The AI leads the process
                  </h4>
                  <p className="text-gray-400 text-sm">
                    You never face a blank screen. You never get stuck because
                    of missing data.
                  </p>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50 h-full transition-all duration-300 hover:border-gray-600 hover:-translate-y-1">
                  <div className="text-2xl mb-3">🌍</div>
                  <h4 className="text-lg font-bold mb-2 text-white">
                    Works even if:
                  </h4>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• You don't remember exact amounts</li>
                    <li>• You only have rough numbers</li>
                    <li>• You don't want to connect your bank</li>
                  </ul>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* SECTION: Examples */}
        <section id="examples" className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <h3 className="text-3xl lg:text-4xl font-bold mb-4">
                What You'll Actually See
              </h3>
              <p className="text-lg text-gray-400">
                These are examples of real instructions that BudgetCopilot
                issues:
              </p>
            </AnimatedSection>

            <div className="space-y-4">
              {/* Example 1 */}
              <AnimatedSection delay={0}>
                <div className="bg-gradient-to-r from-amber-900/20 to-amber-900/5 rounded-2xl p-6 border border-amber-500/30 transition-all duration-300 hover:border-amber-500/50 hover:-translate-y-1">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">🟡</span>
                    <div>
                      <p className="text-xl font-bold text-white mb-2">
                        "Don't exceed $23/day until Friday. Anything above this
                        puts your electric bill at risk."
                      </p>
                      <p className="text-amber-400/80 text-sm">
                        Valid for 14 hours
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>

              {/* Example 2 */}
              <AnimatedSection delay={100}>
                <div className="bg-gradient-to-r from-green-900/20 to-green-900/5 rounded-2xl p-6 border border-green-500/30 transition-all duration-300 hover:border-green-500/50 hover:-translate-y-1">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">💳</span>
                    <div>
                      <p className="text-xl font-bold text-white mb-2">
                        "Pay $312 extra on your Chase card today. This shortens
                        your debt-free date by 41 days."
                      </p>
                      <p className="text-green-400/80 text-sm">
                        Valid for 8 hours
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>

              {/* Example 3 */}
              <AnimatedSection delay={200}>
                <div className="bg-gradient-to-r from-red-900/20 to-red-900/5 rounded-2xl p-6 border border-red-500/30 transition-all duration-300 hover:border-red-500/50 hover:-translate-y-1">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">🚨</span>
                    <div>
                      <p className="text-xl font-bold text-white mb-2">
                        "FREEZE all spending until payday. You're $186 short on
                        upcoming bills."
                      </p>
                      <p className="text-red-400/80 text-sm">
                        Valid for 6 hours
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            </div>

            <AnimatedSection className="text-center mt-8 space-y-2" delay={300}>
              <p className="text-gray-500">No charts required.</p>
              <p className="text-gray-500">No interpretation needed.</p>
            </AnimatedSection>
          </div>
        </section>

        {/* SECTION: Why This Works */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl lg:text-4xl font-bold mb-6">
              Why This Works
            </h3>
            <p className="text-xl text-gray-400 mb-8">
              Most tools give you information.
              <br />
              <span className="text-white font-medium">
                BudgetCopilot gives you direction.
              </span>
            </p>

            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="bg-gray-800/30 rounded-xl p-5 transition-all duration-300 hover:bg-gray-800/50 hover:-translate-y-1">
                <div className="text-cyan-400 font-bold mb-2">
                  One instruction at a time
                </div>
                <p className="text-gray-400 text-sm">
                  No analysis paralysis. One clear action.
                </p>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-5 transition-all duration-300 hover:bg-gray-800/50 hover:-translate-y-1">
                <div className="text-cyan-400 font-bold mb-2">
                  Clear consequences
                </div>
                <p className="text-gray-400 text-sm">
                  You know exactly what happens if you don't act.
                </p>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-5 transition-all duration-300 hover:bg-gray-800/50 hover:-translate-y-1">
                <div className="text-cyan-400 font-bold mb-2">
                  Expires daily
                </div>
                <p className="text-gray-400 text-sm">
                  It trains you to act, not to explore.
                </p>
              </div>
            </div>

            <p className="text-gray-500 mt-8">
              Either follow the instruction — or accept the risk.
            </p>
          </AnimatedSection>
        </section>

        {/* SECTION: Why Not ChatGPT? */}
        <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <p className="text-gray-500 text-sm font-medium mb-4 uppercase tracking-wide">
                The obvious question
              </p>
              <h3 className="text-3xl lg:text-4xl font-bold mb-6">
                "Can't I just use ChatGPT or some AI?"
              </h3>
              <p className="text-xl text-gray-400">Yes. You can.</p>
            </AnimatedSection>

            <AnimatedSection className="mb-12">
              <p className="text-lg text-gray-300 text-center mb-8">
                But here's the difference:
              </p>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* ChatGPT */}
                <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">💬</span>
                    <h4 className="text-lg font-bold text-gray-400">
                      ChatGPT answers questions
                    </h4>
                  </div>
                  <ul className="space-y-3 text-gray-500 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-1">•</span>
                      <span>It waits for you to ask the right questions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-1">•</span>
                      <span>It doesn't know your dates, risks, or limits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-1">•</span>
                      <span>It takes no responsibility for consequences</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-1">•</span>
                      <span>It gives different answers every time</span>
                    </li>
                  </ul>
                </div>

                {/* BudgetCopilot */}
                <div className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 rounded-2xl p-6 border border-cyan-500/30 transition-all duration-300 hover:border-cyan-500/50">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🧠</span>
                    <h4 className="text-lg font-bold text-cyan-400">
                      BudgetCopilot makes decisions
                    </h4>
                  </div>
                  <ul className="space-y-3 text-gray-300 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">✓</span>
                      <span>
                        Asks you the right questions, in the right order
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">✓</span>
                      <span>Uses your real numbers (even if estimated)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">✓</span>
                      <span>Evaluates risk, urgency, and consequences</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">✓</span>
                      <span>Gives you one clear action, valid today</span>
                    </li>
                  </ul>
                </div>
              </div>
            </AnimatedSection>

            {/* Short Comparison */}
            <AnimatedSection delay={100}>
              <div className="grid md:grid-cols-2 gap-6 mb-12">
                <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                  <p className="text-gray-500 text-sm mb-3">With ChatGPT:</p>
                  <p className="text-gray-300 italic mb-2">
                    "I have this... what should I do?"
                  </p>
                  <p className="text-gray-500 text-sm">
                    → You interpret, decide, doubt.
                  </p>
                </div>
                <div className="bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-xl p-6 border border-cyan-500/20">
                  <p className="text-cyan-400 text-sm mb-3">
                    With BudgetCopilot:
                  </p>
                  <p className="text-white font-medium mb-2">
                    "Do this today. If not, here's what happens."
                  </p>
                  <p className="text-cyan-400/80 text-sm">→ You act.</p>
                </div>
              </div>
            </AnimatedSection>

            {/* Authority Line */}
            <AnimatedSection className="text-center mb-12" delay={200}>
              <div className="bg-gray-800/30 rounded-2xl p-8 border border-gray-700/50">
                <p className="text-lg text-gray-400 mb-4">
                  ChatGPT is a{' '}
                  <span className="text-gray-300">conversation</span>.
                </p>
                <p className="text-lg text-white font-medium mb-6">
                  BudgetCopilot is a{' '}
                  <span className="text-cyan-400">control</span>.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4 text-sm">
                  <span className="text-gray-500">One chats with you.</span>
                  <span className="text-cyan-400 font-medium">
                    The other directs you.
                  </span>
                </div>
              </div>
            </AnimatedSection>

            {/* Close + CTA */}
            <AnimatedSection className="text-center" delay={300}>
              <p className="text-gray-400 mb-2">
                If you just want ideas, any AI will do.
              </p>
              <p className="text-white font-medium mb-8">
                If you want clarity, you need a system that decides.
              </p>
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0 text-lg px-8 transition-transform hover:scale-105"
                >
                  See what to do today
                </Button>
              </Link>
            </AnimatedSection>
          </div>
        </section>

        {/* SECTION: Who This Is For */}
        <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <div className="max-w-4xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <h3 className="text-3xl lg:text-4xl font-bold mb-4">
                Who This Is For
              </h3>
            </AnimatedSection>

            <div className="grid md:grid-cols-2 gap-8">
              {/* For You */}
              <AnimatedSection delay={0}>
                <div className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 rounded-2xl p-8 border border-cyan-500/30 h-full transition-all duration-300 hover:border-cyan-500/50 hover:-translate-y-1">
                  <h4 className="text-xl font-bold mb-4 text-cyan-400">
                    This is for you if:
                  </h4>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>You earn money</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>You have bills, debts, or financial pressure</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>You don't want to think about money every day</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>
                        You want someone to tell you the right next step
                      </span>
                    </li>
                  </ul>
                </div>
              </AnimatedSection>

              {/* Not For You */}
              <AnimatedSection delay={100}>
                <div className="bg-gray-800/30 rounded-2xl p-8 border border-gray-700/50 h-full transition-all duration-300 hover:border-gray-600 hover:-translate-y-1">
                  <h4 className="text-xl font-bold mb-4 text-gray-400">
                    This is NOT for you if:
                  </h4>
                  <ul className="space-y-3 text-gray-500">
                    <li className="flex items-start gap-3">
                      <span className="text-red-400">✕</span>
                      <span>You enjoy spreadsheets</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-red-400">✕</span>
                      <span>You want full manual control</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-red-400">✕</span>
                      <span>You like tracking for fun</span>
                    </li>
                  </ul>
                  <p className="text-gray-600 text-sm mt-4">
                    BudgetCopilot is made for clarity, not control.
                  </p>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* SECTION: Global Trust Signal */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl lg:text-3xl font-bold mb-4">
              Works anywhere.
            </h3>
            <p className="text-gray-400 mb-6">
              BudgetCopilot doesn't require bank connections. The AI works with:
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <span className="bg-gray-800 px-4 py-2 rounded-full text-sm text-gray-300 transition-all duration-300 hover:bg-gray-700 hover:scale-105">
                📄 PDFs
              </span>
              <span className="bg-gray-800 px-4 py-2 rounded-full text-sm text-gray-300 transition-all duration-300 hover:bg-gray-700 hover:scale-105">
                📸 Screenshots
              </span>
              <span className="bg-gray-800 px-4 py-2 rounded-full text-sm text-gray-300 transition-all duration-300 hover:bg-gray-700 hover:scale-105">
                📊 Excel and CSV files
              </span>
              <span className="bg-gray-800 px-4 py-2 rounded-full text-sm text-gray-300 transition-all duration-300 hover:bg-gray-700 hover:scale-105">
                💬 Simple answers
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-6">
              You stay in control. The AI does the work.
            </p>
          </AnimatedSection>
        </section>

        {/* FINAL CTA */}
        <section className="py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="max-w-4xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 to-purple-600/20 rounded-3xl blur-2xl transition-all duration-500 group-hover:from-cyan-600/30 group-hover:to-purple-600/30"></div>
              <div className="relative bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-12 border border-gray-700/50 text-center transition-all duration-300 hover:border-gray-600">
                <p className="text-gray-400 mb-4">
                  Your finances already need action.
                </p>
                <h3 className="text-3xl lg:text-4xl font-bold mb-8">
                  See what to do today
                </h3>
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0 text-lg px-12 transition-transform hover:scale-105"
                  >
                    See what to do today
                  </Button>
                </Link>
                <p className="text-sm text-gray-500 mt-4">
                  Takes less than 2 minutes
                </p>
              </div>
            </div>
          </AnimatedSection>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧠</span>
              <span className="font-bold">BudgetCopilot</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link
                href="/terms"
                className="hover:text-white transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="hover:text-white transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/pricing"
                className="hover:text-white transition-colors"
              >
                Pricing
              </Link>
            </div>
            <p className="text-sm text-gray-500">© 2024 BudgetCopilot</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
