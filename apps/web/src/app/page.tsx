'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@budget-copilot/ui/button';

// Mobile Navigation Menu Component
function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-72 bg-gray-900 border-l border-gray-800 z-50 p-6">
        <div className="flex justify-end mb-8">
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="space-y-4">
          <Link href="#features" onClick={onClose} className="block text-gray-300 hover:text-white py-2 transition-colors">
            Funciones
          </Link>
          <Link href="#compare" onClick={onClose} className="block text-gray-300 hover:text-white py-2 transition-colors">
            ¿Por Qué Nosotros?
          </Link>
          <Link href="#demo" onClick={onClose} className="block text-gray-300 hover:text-white py-2 transition-colors">
            Demo
          </Link>
          <Link href="/pricing" onClick={onClose} className="block text-gray-300 hover:text-white py-2 transition-colors">
            Precios
          </Link>
          <div className="border-t border-gray-800 pt-4 mt-4 space-y-3">
            <Link href="/login" onClick={onClose} className="block text-gray-300 hover:text-white py-2 transition-colors">
              Iniciar Sesión
            </Link>
            <Link href="/register" onClick={onClose}>
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0">
                Registrarse Gratis
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}

/**
 * Budget Copilot - Página de Inicio con IA Financiera
 */
export default function HomePage() {
  const [currentWeather, setCurrentWeather] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [isTypingResponse, setIsTypingResponse] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Estados del clima financiero
  const weatherStates = [
    { emoji: '☀️', status: 'Cielos Despejados', message: '¡Buen flujo de caja! Puedes gastar $127 hoy', color: 'from-yellow-400 to-orange-400' },
    { emoji: '⛅', status: 'Parcialmente Nublado', message: 'Netflix se renueva en 3 días. ¡Planifica!', color: 'from-blue-400 to-cyan-400' },
    { emoji: '🌧️', status: 'Día Lluvioso', message: 'Alquiler el viernes. Evita compras grandes.', color: 'from-gray-400 to-blue-500' },
    { emoji: '⛈️', status: 'Alerta de Tormenta', message: '¡Saldo bajo! $89 hasta el día de pago.', color: 'from-purple-500 to-red-500' },
  ];

  // Preguntas y respuestas de demo
  const demoConversations = [
    {
      question: "¿Me alcanza para cine y cena de $50? 🍿🍕",
      response: {
        thinking: "Déjame revisar tu clima financiero... ⛅",
        analysis: [
          { icon: "💰", label: "Saldo actual", value: "$847", color: "text-green-400" },
          { icon: "📅", label: "Alquiler en 8 días", value: "-$650", color: "text-yellow-400" },
          { icon: "🔄", label: "Netflix + Spotify esta semana", value: "-$25", color: "text-yellow-400" },
          { icon: "🛡️", label: "Seguro gastar", value: "$172", color: "text-cyan-400" },
        ],
        verdict: { text: "✅ ¡Claro que sí! $50 para cine y cena está perfecto. ¡Pásala bien! 🎉", positive: true },
        tip: "Pro tip: En Cinépolis los martes hay 2x1. ¡Podrías ahorrar $8 si vas ese día! 🎬"
      }
    },
    {
      question: "¿Cuándo termino de pagar mi tarjeta? 💳",
      response: {
        thinking: "Analizando tu deuda... 📊",
        analysis: [
          { icon: "💳", label: "Deuda actual", value: "$2,340", color: "text-red-400" },
          { icon: "📈", label: "Tasa de interés", value: "18.9% APR", color: "text-yellow-400" },
          { icon: "💸", label: "Pago mensual actual", value: "$150/mes", color: "text-cyan-400" },
          { icon: "📅", label: "Fecha libre de deuda", value: "Octubre 2026", color: "text-purple-400" },
        ],
        verdict: { text: "🎯 A tu ritmo actual, serás libre de deuda en 19 meses.", positive: true },
        tip: "Si agregas $50/mes extra, ¡terminas 6 meses antes y ahorras $187 en intereses! 💪"
      }
    },
    {
      question: "¿Por qué gasté de más el mes pasado? 📉",
      response: {
        thinking: "Analizando patrones de gasto... 🔍",
        analysis: [
          { icon: "🍔", label: "Comida afuera", value: "+$127 vs normal", color: "text-red-400" },
          { icon: "🛒", label: "Compras online", value: "+$89 (Black Friday)", color: "text-yellow-400" },
          { icon: "⛽", label: "Gasolina", value: "+$34 (viaje a Colón)", color: "text-yellow-400" },
          { icon: "📊", label: "Exceso total", value: "$250 sobre presupuesto", color: "text-red-400" },
        ],
        verdict: { text: "⚠️ Gastaste $250 más de lo usual, principalmente en comida afuera.", positive: false },
        tip: "Detecté que pediste delivery 11 veces vs tu promedio de 5. ¿Quieres que te avise después de 6 pedidos? 🔔"
      }
    },
    {
      question: "¿Qué suscripciones estoy pagando? 📱",
      response: {
        thinking: "Escaneando pagos recurrentes... 🔄",
        analysis: [
          { icon: "🎬", label: "Netflix", value: "$15.99/mes", color: "text-red-400" },
          { icon: "🎵", label: "Spotify", value: "$9.99/mes", color: "text-green-400" },
          { icon: "☁️", label: "iCloud", value: "$2.99/mes", color: "text-blue-400" },
          { icon: "🏋️", label: "PowerClub (sin usar 2 meses)", value: "$45/mes", color: "text-yellow-400" },
        ],
        verdict: { text: "💸 Total mensual: $73.97 en suscripciones", positive: true },
        tip: "¡Alerta! No has ido a PowerClub en 2 meses. Si lo cancelas, ahorras $540/año. ¿Te ayudo? 🤔"
      }
    },
    {
      question: "¿Cuánto gasté en Uber este año? 🚗",
      response: {
        thinking: "Sumando todos tus viajes... 🚕",
        analysis: [
          { icon: "🚗", label: "Total Uber 2024", value: "$1,247", color: "text-purple-400" },
          { icon: "📅", label: "Promedio mensual", value: "$104/mes", color: "text-cyan-400" },
          { icon: "🔥", label: "Mes más alto", value: "Diciembre: $189", color: "text-red-400" },
          { icon: "📍", label: "Viaje más frecuente", value: "Casa → Oficina", color: "text-green-400" },
        ],
        verdict: { text: "🚗 Has gastado $1,247 en Uber este año (promedio $104/mes)", positive: true },
        tip: "Si usas Metro Bus 3 veces por semana para ir a la oficina, ahorrarías $67/mes. ¡Son $800 al año! 🚌"
      }
    },
  ];

  const fullText = "Tu copiloto de IA hacia la libertad financiera...";

  const handleQuestionClick = (index: number) => {
    setIsTypingResponse(true);
    setTimeout(() => {
      setActiveQuestion(index);
      setIsTypingResponse(false);
    }, 600);
  };

  useEffect(() => {
    // Ciclo del clima
    const weatherInterval = setInterval(() => {
      setCurrentWeather((prev) => (prev + 1) % weatherStates.length);
    }, 3000);

    return () => clearInterval(weatherInterval);
  }, []);

  useEffect(() => {
    // Efecto de escritura
    if (isTyping && typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 50);
      return () => clearTimeout(timeout);
    } else if (typedText.length === fullText.length) {
      setTimeout(() => {
        setIsTyping(false);
        setTypedText('');
        setTimeout(() => setIsTyping(true), 1000);
      }, 2000);
    }
  }, [typedText, isTyping]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Fondo Animado */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-40 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-40 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Encabezado */}
      <header className="relative z-10 border-b border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl lg:text-3xl">🧠</span>
              <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Budget Copilot
              </h1>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-6">
              <Link href="#features" className="text-gray-400 hover:text-white transition-colors text-sm">
                Funciones
              </Link>
              <Link href="#compare" className="text-gray-400 hover:text-white transition-colors text-sm">
                ¿Por Qué Nosotros?
              </Link>
              <Link href="#demo" className="text-gray-400 hover:text-white transition-colors text-sm">
                Demo
              </Link>
              <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors text-sm">
                Precios
              </Link>
              <Link href="/login" className="text-gray-400 hover:text-white transition-colors text-sm">
                Iniciar Sesión
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0">
                  Registrarse Gratis
                </Button>
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Abrir menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Sección Hero */}
        <section className="py-12 lg:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Izquierda: Contenido de Texto */}
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 lg:px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700 mb-4 lg:mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs lg:text-sm text-gray-300">IA Avanzada • Privacidad Total • Hecho para Panamá</span>
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 lg:mb-6 leading-tight">
                  No Es Solo Una App de Presupuesto.
                  <span className="block bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Es Tu Copiloto Financiero de IA. 🤖
                  </span>
                </h2>

                <p className="text-base lg:text-xl text-gray-400 mb-4 h-6 lg:h-8 font-mono">
                  {typedText}<span className="animate-pulse">|</span>
                </p>

                <p className="text-sm lg:text-lg text-gray-400 mb-6 lg:mb-8">
                  Las apps de presupuesto tradicionales te hacen todo el trabajo. Budget Copilot
                  <span className="text-cyan-400 font-semibold"> piensa por ti</span> — predice crisis de efectivo,
                  aprende tus hábitos, y responde preguntas sobre tu dinero en español normal.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 mb-6 lg:mb-8 justify-center lg:justify-start">
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0 text-base lg:text-lg px-6 lg:px-8">
                      Crear Cuenta Gratis
                    </Button>
                  </Link>
                  <Link href="#demo" className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto border-gray-600 text-gray-300 hover:bg-gray-800 text-base lg:text-lg">
                      Ver Demo 🎬
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 lg:gap-6 text-xs lg:text-sm text-gray-500">
                  <span className="flex items-center gap-1">✅ 100% Local y Privado</span>
                  <span className="flex items-center gap-1">✅ Funciona con Capturas</span>
                  <span className="flex items-center gap-1">✅ Sin Conectar Banco</span>
                </div>
              </div>

              {/* Derecha: Demo del Clima Animado */}
              <div className="relative mt-8 lg:mt-0">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 p-6 lg:p-8 shadow-2xl">
                  <div className="text-center mb-4 lg:mb-6">
                    <p className="text-xs lg:text-sm text-gray-400 mb-2">Tu Clima Financiero Hoy</p>
                    <div className={`text-6xl lg:text-8xl mb-3 lg:mb-4 transition-all duration-500 transform hover:scale-110`}>
                      {weatherStates[currentWeather].emoji}
                    </div>
                    <h3 className={`text-xl lg:text-2xl font-bold mb-2 bg-gradient-to-r ${weatherStates[currentWeather].color} bg-clip-text text-transparent`}>
                      {weatherStates[currentWeather].status}
                    </h3>
                    <p className="text-sm lg:text-base text-gray-300">{weatherStates[currentWeather].message}</p>
                  </div>

                  {/* Mini Estadísticas */}
                  <div className="grid grid-cols-3 gap-2 lg:gap-4 pt-4 lg:pt-6 border-t border-gray-700/50">
                    <div className="text-center">
                      <p className="text-lg lg:text-2xl font-bold text-green-400">$2,847</p>
                      <p className="text-xs text-gray-500">Saldo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg lg:text-2xl font-bold text-cyan-400">23</p>
                      <p className="text-xs text-gray-500">Días de Pista</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg lg:text-2xl font-bold text-purple-400">$127</p>
                      <p className="text-xs text-gray-500">Seguro Gastar</p>
                    </div>
                  </div>

                  {/* Puntos Animados */}
                  <div className="flex justify-center gap-2 mt-4 lg:mt-6">
                    {weatherStates.map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          i === currentWeather ? 'bg-cyan-400 w-6' : 'bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sección de Comparación */}
        <section id="compare" className="py-12 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 lg:mb-16">
              <h3 className="text-2xl lg:text-4xl font-bold mb-3 lg:mb-4">
                ¿Por Qué Budget Copilot? 🤔
              </h3>
              <p className="text-base lg:text-xl text-gray-400">
                No somos otro clon de Mint. Esto es lo que nos hace diferentes.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Apps Tradicionales */}
              <div className="bg-gray-800/30 rounded-2xl p-8 border border-gray-700/50">
                <h4 className="text-xl font-bold mb-6 text-gray-400 flex items-center gap-2">
                  <span className="text-2xl">😴</span> Apps de Presupuesto Tradicionales
                </h4>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 text-xl">❌</span>
                    <div>
                      <p className="font-medium text-gray-300">Entrada manual y sincronización bancaria</p>
                      <p className="text-sm text-gray-500">Las conexiones de Plaid fallan. Escribir todo es tedioso.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 text-xl">❌</span>
                    <div>
                      <p className="font-medium text-gray-300">Reactivo, no proactivo</p>
                      <p className="text-sm text-gray-500">Te muestra lo que pasó, no lo que viene.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 text-xl">❌</span>
                    <div>
                      <p className="font-medium text-gray-300">Categorización tonta</p>
                      <p className="text-sm text-gray-500">"AMZN*2847XK" → "Compras" 🙄 Qué útil.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 text-xl">❌</span>
                    <div>
                      <p className="font-medium text-gray-300">Sin contexto, sin personalidad</p>
                      <p className="text-sm text-gray-500">Gráficos aburridos y números. Sin consejos prácticos.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-400 text-xl">❌</span>
                    <div>
                      <p className="font-medium text-gray-300">No funciona en LATAM</p>
                      <p className="text-sm text-gray-500">¿Bancos de Panamá? Olvídalo.</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Budget Copilot */}
              <div className="bg-gradient-to-br from-cyan-900/30 to-purple-900/30 rounded-2xl p-8 border border-cyan-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl"></div>
                <h4 className="text-xl font-bold mb-6 text-cyan-400 flex items-center gap-2">
                  <span className="text-2xl">🧠</span> Budget Copilot IA
                </h4>
                <ul className="space-y-4 relative z-10">
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl">✅</span>
                    <div>
                      <p className="font-medium text-white">Análisis de capturas y PDFs</p>
                      <p className="text-sm text-gray-400">Toma una foto de tu app bancaria. La IA extrae todo.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl">✅</span>
                    <div>
                      <p className="font-medium text-white">Predice crisis de efectivo</p>
                      <p className="text-sm text-gray-400">"¡Alerta de tormenta! $89 hasta el día de pago"</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl">✅</span>
                    <div>
                      <p className="font-medium text-white">Aprende TUS patrones</p>
                      <p className="text-sm text-gray-400">Sabe que gastas de más los viernes. Te avisa.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl">✅</span>
                    <div>
                      <p className="font-medium text-white">Pregunta lo que sea en español</p>
                      <p className="text-sm text-gray-400">"¿Me alcanza para un PS5?" → Respuesta real.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl">✅</span>
                    <div>
                      <p className="font-medium text-white">Hecho para Panamá 🇵🇦</p>
                      <p className="text-sm text-gray-400">Banco General, Banistmo, BAC → Todos soportados.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Grid de Funciones */}
        <section id="features" className="py-12 lg:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 lg:mb-16">
              <h3 className="text-2xl lg:text-4xl font-bold mb-3 lg:mb-4">
                El Cerebro del Dinero™ 🧠
              </h3>
              <p className="text-base lg:text-xl text-gray-400">
                Cinco sistemas de IA trabajando juntos para manejar tu plata.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Función 1 */}
              <div className="group bg-gray-900/50 rounded-2xl p-6 border border-gray-800 hover:border-cyan-500/50 transition-all duration-300 hover:transform hover:-translate-y-1">
                <div className="text-4xl mb-4">📸</div>
                <h4 className="text-xl font-bold mb-2 text-white group-hover:text-cyan-400 transition-colors">
                  Lector de Capturas
                </h4>
                <p className="text-gray-400">
                  Toma foto de tu app bancaria o estado de cuenta. La IA extrae las transacciones al instante. Sin escribir, sin Plaid.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <span className="text-xs text-cyan-400 font-mono">Funciona con: PNG, JPG, PDF</span>
                </div>
              </div>

              {/* Función 2 */}
              <div className="group bg-gray-900/50 rounded-2xl p-6 border border-gray-800 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-1">
                <div className="text-4xl mb-4">🌤️</div>
                <h4 className="text-xl font-bold mb-2 text-white group-hover:text-purple-400 transition-colors">
                  Clima Financiero
                </h4>
                <p className="text-gray-400">
                  Reporte diario: "Nublado con probabilidad de sobregiro." Conoce tu pronóstico financiero de un vistazo.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <span className="text-xs text-purple-400 font-mono">☀️ → ⛅ → 🌧️ → ⛈️</span>
                </div>
              </div>

              {/* Función 3 */}
              <div className="group bg-gray-900/50 rounded-2xl p-6 border border-gray-800 hover:border-pink-500/50 transition-all duration-300 hover:transform hover:-translate-y-1">
                <div className="text-4xl mb-4">💀</div>
                <h4 className="text-xl font-bold mb-2 text-white group-hover:text-pink-400 transition-colors">
                  Copiloto de Deudas
                </h4>
                <p className="text-gray-400">
                  Ve tu "fecha de muerte de deuda" — cuándo serás libre. Compara estrategias avalancha vs bola de nieve.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <span className="text-xs text-pink-400 font-mono">$50/mes extra → 14 meses antes</span>
                </div>
              </div>

              {/* Función 4 */}
              <div className="group bg-gray-900/50 rounded-2xl p-6 border border-gray-800 hover:border-green-500/50 transition-all duration-300 hover:transform hover:-translate-y-1">
                <div className="text-4xl mb-4">📬</div>
                <h4 className="text-xl font-bold mb-2 text-white group-hover:text-green-400 transition-colors">
                  Bandeja de Transacciones
                </h4>
                <p className="text-gray-400">
                  Desliza a la derecha para aprobar, izquierda para rechazar. La IA aprende tus categorías con el tiempo. Cero trabajo manual.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <span className="text-xs text-green-400 font-mono">95% precisión después de 50 swipes</span>
                </div>
              </div>

              {/* Función 5 */}
              <div className="group bg-gray-900/50 rounded-2xl p-6 border border-gray-800 hover:border-yellow-500/50 transition-all duration-300 hover:transform hover:-translate-y-1">
                <div className="text-4xl mb-4">🔮</div>
                <h4 className="text-xl font-bold mb-2 text-white group-hover:text-yellow-400 transition-colors">
                  Pista de Efectivo
                </h4>
                <p className="text-gray-400">
                  "23 días hasta $0 al ritmo actual de gasto." Ve el futuro antes de que pase.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <span className="text-xs text-yellow-400 font-mono">Incluye cuentas por pagar</span>
                </div>
              </div>

              {/* Función 6 */}
              <div className="group bg-gray-900/50 rounded-2xl p-6 border border-gray-800 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:-translate-y-1">
                <div className="text-4xl mb-4">🎯</div>
                <h4 className="text-xl font-bold mb-2 text-white group-hover:text-orange-400 transition-colors">
                  Seguimiento de Metas
                </h4>
                <p className="text-gray-400">
                  "¡82% de tu fondo de vacaciones! Pon $47 esta semana para mantenerte en camino."
                </p>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <span className="text-xs text-orange-400 font-mono">Contribuciones recomendadas por IA</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sección de Demo Interactivo */}
        <section id="demo" className="py-12 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 lg:mb-12">
              <h3 className="text-2xl lg:text-4xl font-bold mb-3 lg:mb-4">
                Pregúntame Lo Que Sea 💬
              </h3>
              <p className="text-base lg:text-xl text-gray-400">
                Esto es lo que nos hace diferentes. Preguntas reales, respuestas reales.
              </p>
              <p className="text-xs lg:text-sm text-cyan-400 mt-2">👇 Haz clic en cualquier pregunta para ver la respuesta</p>
            </div>

            {/* Demo de Chat */}
            <div className="bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 overflow-hidden shadow-2xl">
              {/* Encabezado del Chat */}
              <div className="bg-gradient-to-r from-cyan-600 to-purple-600 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xl">🤖</span>
                </div>
                <div>
                  <p className="font-bold text-white">Budget Copilot IA</p>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <p className="text-xs text-cyan-100">En línea • Analizando tus finanzas</p>
                  </div>
                </div>
              </div>

              {/* Mensajes del Chat */}
              <div className="p-6 space-y-4 min-h-[350px]">
                {/* Mensaje del Usuario */}
                <div className="flex justify-end animate-fade-in" key={`q-${activeQuestion}`}>
                  <div className="bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[80%] shadow-lg">
                    <p>{demoConversations[activeQuestion].question}</p>
                  </div>
                </div>

                {/* Respuesta de la IA */}
                {isTypingResponse ? (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 text-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-gray-400">Pensando...</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start animate-fade-in" key={`a-${activeQuestion}`}>
                    <div className="bg-gray-800 text-gray-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] shadow-lg">
                      <p className="mb-3 text-gray-300">{demoConversations[activeQuestion].response.thinking}</p>
                      <div className="bg-gray-700/50 rounded-xl p-3 mb-3 border border-gray-600/30">
                        <p className="text-sm text-gray-400 mb-2 font-medium">📊 Análisis Rápido:</p>
                        <ul className="text-sm space-y-1.5">
                          {demoConversations[activeQuestion].response.analysis.map((item, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span>{item.icon}</span>
                              <span className="text-gray-300">{item.label}:</span>
                              <span className={item.color}>{item.value}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className={`font-medium ${demoConversations[activeQuestion].response.verdict.positive ? 'text-green-400' : 'text-yellow-400'}`}>
                        {demoConversations[activeQuestion].response.verdict.text}
                      </p>
                      <p className="text-sm text-gray-400 mt-3 pt-3 border-t border-gray-700/50">
                        💡 {demoConversations[activeQuestion].response.tip}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Preguntas de Ejemplo */}
              <div className="border-t border-gray-700/50 p-4 bg-gray-900/50">
                <p className="text-sm text-gray-500 mb-3">🎯 Haz clic para probar:</p>
                <div className="flex flex-wrap gap-2">
                  {demoConversations.map((conv, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuestionClick(i)}
                      className={`text-xs px-3 py-1.5 rounded-full transition-all duration-300 border ${
                        activeQuestion === i
                          ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white border-transparent shadow-lg shadow-cyan-500/20'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700 hover:border-cyan-500/50'
                      }`}
                    >
                      {conv.question.split(' ').slice(0, 4).join(' ')}...
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sección de Estadísticas */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">100%</p>
                <p className="text-gray-400 mt-2">Local y Privado</p>
              </div>
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">5</p>
                <p className="text-gray-400 mt-2">Sistemas de IA</p>
              </div>
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">0</p>
                <p className="text-gray-400 mt-2">Logins Bancarios</p>
              </div>
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">∞</p>
                <p className="text-gray-400 mt-2">Preguntas que Puedes Hacer</p>
              </div>
            </div>
          </div>
        </section>

        {/* Sección CTA */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 to-purple-600/20 rounded-3xl blur-2xl"></div>
              <div className="relative bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-12 border border-gray-700/50 text-center">
                <span className="text-6xl mb-6 block">🚀</span>
                <h3 className="text-4xl font-bold mb-4">
                  ¿Listo para una IA que de verdad <span className="text-cyan-400">entienda</span> tu plata?
                </h3>
                <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                  Deja de presupuestar a la antigua. Deja que tu copiloto de IA haga el trabajo pesado
                  mientras tú te enfocas en vivir tu vida.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/register">
                    <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0 text-lg px-8 w-full sm:w-auto">
                      Crear Cuenta Gratis
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" size="lg" className="border-gray-600 text-gray-300 hover:bg-gray-800 text-lg w-full sm:w-auto">
                      Ya tengo cuenta
                    </Button>
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-6">
                  Sin tarjeta de crédito requerida • Solo crea tu cuenta para comenzar
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pie de Página */}
      <footer className="relative z-10 border-t border-gray-800 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🧠</span>
                <span className="font-bold text-lg">Budget Copilot</span>
              </div>
              <p className="text-sm text-gray-400">
                Tu compañero financiero con IA. Hecho por humanos, para humanos (con ayuda de IA 😉).
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Producto</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#features" className="hover:text-white transition-colors">Funciones</Link></li>
                <li><Link href="#demo" className="hover:text-white transition-colors">Demo</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Legal</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/terms" className="hover:text-white transition-colors">Términos de Servicio</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Política de Privacidad</Link></li>
                <li><Link href="/refunds" className="hover:text-white transition-colors">Política de Reembolsos</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Bancos Soportados 🇵🇦</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Banco General</li>
                <li>Banistmo</li>
                <li>BAC Credomatic</li>
                <li>+ Más vía captura de pantalla</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              © 2024 Budget Copilot. Hecho con 💜 para LATAM.
            </p>
            <div className="flex gap-4 text-2xl">
              <a href="#" className="hover:scale-110 transition-transform">🐦</a>
              <a href="#" className="hover:scale-110 transition-transform">💼</a>
              <a href="#" className="hover:scale-110 transition-transform">📸</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
