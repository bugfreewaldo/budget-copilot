'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RefundsPage(): React.ReactElement {
  const [lang, setLang] = useState<'es' | 'en'>('en');

  const content = {
    es: {
      title: 'Política de Reembolsos',
      lastUpdated: 'Última actualización: Diciembre 2024',
      intro:
        'En Budget Copilot queremos que estés completamente satisfecho con nuestro servicio. Esta política describe nuestras condiciones de reembolso para planes de pago.',
      sections: [
        {
          title: '1. Resumen de la Política',
          content: `Budget Copilot ofrece:

• **Plan Gratuito:** Sin costo, sin compromiso - cancela cuando quieras
• **Planes de Pago (Pro/Premium):** Garantía de satisfacción de 14 días

Si no estás satisfecho con tu plan de pago, puedes solicitar un reembolso completo dentro de los primeros 14 días de tu suscripción.`,
        },
        {
          title: '2. Plan Gratuito',
          content: `El plan gratuito no tiene costo asociado, por lo tanto:

• No hay pagos que reembolsar
• Puedes usar el plan gratuito indefinidamente
• Puedes cancelar tu cuenta gratuita en cualquier momento sin penalización
• No necesitas proporcionar información de pago para usar el plan gratuito`,
        },
        {
          title: '3. Período de Garantía (14 días)',
          content: `Para planes de pago (Pro y Premium), ofrecemos una garantía de satisfacción de 14 días:

**¿Qué incluye?**
• Reembolso del 100% del monto pagado
• Sin preguntas incómodas
• Procesamiento en 5-10 días hábiles

**Condiciones:**
• La solicitud debe hacerse dentro de los 14 días calendario desde la compra
• Solo aplica al primer período de facturación
• No aplica a renovaciones automáticas

**Cómo solicitar:**
1. Envía un email a billing@budgetcopilot.app
2. Incluye tu correo de cuenta y motivo (opcional)
3. Confirmaremos la solicitud en 24-48 horas
4. El reembolso se procesará en 5-10 días hábiles`,
        },
        {
          title: '4. Después del Período de Garantía',
          content: `Después de los primeros 14 días:

**Cancelación de suscripción:**
• Puedes cancelar en cualquier momento desde tu perfil
• Conservarás acceso hasta el fin del período pagado
• No se otorgan reembolsos por períodos parciales

**Excepciones (reembolso a discreción):**
• Errores de facturación duplicados
• Problemas técnicos graves que impidan el uso del servicio
• Circunstancias excepcionales evaluadas caso por caso

Para solicitar un reembolso excepcional, contacta a support@budgetcopilot.app explicando tu situación.`,
        },
        {
          title: '5. Método de Reembolso',
          content: `Los reembolsos se procesan:

• **Tarjeta de crédito/débito:** Al mismo método de pago original
• **PayPal:** A la cuenta PayPal original
• **Otros métodos:** Según disponibilidad del procesador de pago

**Tiempos estimados:**
• Procesamiento interno: 1-3 días hábiles
• Reflejo en tu cuenta: 5-10 días hábiles adicionales
• Depende también de tu banco o institución financiera`,
        },
        {
          title: '6. Cambios de Plan',
          content: `Si deseas cambiar de plan:

**Upgrade (a plan superior):**
• Se aplica inmediatamente
• Se prorratea el pago del plan anterior
• La diferencia se cobra proporcionalmente

**Downgrade (a plan inferior):**
• Se aplica al siguiente período de facturación
• Conservas las funcionalidades hasta el fin del período actual
• No hay reembolso por el período en curso`,
        },
        {
          title: '7. Promociones y Descuentos',
          content: `Para compras con códigos promocionales o descuentos:

• El reembolso será por el monto efectivamente pagado
• No se reembolsa el valor del descuento
• Los cupones usados no son recuperables tras el reembolso`,
        },
        {
          title: '8. Disputas de Cargo',
          content: `Antes de iniciar una disputa con tu banco o tarjeta:

• Contacta nuestro equipo de soporte primero
• Intentaremos resolver cualquier problema directamente
• Las disputas (chargebacks) pueden resultar en suspensión de cuenta

Preferimos resolver los problemas amigablemente antes de llegar a disputas formales.`,
        },
        {
          title: '9. Contacto',
          content: `Para solicitudes de reembolso o preguntas de facturación:

**Email de Facturación:** billing@budgetcopilot.app
**Soporte General:** support@budgetcopilot.app

Horario de atención: Lunes a Viernes, 9:00 AM - 6:00 PM (Hora de Panamá)`,
        },
      ],
    },
    en: {
      title: 'Refund Policy',
      lastUpdated: 'Last Updated: December 2024',
      intro:
        'At Budget Copilot, we want you to be completely satisfied with our service. This policy describes our refund conditions for paid plans.',
      sections: [
        {
          title: '1. Policy Summary',
          content: `Budget Copilot offers:

• **Free Plan:** No cost, no commitment - cancel anytime
• **Paid Plans (Pro/Premium):** 14-day satisfaction guarantee

If you are not satisfied with your paid plan, you can request a full refund within the first 14 days of your subscription.`,
        },
        {
          title: '2. Free Plan',
          content: `The free plan has no associated cost, therefore:

• There are no payments to refund
• You can use the free plan indefinitely
• You can cancel your free account at any time without penalty
• You do not need to provide payment information to use the free plan`,
        },
        {
          title: '3. Guarantee Period (14 days)',
          content: `For paid plans (Pro and Premium), we offer a 14-day satisfaction guarantee:

**What's included?**
• 100% refund of the amount paid
• No awkward questions
• Processing in 5-10 business days

**Conditions:**
• The request must be made within 14 calendar days of purchase
• Only applies to the first billing period
• Does not apply to automatic renewals

**How to request:**
1. Send an email to billing@budgetcopilot.app
2. Include your account email and reason (optional)
3. We will confirm the request within 24-48 hours
4. The refund will be processed in 5-10 business days`,
        },
        {
          title: '4. After the Guarantee Period',
          content: `After the first 14 days:

**Subscription cancellation:**
• You can cancel at any time from your profile
• You will retain access until the end of the paid period
• No refunds are given for partial periods

**Exceptions (refund at discretion):**
• Duplicate billing errors
• Serious technical issues preventing service use
• Exceptional circumstances evaluated case by case

To request an exceptional refund, contact support@budgetcopilot.app explaining your situation.`,
        },
        {
          title: '5. Refund Method',
          content: `Refunds are processed:

• **Credit/debit card:** To the same original payment method
• **PayPal:** To the original PayPal account
• **Other methods:** As available from the payment processor

**Estimated times:**
• Internal processing: 1-3 business days
• Reflection in your account: 5-10 additional business days
• Also depends on your bank or financial institution`,
        },
        {
          title: '6. Plan Changes',
          content: `If you want to change plans:

**Upgrade (to a higher plan):**
• Applied immediately
• Previous plan payment is prorated
• The difference is charged proportionally

**Downgrade (to a lower plan):**
• Applied on the next billing period
• You keep the features until the end of the current period
• No refund for the current period`,
        },
        {
          title: '7. Promotions and Discounts',
          content: `For purchases with promotional codes or discounts:

• The refund will be for the amount actually paid
• The discount value is not refunded
• Used coupons are not recoverable after refund`,
        },
        {
          title: '8. Charge Disputes',
          content: `Before initiating a dispute with your bank or card:

• Contact our support team first
• We will try to resolve any issue directly
• Disputes (chargebacks) may result in account suspension

We prefer to resolve issues amicably before reaching formal disputes.`,
        },
        {
          title: '9. Contact',
          content: `For refund requests or billing questions:

**Billing Email:** billing@budgetcopilot.app
**General Support:** support@budgetcopilot.app

Business hours: Monday to Friday, 9:00 AM - 6:00 PM (Panama Time)`,
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

        {/* Highlight Box */}
        <div className="bg-gradient-to-r from-cyan-900/30 to-purple-900/30 rounded-xl p-4 sm:p-6 border border-cyan-500/30 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl sm:text-3xl">💰</span>
            <h3 className="text-lg sm:text-xl font-bold text-cyan-400">
              {lang === 'es' ? 'Garantía de 14 Días' : '14-Day Guarantee'}
            </h3>
          </div>
          <p className="text-gray-300 text-sm sm:text-base">
            {lang === 'es'
              ? 'Si no estás 100% satisfecho con tu plan de pago, te devolvemos el dinero. Sin preguntas. Sin complicaciones.'
              : "If you're not 100% satisfied with your paid plan, we'll refund your money. No questions asked. No hassle."}
          </p>
        </div>

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

        {/* CTA Box */}
        <div className="mt-8 sm:mt-12 bg-gray-900/50 rounded-xl p-6 sm:p-8 border border-gray-800 text-center">
          <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
            {lang === 'es'
              ? '¿Listo para comenzar gratis?'
              : 'Ready to start for free?'}
          </h3>
          <p className="text-gray-400 mb-5 sm:mb-6 text-sm sm:text-base">
            {lang === 'es'
              ? 'No necesitas tarjeta de crédito. Prueba todas las funciones básicas sin costo.'
              : 'No credit card required. Try all basic features at no cost.'}
          </p>
          <Link
            href="/register"
            className="inline-block w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-xl text-white font-semibold transition-all"
          >
            {lang === 'es' ? 'Crear Cuenta Gratis' : 'Create Free Account'}
          </Link>
        </div>

        {/* Footer Links */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-wrap gap-6 text-sm text-gray-400">
          <Link href="/terms" className="hover:text-cyan-400 transition-colors">
            {lang === 'es' ? 'Términos de Servicio' : 'Terms of Service'}
          </Link>
          <Link
            href="/privacy"
            className="hover:text-cyan-400 transition-colors"
          >
            {lang === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
          </Link>
          <Link href="/" className="hover:text-cyan-400 transition-colors">
            {lang === 'es' ? 'Volver al Inicio' : 'Back to Home'}
          </Link>
        </div>
      </main>
    </div>
  );
}
