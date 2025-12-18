'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@budget-copilot/ui/button';

function MobileMenu({
  isOpen,
  onClose,
  lang,
}: {
  isOpen: boolean;
  onClose: () => void;
  lang: 'es' | 'en';
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-72 bg-gray-900 border-l border-gray-800 z-50 p-6 transform transition-transform">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
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

        <nav className="mt-12 flex flex-col gap-4">
          <Link
            href="/login"
            className="text-gray-300 hover:text-cyan-400 transition-colors text-lg py-2"
            onClick={onClose}
          >
            {lang === 'es' ? 'Iniciar Sesión' : 'Sign In'}
          </Link>
          <Link
            href="/register"
            className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-center py-3 rounded-xl font-semibold"
            onClick={onClose}
          >
            {lang === 'es' ? 'Registrarse' : 'Sign Up'}
          </Link>
        </nav>
      </div>
    </>
  );
}

export default function PricingPage(): React.ReactElement | null {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(
    'monthly'
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const content = {
    es: {
      title: 'Precios Simples',
      subtitle: 'Empieza gratis. Actualiza cuando quieras.',
      monthly: 'Mensual',
      yearly: 'Anual',
      yearlyDiscount: '2 meses gratis',
      perMonth: '/mes',
      perYear: '/año',
      popular: 'Más Popular',
      getStarted: 'Comenzar Gratis',
      upgrade: 'Actualizar a Pro',
      goPremium: 'Ir Premium',
      currentPlan: 'Plan Actual',
      faq: {
        title: 'Preguntas Frecuentes',
        questions: [
          {
            q: '¿Necesito tarjeta de crédito para empezar?',
            a: 'No. El plan gratuito no requiere tarjeta de crédito. Solo regístrate y comienza a usar Budget Copilot.',
          },
          {
            q: '¿Puedo cancelar en cualquier momento?',
            a: 'Sí. Puedes cancelar tu suscripción cuando quieras desde tu perfil. No hay contratos ni compromisos.',
          },
          {
            q: '¿Qué pasa si cancelo mi plan Pro?',
            a: 'Conservarás acceso a las funciones Pro hasta el fin de tu período de facturación. Luego volverás al plan gratuito automáticamente.',
          },
          {
            q: '¿Ofrecen reembolsos?',
            a: 'Sí. Ofrecemos garantía de satisfacción de 14 días. Si no estás satisfecho, te devolvemos tu dinero.',
          },
          {
            q: '¿Mis datos están seguros?',
            a: 'Absolutamente. Tus datos financieros se procesan localmente cuando es posible y nunca vendemos tu información.',
          },
        ],
      },
      plans: {
        free: {
          name: 'Gratis',
          price: '$0',
          description: 'Perfecto para empezar a organizar tus finanzas',
          features: [
            'Hasta 3 cuentas bancarias',
            'Categorización automática con IA',
            'Resumen diario del clima financiero',
            'Hasta 100 transacciones/mes',
            'Historial de 3 meses',
            'Soporte por email',
          ],
          notIncluded: [
            'Capturas ilimitadas',
            'Análisis de deudas',
            'Metas de ahorro ilimitadas',
            'Exportar a Excel/PDF',
            'Soporte prioritario',
          ],
        },
        pro: {
          name: 'Pro',
          price: '$1.99',
          priceYearly: '$19.99',
          description: 'Para quienes quieren control total de su dinero',
          features: [
            'Cuentas bancarias ilimitadas',
            'Transacciones ilimitadas',
            'Capturas y PDFs ilimitados',
            'Historial completo (sin límite)',
            'Análisis de deudas con estrategias',
            '5 metas de ahorro',
            'Alertas personalizadas',
            'Exportar a Excel/PDF',
            'Soporte prioritario (24h)',
            'Sin anuncios',
          ],
          notIncluded: ['API access', 'Múltiples perfiles familiares'],
        },
        premium: {
          name: 'Premium',
          price: '$4.99',
          priceYearly: '$49.99',
          description: 'Para familias y power users',
          features: [
            'Todo lo de Pro, más:',
            'Hasta 5 perfiles familiares',
            'Presupuestos compartidos',
            'Metas de ahorro ilimitadas',
            'Acceso API para desarrolladores',
            'Consultas IA ilimitadas',
            'Reportes fiscales automáticos',
            'Soporte VIP (respuesta en 4h)',
            'Acceso anticipado a nuevas funciones',
            'Sesión de onboarding personalizada',
          ],
          notIncluded: [],
        },
      },
    },
    en: {
      title: 'Simple Pricing',
      subtitle: 'Start free. Upgrade when you want.',
      monthly: 'Monthly',
      yearly: 'Yearly',
      yearlyDiscount: '2 months free',
      perMonth: '/month',
      perYear: '/year',
      popular: 'Most Popular',
      getStarted: 'Get Started Free',
      upgrade: 'Upgrade to Pro',
      goPremium: 'Go Premium',
      currentPlan: 'Current Plan',
      faq: {
        title: 'Frequently Asked Questions',
        questions: [
          {
            q: 'Do I need a credit card to start?',
            a: "No. The free plan doesn't require a credit card. Just sign up and start using Budget Copilot.",
          },
          {
            q: 'Can I cancel anytime?',
            a: 'Yes. You can cancel your subscription anytime from your profile. No contracts or commitments.',
          },
          {
            q: 'What happens if I cancel my Pro plan?',
            a: "You'll keep access to Pro features until the end of your billing period. Then you'll automatically return to the free plan.",
          },
          {
            q: 'Do you offer refunds?',
            a: "Yes. We offer a 14-day satisfaction guarantee. If you're not satisfied, we'll refund your money.",
          },
          {
            q: 'Is my data secure?',
            a: 'Absolutely. Your financial data is processed locally when possible and we never sell your information.',
          },
        ],
      },
      plans: {
        free: {
          name: 'Free',
          price: '$0',
          description: 'Perfect to start organizing your finances',
          features: [
            'Up to 3 bank accounts',
            'Automatic AI categorization',
            'Daily financial weather summary',
            'Up to 100 transactions/month',
            '3 months history',
            'Email support',
          ],
          notIncluded: [
            'Unlimited screenshots',
            'Debt analysis',
            'Unlimited savings goals',
            'Export to Excel/PDF',
            'Priority support',
          ],
        },
        pro: {
          name: 'Pro',
          price: '$1.99',
          priceYearly: '$19.99',
          description: 'For those who want total control of their money',
          features: [
            'Unlimited bank accounts',
            'Unlimited transactions',
            'Unlimited screenshots and PDFs',
            'Complete history (no limit)',
            'Debt analysis with strategies',
            '5 savings goals',
            'Custom alerts',
            'Export to Excel/PDF',
            'Priority support (24h)',
            'No ads',
          ],
          notIncluded: ['API access', 'Multiple family profiles'],
        },
        premium: {
          name: 'Premium',
          price: '$4.99',
          priceYearly: '$49.99',
          description: 'For families and power users',
          features: [
            'Everything in Pro, plus:',
            'Up to 5 family profiles',
            'Shared budgets',
            'Unlimited savings goals',
            'API access for developers',
            'Unlimited AI queries',
            'Automatic tax reports',
            'VIP support (4h response)',
            'Early access to new features',
            'Personalized onboarding session',
          ],
          notIncluded: [],
        },
      },
    },
  };

  const t = content[lang];

  const getPrice = (plan: 'pro' | 'premium') => {
    if (billingPeriod === 'yearly') {
      return t.plans[plan].priceYearly;
    }
    return t.plans[plan].price;
  };

  const getPeriodLabel = () => {
    return billingPeriod === 'yearly' ? t.perYear : t.perMonth;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-1/4 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Budget Copilot
              </span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setLang('es')}
                  className={`px-2 sm:px-3 py-1 rounded-md text-sm transition-all ${
                    lang === 'es'
                      ? 'bg-cyan-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ES
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`px-2 sm:px-3 py-1 rounded-md text-sm transition-all ${
                    lang === 'en'
                      ? 'bg-cyan-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>
              <Link
                href="/login"
                className="hidden md:block text-gray-400 hover:text-white transition-colors text-sm"
              >
                {lang === 'es' ? 'Iniciar Sesión' : 'Sign In'}
              </Link>
              <Link href="/register" className="hidden md:block">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0"
                >
                  {lang === 'es' ? 'Registrarse' : 'Sign Up'}
                </Button>
              </Link>
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 text-gray-400 hover:text-white"
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
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        lang={lang}
      />

      {/* Main Content */}
      <main className="relative z-10 py-8 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Title */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              {t.title}
            </h1>
            <p className="text-base sm:text-xl text-gray-400 mb-6 sm:mb-8">
              {t.subtitle}
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-4 bg-gray-800/50 rounded-2xl sm:rounded-full p-2">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`w-full sm:w-auto px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.monthly}
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`w-full sm:w-auto px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  billingPeriod === 'yearly'
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.yearly}
                <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                  {t.yearlyDiscount}
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <div className="bg-gray-900/50 rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-gray-700 transition-all">
              <h3 className="text-xl sm:text-2xl font-bold mb-2">
                {t.plans.free.name}
              </h3>
              <p className="text-gray-400 text-sm mb-4 sm:mb-6">
                {t.plans.free.description}
              </p>
              <div className="mb-4 sm:mb-6">
                <span className="text-4xl sm:text-5xl font-bold">
                  {t.plans.free.price}
                </span>
                <span className="text-gray-500">{t.perMonth}</span>
              </div>
              <Link href="/register">
                <Button
                  className="w-full mb-8 border-gray-600 text-white hover:bg-gray-800"
                  variant="outline"
                >
                  {t.getStarted}
                </Button>
              </Link>
              <ul className="space-y-3">
                {t.plans.free.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
                {t.plans.free.notIncluded.map((feature, i) => (
                  <li
                    key={`not-${i}`}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span className="text-gray-600 mt-0.5">✗</span>
                    <span className="text-gray-500">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro Plan - Highlighted */}
            <div className="relative bg-gradient-to-b from-cyan-900/30 to-purple-900/30 rounded-2xl p-6 sm:p-8 border border-cyan-500/50 hover:border-cyan-400/50 transition-all transform md:-translate-y-4 order-first md:order-none">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-medium px-4 py-1 rounded-full whitespace-nowrap">
                  {t.popular}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 text-cyan-400 mt-2 md:mt-0">
                {t.plans.pro.name}
              </h3>
              <p className="text-gray-400 text-sm mb-4 sm:mb-6">
                {t.plans.pro.description}
              </p>
              <div className="mb-4 sm:mb-6">
                <span className="text-4xl sm:text-5xl font-bold">
                  {getPrice('pro')}
                </span>
                <span className="text-gray-500">{getPeriodLabel()}</span>
              </div>
              <Link href="/register">
                <Button className="w-full mb-8 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0">
                  {t.upgrade}
                </Button>
              </Link>
              <ul className="space-y-3">
                {t.plans.pro.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-cyan-400 mt-0.5">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
                {t.plans.pro.notIncluded.map((feature, i) => (
                  <li
                    key={`not-${i}`}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span className="text-gray-600 mt-0.5">✗</span>
                    <span className="text-gray-500">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium Plan */}
            <div className="bg-gray-900/50 rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-purple-500/50 transition-all">
              <h3 className="text-xl sm:text-2xl font-bold mb-2 text-purple-400">
                {t.plans.premium.name}
              </h3>
              <p className="text-gray-400 text-sm mb-4 sm:mb-6">
                {t.plans.premium.description}
              </p>
              <div className="mb-4 sm:mb-6">
                <span className="text-4xl sm:text-5xl font-bold">
                  {getPrice('premium')}
                </span>
                <span className="text-gray-500">{getPeriodLabel()}</span>
              </div>
              <Link href="/register">
                <Button
                  className="w-full mb-8 border-purple-500 text-purple-400 hover:bg-purple-500/10"
                  variant="outline"
                >
                  {t.goPremium}
                </Button>
              </Link>
              <ul className="space-y-3">
                {t.plans.premium.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 sm:gap-8 mt-10 sm:mt-16 text-gray-500 text-sm">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">🔒</span>
              <span>
                {lang === 'es'
                  ? 'Pago seguro con Stripe'
                  : 'Secure payment with Stripe'}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">↩️</span>
              <span>
                {lang === 'es' ? 'Garantía de 14 días' : '14-day guarantee'}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">🚫</span>
              <span>
                {lang === 'es' ? 'Cancela cuando quieras' : 'Cancel anytime'}
              </span>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-16 sm:mt-24 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
              {t.faq.title}
            </h2>
            <div className="space-y-4">
              {t.faq.questions.map((item, i) => (
                <details
                  key={i}
                  className="group bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                    <span className="font-medium text-gray-200">{item.q}</span>
                    <span className="text-gray-500 group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <div className="px-6 pb-6 text-gray-400">{item.a}</div>
                </details>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-16 sm:mt-24 text-center px-4">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              {lang === 'es'
                ? '¿Listo para tomar control de tu dinero?'
                : 'Ready to take control of your money?'}
            </h2>
            <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">
              {lang === 'es'
                ? 'Empieza gratis hoy. Sin tarjeta de crédito requerida.'
                : 'Start free today. No credit card required.'}
            </p>
            <Link href="/register">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0 text-base sm:text-lg px-8 sm:px-12"
              >
                {lang === 'es' ? 'Crear Cuenta Gratis' : 'Create Free Account'}
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <Link
              href="/terms"
              className="hover:text-cyan-400 transition-colors"
            >
              {lang === 'es' ? 'Términos' : 'Terms'}
            </Link>
            <Link
              href="/privacy"
              className="hover:text-cyan-400 transition-colors"
            >
              {lang === 'es' ? 'Privacidad' : 'Privacy'}
            </Link>
            <Link
              href="/refunds"
              className="hover:text-cyan-400 transition-colors"
            >
              {lang === 'es' ? 'Reembolsos' : 'Refunds'}
            </Link>
            <Link href="/" className="hover:text-cyan-400 transition-colors">
              {lang === 'es' ? 'Inicio' : 'Home'}
            </Link>
          </div>
          <p className="text-center text-gray-600 text-sm mt-4">
            © 2024 Budget Copilot. {lang === 'es' ? 'Hecho con' : 'Made with'}{' '}
            💜 {lang === 'es' ? 'para LATAM' : 'for LATAM'}
          </p>
        </div>
      </footer>
    </div>
  );
}
