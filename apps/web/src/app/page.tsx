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
                Como Funciona
              </Link>
              <Link
                href="#examples"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-gray-300 hover:text-white py-2"
              >
                Ejemplos
              </Link>
              <Link
                href="/pricing"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-gray-300 hover:text-white py-2"
              >
                Precios
              </Link>
              <div className="border-t border-gray-800 pt-4 mt-4 space-y-3">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-gray-300 hover:text-white py-2"
                >
                  Iniciar Sesion
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0">
                    Ver qué hacer hoy
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
                Como Funciona
              </Link>
              <Link
                href="#examples"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Ejemplos
              </Link>
              <Link
                href="/pricing"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Precios
              </Link>
              <Link
                href="/login"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Iniciar Sesion
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0"
                >
                  Ver qué hacer hoy
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
              <span className="text-sm text-gray-300">
                Motor de Decisiones con IA
              </span>
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
              Deja de adivinar.
              <span className="block bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Haz exactamente lo que tu dinero necesita hoy.
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
              BudgetCopilot usa IA para hacerte las preguntas correctas,
              analizar tus finanzas, y emitir una instruccion financiera clara
              cada dia — que pagar, que gastar, o cuando parar.
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
              Funciona en todo el mundo. Sube estados de cuenta, capturas o
              Excel. Sin conexion bancaria requerida.
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
                  Ver qué hacer hoy
                </Button>
              </Link>
              <Link href="#how">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-gray-600 text-gray-300 hover:bg-gray-800 text-lg transition-transform hover:scale-105"
                >
                  Ver como funciona
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION: What This Is */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <p className="text-cyan-400 text-sm font-medium mb-4">
              ESTO NO ES UNA APP DE PRESUPUESTO
            </p>
            <h3 className="text-3xl lg:text-4xl font-bold mb-6">
              BudgetCopilot es un motor de decisiones financieras.
            </h3>
            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              En lugar de dashboards, graficas o configuracion interminable, una
              IA te guia a traves de una entrevista financiera corta — y luego
              te dice exactamente que hacer.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-gray-500">
              <span className="flex items-center gap-2">
                <span className="text-red-400">✕</span> Sin hojas de calculo
              </span>
              <span className="flex items-center gap-2">
                <span className="text-red-400">✕</span> Sin analisis manual
              </span>
              <span className="flex items-center gap-2">
                <span className="text-red-400">✕</span> Sin adivinanzas
              </span>
            </div>
          </AnimatedSection>
        </section>

        {/* SECTION: How It Works */}
        <section id="how" className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <h3 className="text-3xl lg:text-4xl font-bold mb-4">
                Como Funciona BudgetCopilot
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
                    La IA te hace preguntas simples
                  </h4>
                  <p className="text-gray-400">
                    Cuanto ganas, que cuentas tienes, que debes, cuanto gastas.
                    Responde lo que sepas — los estimados funcionan.
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
                    Subes lo que ya tienes (opcional)
                  </h4>
                  <p className="text-gray-400">
                    PDFs, capturas de pantalla, archivos Excel, CSVs. La IA los
                    lee y llena los espacios.
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
                    Recibes la instruccion financiera de hoy
                  </h4>
                  <p className="text-gray-400">
                    Una accion clara — con consecuencias — valida solo por hoy.
                  </p>
                </div>
              </AnimatedSection>
            </div>

            <AnimatedSection
              className="text-center text-gray-500 mt-8"
              delay={300}
            >
              <p>Eso es todo.</p>
            </AnimatedSection>
          </div>
        </section>

        {/* SECTION: What Makes This Different */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <div className="max-w-4xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <h3 className="text-3xl lg:text-4xl font-bold mb-4">
                Que Hace Esto Diferente
              </h3>
              <p className="text-lg text-gray-400">
                La mayoria de apps financieras te hacen hacer el trabajo.
                BudgetCopilot no.
              </p>
            </AnimatedSection>

            <div className="grid md:grid-cols-2 gap-6">
              <AnimatedSection delay={0}>
                <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50 h-full transition-all duration-300 hover:border-gray-600 hover:-translate-y-1">
                  <div className="text-2xl mb-3">🤖</div>
                  <h4 className="text-lg font-bold mb-2 text-white">
                    La IA lidera el proceso
                  </h4>
                  <p className="text-gray-400 text-sm">
                    Nunca enfrentas una pantalla en blanco. Nunca te bloqueas
                    por datos faltantes.
                  </p>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50 h-full transition-all duration-300 hover:border-gray-600 hover:-translate-y-1">
                  <div className="text-2xl mb-3">🌍</div>
                  <h4 className="text-lg font-bold mb-2 text-white">
                    Funciona aunque:
                  </h4>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• No recuerdes montos exactos</li>
                    <li>• Solo tengas numeros aproximados</li>
                    <li>• No quieras conectar tu banco</li>
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
                Lo Que Realmente Veras
              </h3>
              <p className="text-lg text-gray-400">
                Estos son ejemplos de instrucciones reales que BudgetCopilot
                emite:
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
                        "No excedas $23/dia hasta el viernes. Cualquier cosa
                        arriba de esto pone tu cuenta de luz en riesgo."
                      </p>
                      <p className="text-amber-400/80 text-sm">
                        Valido por 14 horas
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
                        "Paga $312 extra a tu tarjeta Chase hoy. Esto acorta tu
                        fecha libre de deuda por 41 dias."
                      </p>
                      <p className="text-green-400/80 text-sm">
                        Valido por 8 horas
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
                        "CONGELA todo gasto hasta el dia de pago. Estas $186
                        corto en cuentas proximas."
                      </p>
                      <p className="text-red-400/80 text-sm">
                        Valido por 6 horas
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            </div>

            <AnimatedSection className="text-center mt-8 space-y-2" delay={300}>
              <p className="text-gray-500">Sin graficas requeridas.</p>
              <p className="text-gray-500">Sin interpretacion necesaria.</p>
            </AnimatedSection>
          </div>
        </section>

        {/* SECTION: Why This Works */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <AnimatedSection className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl lg:text-4xl font-bold mb-6">
              Por Que Esto Funciona
            </h3>
            <p className="text-xl text-gray-400 mb-8">
              La mayoria de herramientas te dan informacion.
              <br />
              <span className="text-white font-medium">
                BudgetCopilot te da direccion.
              </span>
            </p>

            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="bg-gray-800/30 rounded-xl p-5 transition-all duration-300 hover:bg-gray-800/50 hover:-translate-y-1">
                <div className="text-cyan-400 font-bold mb-2">
                  Una instruccion a la vez
                </div>
                <p className="text-gray-400 text-sm">
                  Sin paralisis de analisis. Una accion clara.
                </p>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-5 transition-all duration-300 hover:bg-gray-800/50 hover:-translate-y-1">
                <div className="text-cyan-400 font-bold mb-2">
                  Consecuencias claras
                </div>
                <p className="text-gray-400 text-sm">
                  Sabes exactamente que pasa si no actuas.
                </p>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-5 transition-all duration-300 hover:bg-gray-800/50 hover:-translate-y-1">
                <div className="text-cyan-400 font-bold mb-2">
                  Expira diario
                </div>
                <p className="text-gray-400 text-sm">
                  Te entrena a actuar, no a explorar.
                </p>
              </div>
            </div>

            <p className="text-gray-500 mt-8">
              O sigues la instruccion — o aceptas el riesgo.
            </p>
          </AnimatedSection>
        </section>

        {/* SECTION: Why Not ChatGPT? */}
        <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <AnimatedSection className="text-center mb-12">
              <p className="text-gray-500 text-sm font-medium mb-4 uppercase tracking-wide">
                La pregunta obvia
              </p>
              <h3 className="text-3xl lg:text-4xl font-bold mb-6">
                "¿No puedo simplemente usar ChatGPT o una IA?"
              </h3>
              <p className="text-xl text-gray-400">Si. Puedes.</p>
            </AnimatedSection>

            <AnimatedSection className="mb-12">
              <p className="text-lg text-gray-300 text-center mb-8">
                Pero aqui esta la diferencia:
              </p>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* ChatGPT */}
                <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">💬</span>
                    <h4 className="text-lg font-bold text-gray-400">
                      ChatGPT responde preguntas
                    </h4>
                  </div>
                  <ul className="space-y-3 text-gray-500 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-1">•</span>
                      <span>Espera que tu hagas las preguntas correctas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-1">•</span>
                      <span>
                        No conoce tus fechas, tus riesgos ni tus limites
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-1">•</span>
                      <span>No se responsabiliza por las consecuencias</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-1">•</span>
                      <span>Da respuestas diferentes cada vez</span>
                    </li>
                  </ul>
                </div>

                {/* BudgetCopilot */}
                <div className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 rounded-2xl p-6 border border-cyan-500/30 transition-all duration-300 hover:border-cyan-500/50">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🧠</span>
                    <h4 className="text-lg font-bold text-cyan-400">
                      BudgetCopilot toma decisiones
                    </h4>
                  </div>
                  <ul className="space-y-3 text-gray-300 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">✓</span>
                      <span>
                        Te hace las preguntas correctas, en el orden correcto
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">✓</span>
                      <span>
                        Usa tus numeros reales (aunque sean estimados)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">✓</span>
                      <span>Evalua riesgo, urgencia y consecuencias</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">✓</span>
                      <span>Te da una sola accion clara, valida hoy</span>
                    </li>
                  </ul>
                </div>
              </div>
            </AnimatedSection>

            {/* Short Comparison */}
            <AnimatedSection delay={100}>
              <div className="grid md:grid-cols-2 gap-6 mb-12">
                <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                  <p className="text-gray-500 text-sm mb-3">Con ChatGPT:</p>
                  <p className="text-gray-300 italic mb-2">
                    "Tengo esto... ¿que deberia hacer?"
                  </p>
                  <p className="text-gray-500 text-sm">
                    → Interpretas, decides, dudas.
                  </p>
                </div>
                <div className="bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-xl p-6 border border-cyan-500/20">
                  <p className="text-cyan-400 text-sm mb-3">
                    Con BudgetCopilot:
                  </p>
                  <p className="text-white font-medium mb-2">
                    "Haz esto hoy. Si no, esto es lo que pasa."
                  </p>
                  <p className="text-cyan-400/80 text-sm">→ Actuas.</p>
                </div>
              </div>
            </AnimatedSection>

            {/* Authority Line */}
            <AnimatedSection className="text-center mb-12" delay={200}>
              <div className="bg-gray-800/30 rounded-2xl p-8 border border-gray-700/50">
                <p className="text-lg text-gray-400 mb-4">
                  ChatGPT es un copiloto de{' '}
                  <span className="text-gray-300">conversacion</span>.
                </p>
                <p className="text-lg text-white font-medium mb-6">
                  BudgetCopilot es un sistema de{' '}
                  <span className="text-cyan-400">control</span>.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4 text-sm">
                  <span className="text-gray-500">Uno conversa contigo.</span>
                  <span className="text-cyan-400 font-medium">
                    El otro te dirige.
                  </span>
                </div>
              </div>
            </AnimatedSection>

            {/* Close + CTA */}
            <AnimatedSection className="text-center" delay={300}>
              <p className="text-gray-400 mb-2">
                Si solo quieres ideas, cualquier IA sirve.
              </p>
              <p className="text-white font-medium mb-8">
                Si quieres claridad, necesitas un sistema que decida.
              </p>
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0 text-lg px-8 transition-transform hover:scale-105"
                >
                  Ver que hacer hoy
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
                Para Quien Es Esto
              </h3>
            </AnimatedSection>

            <div className="grid md:grid-cols-2 gap-8">
              {/* For You */}
              <AnimatedSection delay={0}>
                <div className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 rounded-2xl p-8 border border-cyan-500/30 h-full transition-all duration-300 hover:border-cyan-500/50 hover:-translate-y-1">
                  <h4 className="text-xl font-bold mb-4 text-cyan-400">
                    Esto es para ti si:
                  </h4>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>Ganas dinero</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>Tienes cuentas, deudas o presion financiera</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>No quieres pensar en dinero todos los dias</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>
                        Quieres que alguien te diga el siguiente paso correcto
                      </span>
                    </li>
                  </ul>
                </div>
              </AnimatedSection>

              {/* Not For You */}
              <AnimatedSection delay={100}>
                <div className="bg-gray-800/30 rounded-2xl p-8 border border-gray-700/50 h-full transition-all duration-300 hover:border-gray-600 hover:-translate-y-1">
                  <h4 className="text-xl font-bold mb-4 text-gray-400">
                    Esto NO es para ti si:
                  </h4>
                  <ul className="space-y-3 text-gray-500">
                    <li className="flex items-start gap-3">
                      <span className="text-red-400">✕</span>
                      <span>Disfrutas las hojas de calculo</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-red-400">✕</span>
                      <span>Quieres control manual total</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-red-400">✕</span>
                      <span>Te gusta trackear por diversion</span>
                    </li>
                  </ul>
                  <p className="text-gray-600 text-sm mt-4">
                    BudgetCopilot esta hecho para claridad, no control.
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
              Funciona en cualquier lugar.
            </h3>
            <p className="text-gray-400 mb-6">
              BudgetCopilot no requiere conexiones bancarias. La IA trabaja con:
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <span className="bg-gray-800 px-4 py-2 rounded-full text-sm text-gray-300 transition-all duration-300 hover:bg-gray-700 hover:scale-105">
                📄 PDFs
              </span>
              <span className="bg-gray-800 px-4 py-2 rounded-full text-sm text-gray-300 transition-all duration-300 hover:bg-gray-700 hover:scale-105">
                📸 Capturas de pantalla
              </span>
              <span className="bg-gray-800 px-4 py-2 rounded-full text-sm text-gray-300 transition-all duration-300 hover:bg-gray-700 hover:scale-105">
                📊 Archivos Excel y CSV
              </span>
              <span className="bg-gray-800 px-4 py-2 rounded-full text-sm text-gray-300 transition-all duration-300 hover:bg-gray-700 hover:scale-105">
                💬 Respuestas simples
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-6">
              Tu mantienes el control. La IA hace el trabajo.
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
                  Tus finanzas ya requieren accion.
                </p>
                <h3 className="text-3xl lg:text-4xl font-bold mb-8">
                  Ver qué hacer hoy
                </h3>
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0 text-lg px-12 transition-transform hover:scale-105"
                  >
                    Ver qué hacer hoy
                  </Button>
                </Link>
                <p className="text-sm text-gray-500 mt-4">
                  Toma menos de 2 minutos
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
                Terminos
              </Link>
              <Link
                href="/privacy"
                className="hover:text-white transition-colors"
              >
                Privacidad
              </Link>
              <Link
                href="/pricing"
                className="hover:text-white transition-colors"
              >
                Precios
              </Link>
            </div>
            <p className="text-sm text-gray-500">© 2024 BudgetCopilot</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
