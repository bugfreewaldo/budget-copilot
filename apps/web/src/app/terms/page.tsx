'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TermsPage(): React.ReactElement {
  const [lang, setLang] = useState<'es' | 'en'>('en');

  const content = {
    es: {
      title: 'Términos de Servicio',
      lastUpdated: 'Última actualización: Diciembre 2024',
      sections: [
        {
          title: '1. Aceptación de Términos',
          content: `Al acceder y utilizar Budget Copilot ("el Servicio"), aceptas estar sujeto a estos Términos de Servicio. Si no estás de acuerdo con alguna parte de estos términos, no debes utilizar nuestro servicio.`,
        },
        {
          title: '2. Descripción del Servicio',
          content: `Budget Copilot es una aplicación de gestión financiera personal que utiliza inteligencia artificial para ayudarte a:

• Categorizar y organizar tus transacciones financieras
• Crear y gestionar presupuestos personales
• Analizar tus patrones de gasto
• Recibir recomendaciones financieras personalizadas
• Establecer y dar seguimiento a metas de ahorro

El servicio es ofrecido "tal cual" y puede estar sujeto a cambios sin previo aviso.`,
        },
        {
          title: '3. Registro y Cuenta',
          content: `Para utilizar Budget Copilot, debes crear una cuenta proporcionando información veraz y actualizada. Eres responsable de:

• Mantener la confidencialidad de tu contraseña
• Todas las actividades que ocurran bajo tu cuenta
• Notificarnos inmediatamente de cualquier uso no autorizado

El servicio básico es gratuito y no requiere tarjeta de crédito para comenzar.`,
        },
        {
          title: '4. Uso Aceptable',
          content: `Te comprometes a no utilizar el servicio para:

• Actividades ilegales o fraudulentas
• Violar derechos de propiedad intelectual
• Transmitir malware o código malicioso
• Intentar acceder a sistemas o datos sin autorización
• Abusar, acosar o amenazar a otros usuarios
• Interferir con el funcionamiento del servicio`,
        },
        {
          title: '5. Datos y Privacidad',
          content: `Tus datos financieros son procesados localmente en tu dispositivo cuando es posible. Para más información sobre cómo recopilamos, usamos y protegemos tus datos, consulta nuestra Política de Privacidad.

Budget Copilot no vende ni comparte tu información financiera con terceros para fines de marketing.`,
        },
        {
          title: '6. Planes y Pagos',
          content: `Budget Copilot ofrece planes gratuitos y de pago:

• Plan Gratuito: Funcionalidades básicas sin costo
• Plan Pro: Funcionalidades avanzadas con cuota mensual
• Plan Premium: Todas las funcionalidades con soporte prioritario

Los pagos se procesan de forma segura a través de proveedores certificados. Consulta nuestra Política de Reembolsos para más detalles.`,
        },
        {
          title: '7. Limitación de Responsabilidad',
          content: `Budget Copilot es una herramienta de ayuda para la gestión financiera personal. NO somos asesores financieros certificados y no proporcionamos asesoramiento de inversiones.

En la medida permitida por la ley:

• No garantizamos que el servicio esté libre de errores
• No somos responsables por decisiones financieras tomadas basándose en nuestras sugerencias
• No garantizamos resultados financieros específicos
• Nuestra responsabilidad máxima se limita al monto pagado por el servicio`,
        },
        {
          title: '8. Propiedad Intelectual',
          content: `Todo el contenido, diseño, código y funcionalidad de Budget Copilot son propiedad de Budget Copilot y están protegidos por leyes de propiedad intelectual.

Conservas todos los derechos sobre los datos financieros que ingresas en la plataforma.`,
        },
        {
          title: '9. Terminación',
          content: `Puedes cancelar tu cuenta en cualquier momento desde la configuración de tu perfil. Nos reservamos el derecho de suspender o terminar cuentas que violen estos términos.

Tras la cancelación:
• Tus datos serán eliminados de acuerdo con nuestra política de retención
• Perderás acceso a todas las funcionalidades del servicio
• Los pagos realizados no son reembolsables, salvo lo indicado en nuestra Política de Reembolsos`,
        },
        {
          title: '10. Modificaciones',
          content: `Podemos actualizar estos términos ocasionalmente. Te notificaremos cambios significativos por correo electrónico o mediante aviso en la aplicación. El uso continuado del servicio después de los cambios constituye aceptación de los nuevos términos.`,
        },
        {
          title: '11. Ley Aplicable',
          content: `Estos términos se rigen por las leyes de la República de Panamá. Cualquier disputa será resuelta en los tribunales de la Ciudad de Panamá.`,
        },
        {
          title: '12. Contacto',
          content: `Para preguntas sobre estos términos, contáctanos en:

Email: legal@budgetcopilot.app
Dirección: Ciudad de Panamá, Panamá`,
        },
      ],
    },
    en: {
      title: 'Terms of Service',
      lastUpdated: 'Last Updated: December 2024',
      sections: [
        {
          title: '1. Acceptance of Terms',
          content: `By accessing and using Budget Copilot ("the Service"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you should not use our service.`,
        },
        {
          title: '2. Description of Service',
          content: `Budget Copilot is a personal financial management application that uses artificial intelligence to help you:

• Categorize and organize your financial transactions
• Create and manage personal budgets
• Analyze your spending patterns
• Receive personalized financial recommendations
• Set and track savings goals

The service is provided "as is" and may be subject to changes without notice.`,
        },
        {
          title: '3. Registration and Account',
          content: `To use Budget Copilot, you must create an account providing truthful and up-to-date information. You are responsible for:

• Maintaining the confidentiality of your password
• All activities that occur under your account
• Notifying us immediately of any unauthorized use

The basic service is free and does not require a credit card to get started.`,
        },
        {
          title: '4. Acceptable Use',
          content: `You agree not to use the service for:

• Illegal or fraudulent activities
• Violating intellectual property rights
• Transmitting malware or malicious code
• Attempting to access systems or data without authorization
• Abusing, harassing, or threatening other users
• Interfering with the operation of the service`,
        },
        {
          title: '5. Data and Privacy',
          content: `Your financial data is processed locally on your device when possible. For more information on how we collect, use, and protect your data, please see our Privacy Policy.

Budget Copilot does not sell or share your financial information with third parties for marketing purposes.`,
        },
        {
          title: '6. Plans and Payments',
          content: `Budget Copilot offers free and paid plans:

• Free Plan: Basic features at no cost
• Pro Plan: Advanced features with monthly fee
• Premium Plan: All features with priority support

Payments are processed securely through certified providers. See our Refund Policy for more details.`,
        },
        {
          title: '7. Limitation of Liability',
          content: `Budget Copilot is a tool to help with personal financial management. We are NOT certified financial advisors and do not provide investment advice.

To the extent permitted by law:

• We do not guarantee that the service will be error-free
• We are not responsible for financial decisions made based on our suggestions
• We do not guarantee specific financial results
• Our maximum liability is limited to the amount paid for the service`,
        },
        {
          title: '8. Intellectual Property',
          content: `All content, design, code, and functionality of Budget Copilot are owned by Budget Copilot and are protected by intellectual property laws.

You retain all rights to the financial data you enter into the platform.`,
        },
        {
          title: '9. Termination',
          content: `You can cancel your account at any time from your profile settings. We reserve the right to suspend or terminate accounts that violate these terms.

Upon cancellation:
• Your data will be deleted according to our retention policy
• You will lose access to all service features
• Payments made are non-refundable, except as indicated in our Refund Policy`,
        },
        {
          title: '10. Modifications',
          content: `We may update these terms occasionally. We will notify you of significant changes by email or through a notice in the application. Continued use of the service after changes constitutes acceptance of the new terms.`,
        },
        {
          title: '11. Governing Law',
          content: `These terms are governed by the laws of the Republic of Panama. Any dispute will be resolved in the courts of Panama City.`,
        },
        {
          title: '12. Contact',
          content: `For questions about these terms, contact us at:

Email: legal@budgetcopilot.app
Address: Panama City, Panama`,
        },
      ],
    },
  };

  const t = content[lang];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800/50 backdrop-blur-sm sticky top-0 z-50 bg-gray-950/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm transition-all ${
                    lang === 'es'
                      ? 'bg-cyan-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ES
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm transition-all ${
                    lang === 'en'
                      ? 'bg-cyan-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          {t.title}
        </h1>
        <p className="text-gray-500 text-sm sm:text-base mb-6 sm:mb-8">
          {t.lastUpdated}
        </p>

        <div className="space-y-4 sm:space-y-8">
          {t.sections.map((section, index) => (
            <section
              key={index}
              className="bg-gray-900/50 rounded-xl p-4 sm:p-6 border border-gray-800"
            >
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-cyan-400">
                {section.title}
              </h2>
              <div className="text-gray-300 whitespace-pre-line leading-relaxed text-sm sm:text-base">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        {/* Footer Links */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-wrap gap-6 text-sm text-gray-400">
          <Link
            href="/privacy"
            className="hover:text-cyan-400 transition-colors"
          >
            {lang === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
          </Link>
          <Link
            href="/refunds"
            className="hover:text-cyan-400 transition-colors"
          >
            {lang === 'es' ? 'Política de Reembolsos' : 'Refund Policy'}
          </Link>
          <Link href="/" className="hover:text-cyan-400 transition-colors">
            {lang === 'es' ? 'Volver al Inicio' : 'Back to Home'}
          </Link>
        </div>
      </main>
    </div>
  );
}
