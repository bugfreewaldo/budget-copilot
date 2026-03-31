'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PrivacyPage(): React.ReactElement {
  const [lang, setLang] = useState<'es' | 'en'>('en');

  const content = {
    es: {
      title: 'Política de Privacidad',
      lastUpdated: 'Última actualización: Diciembre 2024',
      intro:
        'En Budget Copilot, tu privacidad es nuestra prioridad. Esta política explica cómo recopilamos, usamos y protegemos tu información personal y financiera.',
      sections: [
        {
          title: '1. Información que Recopilamos',
          content: `Recopilamos los siguientes tipos de información:

**Información de la Cuenta:**
• Correo electrónico
• Nombre (opcional)
• Contraseña (almacenada de forma segura con hash)

**Datos Financieros:**
• Transacciones que ingresas manualmente
• Datos extraídos de capturas de pantalla o PDFs
• Categories and budgets you set up
• Savings goals

**Datos de Uso:**
• Cómo interactúas con la aplicación
• Preferencias y configuraciones
• Información del dispositivo (para soporte técnico)`,
        },
        {
          title: '2. Procesamiento Local',
          content: `Budget Copilot está diseñado con privacidad por defecto:

• Tus datos financieros se procesan localmente en tu dispositivo cuando es posible
• Las capturas de pantalla y PDFs se analizan localmente antes de subirse
• Solo enviamos datos mínimos a nuestros servidores cuando es necesario
• No almacenamos tus credenciales bancarias - nunca las solicitamos`,
        },
        {
          title: '3. Cómo Usamos tu Información',
          content: `Usamos tu información para:

• Proporcionar y mejorar el servicio de gestión financiera
• Generar análisis y recomendaciones personalizadas
• Enviar notificaciones importantes sobre tu cuenta
• Detectar y prevenir fraudes o uso indebido
• Cumplir con obligaciones legales

**NO usamos tu información para:**
• Venderla a terceros
• Mostrar publicidad personalizada basada en tus finanzas
• Compartirla con bancos o instituciones financieras sin tu consentimiento`,
        },
        {
          title: '4. Almacenamiento y Seguridad',
          content: `Protegemos tus datos mediante:

• Cifrado en tránsito (TLS/HTTPS)
• Cifrado en reposo para datos sensibles
• Contraseñas almacenadas con algoritmos de hash seguros (bcrypt)
• Tokens de sesión con expiración automática
• Servidores seguros con acceso restringido
• Auditorías de seguridad regulares

Tus datos se almacenan en servidores ubicados en [ubicación por definir], cumpliendo con estándares internacionales de protección de datos.`,
        },
        {
          title: '5. Compartir Información',
          content: `Solo compartimos tu información en los siguientes casos:

• **Con tu consentimiento:** Cuando nos autorizas explícitamente
• **Proveedores de servicio:** Empresas que nos ayudan a operar (procesadores de pago, hosting), bajo estrictos acuerdos de confidencialidad
• **Requisitos legales:** Cuando la ley nos obliga a divulgar información
• **Protección de derechos:** Para proteger la seguridad de usuarios o terceros

Nunca vendemos tu información personal o financiera a terceros.`,
        },
        {
          title: '6. Tus Derechos',
          content: `Tienes derecho a:

• **Acceso:** Solicitar una copia de tus datos personales
• **Rectificación:** Corregir datos inexactos o incompletos
• **Eliminación:** Solicitar que eliminemos tus datos
• **Portabilidad:** Exportar tus datos en formato legible
• **Oposición:** Objetar ciertos usos de tus datos
• **Limitación:** Restringir el procesamiento de tus datos

Para ejercer estos derechos, contáctanos en privacy@budgetcopilot.app`,
        },
        {
          title: '7. Retención de Datos',
          content: `Conservamos tus datos mientras tu cuenta esté activa. Después de eliminar tu cuenta:

• Los datos personales se eliminan en un plazo de 30 días
• Algunos datos anonimizados pueden conservarse para análisis estadísticos
• Los datos requeridos por ley se conservan según los plazos legales aplicables

Puedes solicitar la eliminación completa de tus datos en cualquier momento.`,
        },
        {
          title: '8. Cookies y Tecnologías Similares',
          content: `Usamos cookies esenciales para:

• Mantener tu sesión activa
• Recordar tus preferencias
• Garantizar la seguridad de tu cuenta

No usamos cookies de seguimiento publicitario ni compartimos datos con redes publicitarias.`,
        },
        {
          title: '9. Menores de Edad',
          content: `Budget Copilot no está dirigido a menores de 18 años. No recopilamos intencionalmente información de menores. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos inmediatamente.`,
        },
        {
          title: '10. Cambios a esta Política',
          content: `Podemos actualizar esta política ocasionalmente. Te notificaremos cambios significativos por correo electrónico o mediante aviso en la aplicación antes de que entren en vigor.`,
        },
        {
          title: '11. Contacto',
          content: `Para preguntas sobre privacidad o para ejercer tus derechos:

Email: privacy@budgetcopilot.app
Dirección: Ciudad de Panamá, Panamá

Responderemos a tu solicitud en un plazo máximo de 30 días.`,
        },
      ],
    },
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last Updated: December 2024',
      intro:
        'At Budget Copilot, your privacy is our priority. This policy explains how we collect, use, and protect your personal and financial information.',
      sections: [
        {
          title: '1. Information We Collect',
          content: `We collect the following types of information:

**Account Information:**
• Email address
• Name (optional)
• Password (securely stored with hash)

**Financial Data:**
• Transactions you enter manually
• Data extracted from screenshots or PDFs
• Categories and budgets you set up
• Savings goals

**Usage Data:**
• How you interact with the application
• Preferences and settings
• Device information (for technical support)`,
        },
        {
          title: '2. Local Processing',
          content: `Budget Copilot is designed with privacy by default:

• Your financial data is processed locally on your device when possible
• Screenshots and PDFs are analyzed locally before uploading
• We only send minimal data to our servers when necessary
• We do not store your bank credentials - we never ask for them`,
        },
        {
          title: '3. How We Use Your Information',
          content: `We use your information to:

• Provide and improve the financial management service
• Generate personalized analysis and recommendations
• Send important notifications about your account
• Detect and prevent fraud or misuse
• Comply with legal obligations

**We do NOT use your information to:**
• Sell it to third parties
• Show personalized advertising based on your finances
• Share it with banks or financial institutions without your consent`,
        },
        {
          title: '4. Storage and Security',
          content: `We protect your data through:

• Encryption in transit (TLS/HTTPS)
• Encryption at rest for sensitive data
• Passwords stored with secure hashing algorithms (bcrypt)
• Session tokens with automatic expiration
• Secure servers with restricted access
• Regular security audits

Your data is stored on servers located in [location TBD], complying with international data protection standards.`,
        },
        {
          title: '5. Sharing Information',
          content: `We only share your information in the following cases:

• **With your consent:** When you explicitly authorize us
• **Service providers:** Companies that help us operate (payment processors, hosting), under strict confidentiality agreements
• **Legal requirements:** When the law requires us to disclose information
• **Rights protection:** To protect the safety of users or third parties

We never sell your personal or financial information to third parties.`,
        },
        {
          title: '6. Your Rights',
          content: `You have the right to:

• **Access:** Request a copy of your personal data
• **Rectification:** Correct inaccurate or incomplete data
• **Deletion:** Request that we delete your data
• **Portability:** Export your data in a readable format
• **Objection:** Object to certain uses of your data
• **Restriction:** Restrict the processing of your data

To exercise these rights, contact us at privacy@budgetcopilot.app`,
        },
        {
          title: '7. Data Retention',
          content: `We keep your data while your account is active. After deleting your account:

• Personal data is deleted within 30 days
• Some anonymized data may be retained for statistical analysis
• Data required by law is retained according to applicable legal deadlines

You can request complete deletion of your data at any time.`,
        },
        {
          title: '8. Cookies and Similar Technologies',
          content: `We use essential cookies to:

• Keep your session active
• Remember your preferences
• Ensure the security of your account

We do not use advertising tracking cookies or share data with advertising networks.`,
        },
        {
          title: '9. Minors',
          content: `Budget Copilot is not intended for individuals under 18 years of age. We do not intentionally collect information from minors. If we discover that we have collected data from a minor, we will delete it immediately.`,
        },
        {
          title: '10. Changes to this Policy',
          content: `We may update this policy occasionally. We will notify you of significant changes by email or through a notice in the application before they take effect.`,
        },
        {
          title: '11. Contact',
          content: `For privacy questions or to exercise your rights:

Email: privacy@budgetcopilot.app
Address: Panama City, Panama

We will respond to your request within a maximum of 30 days.`,
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
        <p className="text-gray-500 text-sm sm:text-base mb-3 sm:mb-4">
          {t.lastUpdated}
        </p>
        <p className="text-gray-300 mb-6 sm:mb-8 text-base sm:text-lg">
          {t.intro}
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
              <div className="text-gray-300 whitespace-pre-line leading-relaxed prose-strong:text-white text-sm sm:text-base">
                {section.content.split('**').map((part, i) =>
                  i % 2 === 1 ? (
                    <strong key={i} className="text-white">
                      {part}
                    </strong>
                  ) : (
                    part
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        {/* Footer Links */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-wrap gap-6 text-sm text-gray-400">
          <Link href="/terms" className="hover:text-cyan-400 transition-colors">
            {lang === 'es' ? 'Términos de Servicio' : 'Terms of Service'}
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
