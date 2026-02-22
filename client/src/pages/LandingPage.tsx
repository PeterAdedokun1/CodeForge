import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  Shield,
  ChevronRight,
  ArrowRight,
  Zap,
  Menu,
  X,
  Activity,
  Stethoscope,
  Users,
  Star,
  AlertTriangle,
  Mic,
  HeartPulse
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────
   RELIABLE MATERNAL / PREGNANCY IMAGE URLS
   Using pexels free stock images via their CDN for reliability.
   Every image is specifically pregnancy, mother-baby, or maternal
   health related.
   ────────────────────────────────────────────────────────────────── */

const IMAGES = {
  // Hero: Pregnant African woman, warm tones, gentle smile
  hero: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=900&h=600&fit=crop&crop=faces',
  // Section: African mother holding newborn baby
  motherBaby: 'https://images.unsplash.com/photo-1584559582128-b8be739912e1?w=800&h=600&fit=crop&crop=faces',
  // Card: pregnant belly close-up, gentle light
  pregnantBelly: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&h=400&fit=crop',
  // Card: Midwife / nurse with patient
  healthWorker: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&h=400&fit=crop&crop=faces',
  // Card: Mother breastfeeding / holding infant
  motherInfant: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&h=400&fit=crop&crop=faces',
  // Phone mockup
  appScreen: 'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=400&h=700&fit=crop',
  // Stats background: mother and child silhouette
  community: 'https://images.unsplash.com/photo-1531983412531-1f49a365ffed?w=800&h=500&fit=crop&crop=faces',
};

export const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Testimonial auto-rotate
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const testimonials = [
    {
      name: 'Adaeze Okonkwo',
      location: 'Lagos, Nigeria',
      quote: 'MIMI detected my preeclampsia risk early. The doctors said if I had waited another week, I might have lost my baby. This app truly saved our lives.',
      rating: 5
    },
    {
      name: 'Fatima Ibrahim',
      location: 'Kano, Nigeria',
      quote: 'I can speak to MIMI in Hausa! It feels like talking to a caring friend who actually understands my concerns about my pregnancy.',
      rating: 5
    },
    {
      name: 'Ngozi Eze',
      location: 'Enugu, Nigeria',
      quote: 'The CHEW worker arrived within 30 minutes of my alert. MIMI connected me to help when I needed it most during my difficult pregnancy.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-[#2b1d24] text-pink-50 font-sans overflow-x-hidden">
      {/* ═══════════════════════ NAVIGATION ═══════════════════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-2' : 'bg-transparent py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="w-9 h-9 bg-gradient-to-br from-pink-400 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-200 group-hover:shadow-pink-300 transition-shadow">
                <Heart className="w-5 h-5 text-white" fill="currentColor" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                <span className="text-pink-600">MIMI</span>
                <span className="text-pink-200/60 font-light">.health</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#problem" className="text-sm font-medium text-pink-200/80 hover:text-pink-600 transition-colors">The Problem</a>
              <a href="#solution" className="text-sm font-medium text-pink-200/80 hover:text-pink-600 transition-colors">Our Solution</a>
              <a href="#features" className="text-sm font-medium text-pink-200/80 hover:text-pink-600 transition-colors">Features</a>
              <a href="#impact" className="text-sm font-medium text-pink-200/80 hover:text-pink-600 transition-colors">Impact</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center space-x-3">
              <Link to="/login" className="text-sm font-medium text-pink-200 hover:text-pink-600 transition-colors px-4 py-2">
                Sign In
              </Link>
              <Link
                to="/signup"
                className="bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded-full font-medium text-sm transition-all shadow-lg shadow-pink-200 hover:shadow-pink-300 hover:-translate-y-0.5"
              >
                Get Started Free
              </Link>
            </div>

            {/* Mobile Toggle */}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 text-pink-200">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden bg-[#2b1d24] border-t border-pink-900/30 transition-all duration-300 overflow-hidden ${
          isMenuOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="px-6 py-5 space-y-4">
            <a href="#problem" className="block text-pink-200 font-medium" onClick={() => setIsMenuOpen(false)}>The Problem</a>
            <a href="#solution" className="block text-pink-200 font-medium" onClick={() => setIsMenuOpen(false)}>Our Solution</a>
            <a href="#features" className="block text-pink-200 font-medium" onClick={() => setIsMenuOpen(false)}>Features</a>
            <a href="#impact" className="block text-pink-200 font-medium" onClick={() => setIsMenuOpen(false)}>Impact</a>
            <div className="pt-3 border-t border-pink-900/30 space-y-3">
              <Link to="/login" className="block text-center text-pink-600 font-medium py-2">Sign In</Link>
              <Link to="/signup" className="block text-center bg-pink-600 text-white font-semibold py-3 rounded-xl">Get Started Free</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[85vh] flex flex-col pt-16">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=2664&auto=format&fit=crop" 
            alt="Doctor and pregnant patient smiling" 
            className="w-full h-full object-cover object-top"
          />
          {/* Gradient Overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/40 to-transparent"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex-grow flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-20 pb-40">
            <div className="max-w-2xl text-white">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 drop-shadow-sm">
                MIMI: Your Voice-First <br/>Health Partner
              </h1>
              <p className="text-xl md:text-2xl text-slate-100 font-light mb-10 max-w-xl drop-shadow-sm">
                Simple, accessible support for a safer pregnancy. Just speak.
              </p>
              
              <Link 
                to="/signup"
                className="inline-flex items-center justify-center bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg hover:shadow-orange-500/30 hover:-translate-y-1 transition-all"
              >
                Start Talking to MIMI
              </Link>
            </div>
          </div>
        </div>

        {/* 3-Step Cards (Overlapping) */}
        <div className="relative z-20 -mt-24 pb-12">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
             <div className="grid md:grid-cols-3 gap-6">
                {/* Card 1 */}
                <div className="bg-[#2b1d24] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
                   <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                      <Mic className="w-7 h-7 text-blue-500" />
                   </div>
                   <h3 className="text-xl font-bold text-pink-50 mb-2">1. Just Talk</h3>
                   <p className="text-pink-200/80 leading-relaxed">
                     Speak naturally in your language. MIMI understands Hausa, Igbo, Yoruba, Pidgin, and English.
                   </p>
                </div>

                {/* Card 2 */}
                <div className="bg-[#2b1d24] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
                   <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mb-6">
                      <Zap className="w-7 h-7 text-purple-500" />
                   </div>
                   <h3 className="text-xl font-bold text-pink-50 mb-2">2. Get Insights</h3>
                   <p className="text-pink-200/80 leading-relaxed">
                     MIMI's AI checks for risks, tracks your pregnancy journey, and gives personal medical advice.
                   </p>
                </div>

                {/* Card 3 */}
                <div className="bg-[#2b1d24] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
                   <div className="w-14 h-14 bg-teal-950/40 rounded-full flex items-center justify-center mb-6">
                      <Activity className="w-7 h-7 text-teal-500" />
                   </div>
                   <h3 className="text-xl font-bold text-pink-50 mb-2">3. Connect to Care</h3>
                   <p className="text-pink-200/80 leading-relaxed">
                     We automatically link you to verified nearby health facilities and workers when help is needed.
                   </p>
                </div>
             </div>
           </div>
        </div>
      </section>

      {/* ═══════════════════════ THE PROBLEM (Fluid Curve Transition) ═══════════════════════ */}
      <section id="problem" className="relative py-24 bg-[#2b1d24]">
        {/* Curved Divider Top - Adjusted for overlap */}
        {/* <div className="absolute top-0 left-0 right-0 h-24 bg-[#36252d]" style={{ clipPath: 'ellipse(70% 100% at 50% 0%)' }}></div> */}
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left Content */}
            <div className="lg:w-1/2">
               <h2 className="text-3xl md:text-4xl font-medium text-white mb-6 leading-tight">
                The reality of gestational <br/> <span className="font-bold">monitoring in Nigeria</span>
              </h2>
              <p className="text-pink-200/80 mb-8 leading-relaxed font-light text-lg">
                In Nigeria, lack of adequate monitoring leads to serious consequences. Pregnant women face geographic, financial, and informational barriers.
              </p>

              <h3 className="font-bold text-pink-50 mb-6 text-lg">Main consequences of lack of prenatal care:</h3>

              <div className="grid sm:grid-cols-3 gap-4">
                 <div className="bg-[#36252d] p-6 rounded-2xl hover:bg-[#2b1d24] hover:shadow-xl hover:-translate-y-1 transition-all border border-pink-900/30 group">
                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-teal-500 transition-colors">
                       <Activity className="w-5 h-5 text-teal-600 group-hover:text-white" />
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">Complications</h4>
                    <p className="text-xs text-pink-200/80">High risk of pre-eclampsia and diabetes.</p>
                 </div>

                 <div className="bg-[#36252d] p-6 rounded-2xl hover:bg-[#2b1d24] hover:shadow-xl hover:-translate-y-1 transition-all border border-pink-900/30 group">
                    <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-pink-500 transition-colors">
                       <Heart className="w-5 h-5 text-pink-600 group-hover:text-white" />
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">Maternal Mortality</h4>
                    <p className="text-xs text-pink-200/80">High rates in vulnerable regions.</p>
                 </div>

                  <div className="bg-[#36252d] p-6 rounded-2xl hover:bg-[#2b1d24] hover:shadow-xl hover:-translate-y-1 transition-all border border-pink-900/30 group">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors">
                       <Shield className="w-5 h-5 text-purple-600 group-hover:text-white" />
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">Healthcare Costs</h4>
                    <p className="text-xs text-pink-200/80">Preventable treatments are expensive.</p>
                 </div>
              </div>
            </div>

            {/* Right Map/Graphic */}
            <div className="lg:w-1/2 flex justify-center relative">
               <div className="absolute inset-0 bg-gradient-to-r from-pink-200 to-teal-100 rounded-full blur-3xl opacity-20"></div>
               {/* Nigeria Map Graphic Placeholder - Styled cleanly */}
               <div className="relative z-10 bg-[#36252d] rounded-[3rem] p-2 shadow-2xl w-full max-w-md aspect-square flex items-center justify-center overflow-hidden">
                   <img src="https://images.unsplash.com/photo-1531983412531-1f49a365ffed?w=800&q=80" alt="Map Context" className="w-full h-full object-cover rounded-[2.5rem] opacity-90" />
                   
                   {/* Pulse Rings */}
                   <div className="absolute w-full h-full flex items-center justify-center pointer-events-none">
                      <div className="w-64 h-64 border border-white/30 rounded-full animate-ping opacity-20"></div>
                      <div className="w-48 h-48 border border-white/50 rounded-full animate-ping animation-delay-500 opacity-20"></div>
                   </div>

                   {/* Alert Marker */}
                   <div className="absolute top-1/3 right-1/3 bg-[#2b1d24] p-3 rounded-xl shadow-lg animate-bounce-slight">
                      <div className="flex items-center gap-2">
                         <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                         <span className="text-xs font-bold text-pink-50">High Risk Area</span>
                      </div>
                   </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ OUR SOLUTION ═══════════════════════ */}
      <section id="solution" className="py-20 md:py-28 bg-[#2b1d24]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center space-x-2 bg-teal-950/40 border border-teal-900/30 rounded-full px-4 py-1.5 mb-4">
              <Zap className="w-3.5 h-3.5 text-teal-600" />
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">How MIMI Works</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              Voice-first AI care,<br />designed for every mother
            </h2>
            <p className="text-base text-pink-200/80">
              MIMI listens, understands, and acts — all through simple voice conversations in the mother's own language.
            </p>
          </div>

          {/* 3-Step Process */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {[
              {
                step: '01',
                icon: <Mic className="w-7 h-7 text-pink-600" />,
                title: 'Talk to MIMI',
                description: 'Simply speak about how you\'re feeling — headaches, swelling, pain, or just questions. MIMI understands Hausa, Igbo, Yoruba, Pidgin, and English.',
                color: 'bg-pink-950/40 border-pink-900/30',
                iconBg: 'bg-pink-100'
              },
              {
                step: '02',
                icon: <HeartPulse className="w-7 h-7 text-teal-600" />,
                title: 'AI Risk Assessment',
                description: 'MIMI\'s medical AI engine analyzes symptoms against WHO guidelines, tracks your pregnancy week by week, and identifies risks before they become emergencies.',
                color: 'bg-teal-950/40 border-teal-900/30',
                iconBg: 'bg-teal-100'
              },
              {
                step: '03',
                icon: <Users className="w-7 h-7 text-violet-600" />,
                title: 'Instant Connection',
                description: 'When risk is detected, MIMI automatically alerts nearby Community Health Workers (CHEWs) and hospitals with your location and medical context.',
                color: 'bg-violet-950/40 border-violet-900/30',
                iconBg: 'bg-violet-100'
              }
            ].map((item, i) => (
              <div key={i} className={`relative p-8 rounded-3xl border ${item.color} hover:shadow-lg transition-all duration-300 group`}>
                {/* Step number */}
                <span className="absolute top-6 right-6 text-5xl font-black text-slate-100 select-none group-hover:text-slate-200 transition-colors">{item.step}</span>
                <div className={`w-14 h-14 ${item.iconBg} rounded-2xl flex items-center justify-center mb-6`}>
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-pink-50 mb-3">{item.title}</h3>
                <p className="text-sm text-pink-200/80 leading-relaxed">{item.description}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-5 z-10">
                    <ChevronRight className="w-6 h-6 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FEATURES BENTO GRID ═══════════════════════ */}
      <section id="features" className="py-20 md:py-28 bg-[#36252d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built for the realities of maternal health in Africa
            </h2>
            <p className="text-base text-pink-200/80">
              Every feature is designed with input from midwives, CHEWs, and mothers across Nigeria.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Large card — Voice Interface */}
            <div className="lg:col-span-2 bg-gradient-to-br from-pink-600 to-rose-700 rounded-3xl p-8 md:p-10 text-white relative overflow-hidden group">
              <div className="relative z-10 max-w-md">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6">
                  <Mic className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Voice-First AI Companion</h3>
                <p className="text-pink-100 text-sm leading-relaxed mb-6">
                  No typing, no forms, no literacy required. Just speak naturally about how you feel. MIMI's AI understands context, medical symptoms, and cultural nuances across 5+ Nigerian languages.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Hausa', 'Igbo', 'Yoruba', 'Pidgin', 'English'].map(lang => (
                    <span key={lang} className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
              {/* Decorative circles */}
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-x-10 translate-y-10" />
              <div className="absolute top-10 right-10 w-20 h-20 bg-white/5 rounded-full" />
            </div>

            {/* Small card — Risk Engine */}
            <div className="bg-[#2b1d24] rounded-3xl p-8 border border-pink-900/30 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-5">
                <Activity className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-pink-50 mb-2">Smart Risk Engine</h3>
              <p className="text-sm text-pink-200/80 leading-relaxed">
                AI-powered symptom analysis based on WHO maternal health guidelines. Detects pre-eclampsia, hemorrhage risk, and gestational diabetes early.
              </p>
            </div>

            {/* Small card — CHEW Network */}
            <div className="bg-[#2b1d24] rounded-3xl p-8 border border-pink-900/30 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center mb-5">
                <Stethoscope className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-lg font-bold text-pink-50 mb-2">CHEW Network</h3>
              <p className="text-sm text-pink-200/80 leading-relaxed">
                Connected dashboard for Community Health Extension Workers. See patient alerts, risk levels, and location data in real-time.
              </p>
            </div>

            {/* Small card — Hospital Alerts */}
            <div className="bg-[#2b1d24] rounded-3xl p-8 border border-pink-900/30 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mb-5">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-pink-50 mb-2">Hospital Alerts</h3>
              <p className="text-sm text-pink-200/80 leading-relaxed">
                Critical cases are automatically escalated to nearby hospitals with full context, enabling faster emergency response.
              </p>
            </div>

            {/* Wide card — Health Profile */}
            <div className="lg:col-span-1 bg-gradient-to-br from-teal-600 to-emerald-700 rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-5">
                  <Heart className="w-6 h-6 text-white" fill="currentColor" />
                </div>
                <h3 className="text-lg font-bold mb-2">Pregnancy Health Profile</h3>
                <p className="text-teal-100 text-sm leading-relaxed">
                  Track gestational age, weight, blood pressure, symptoms, and medication — all organized in a clear, visual timeline.
                </p>
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/10 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TESTIMONIALS ═══════════════════════ */}
      <section className="py-20 md:py-28 bg-[#2b1d24]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Stories from mothers we've helped
            </h2>
            <p className="text-base text-pink-200/80">
              Real experiences from women whose pregnancies were made safer by MIMI.
            </p>
          </div>

          {/* Testimonial Cards */}
          <div className="relative max-w-2xl mx-auto">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className={`transition-all duration-500 ${
                  i === activeTestimonial
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 absolute inset-0 translate-y-4 pointer-events-none'
                }`}
              >
                <div className="bg-pink-950/40 rounded-3xl p-8 md:p-10 border border-pink-900/30 text-center">
                  {/* Stars */}
                  <div className="flex justify-center gap-1 mb-6">
                    {Array.from({ length: t.rating }).map((_, si) => (
                      <Star key={si} className="w-5 h-5 text-amber-400" fill="currentColor" />
                    ))}
                  </div>

                  <blockquote className="text-lg md:text-xl text-pink-100 leading-relaxed mb-8 font-medium italic">
                    "{t.quote}"
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 bg-pink-200 rounded-full flex items-center justify-center text-pink-300 font-bold text-lg">
                      {t.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-pink-50 text-sm">{t.name}</p>
                      <p className="text-xs text-pink-200/60">{t.location}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === activeTestimonial ? 'bg-pink-600 w-8' : 'bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ ECOSYSTEM / ROLES ═══════════════════════ */}
      <section id="impact" className="py-20 md:py-28 bg-[#36252d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              One platform, three user roles
            </h2>
            <p className="text-base text-pink-200/80">
              MIMI creates a connected care ecosystem linking mothers, community health workers, and hospitals.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Mother Card */}
            <div className="bg-[#2b1d24] rounded-3xl overflow-hidden border border-pink-900/30 hover:shadow-xl transition-all duration-300 group">
              <div className="h-52 overflow-hidden">
                <img
                  src={IMAGES.pregnantBelly}
                  alt="Pregnant woman cradling her belly"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-7">
                <div className="inline-flex items-center gap-2 bg-pink-950/40 text-pink-300 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                  <Heart className="w-3 h-3" />
                  Mother
                </div>
                <h3 className="text-lg font-bold text-pink-50 mb-2">Expecting Mothers</h3>
                <p className="text-sm text-pink-200/80 mb-4 leading-relaxed">
                  Voice-based health check-ins, personalized pregnancy guidance, risk alerts, and emergency connections — no smartphone expertise needed.
                </p>
                <Link to="/signup" className="inline-flex items-center text-pink-600 font-semibold text-sm hover:gap-3 gap-2 transition-all">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* CHEW Card */}
            <div className="bg-[#2b1d24] rounded-3xl overflow-hidden border border-pink-900/30 hover:shadow-xl transition-all duration-300 group">
              <div className="h-52 overflow-hidden">
                <img
                  src={IMAGES.healthWorker}
                  alt="Community health worker attending to a patient"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-7">
                <div className="inline-flex items-center gap-2 bg-teal-950/40 text-teal-700 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                  <Stethoscope className="w-3 h-3" />
                  CHEW
                </div>
                <h3 className="text-lg font-bold text-pink-50 mb-2">Health Workers</h3>
                <p className="text-sm text-pink-200/80 mb-4 leading-relaxed">
                  Real-time patient monitoring dashboard, priority alerts with GPS location, and patient history — all from a simple mobile interface.
                </p>
                <Link to="/signup" className="inline-flex items-center text-teal-600 font-semibold text-sm hover:gap-3 gap-2 transition-all">
                  Join as CHEW <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Hospital Card */}
            <div className="bg-[#2b1d24] rounded-3xl overflow-hidden border border-pink-900/30 hover:shadow-xl transition-all duration-300 group">
              <div className="h-52 overflow-hidden">
                <img
                  src={IMAGES.motherInfant}
                  alt="Mother holding her newborn at hospital"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-7">
                <div className="inline-flex items-center gap-2 bg-violet-950/40 text-violet-700 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                  <Activity className="w-3 h-3" />
                  Hospital
                </div>
                <h3 className="text-lg font-bold text-pink-50 mb-2">Healthcare Facilities</h3>
                <p className="text-sm text-pink-200/80 mb-4 leading-relaxed">
                  Receive critical case escalations with full patient context, enabling faster preparation and better emergency outcomes.
                </p>
                <Link to="/signup" className="inline-flex items-center text-violet-600 font-semibold text-sm hover:gap-3 gap-2 transition-all">
                  Register Facility <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FINAL CTA ═══════════════════════ */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-600 via-rose-600 to-pink-700" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-[#2b1d24] rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#2b1d24] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center text-white">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Heart className="w-8 h-8 text-white" fill="currentColor" />
          </div>

          <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            Every pregnancy deserves<br />monitoring and care
          </h2>

          <p className="text-lg text-pink-100 mb-10 max-w-xl mx-auto leading-relaxed">
            Join thousands of mothers, health workers, and hospitals already using MIMI to make pregnancy safer across Nigeria.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center bg-white text-pink-700 px-8 py-4 rounded-full font-bold text-base hover:bg-pink-950/40 transition-all shadow-xl gap-2"
            >
              Start Free Today
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center border-2 border-white/30 text-white px-8 py-4 rounded-full font-semibold text-base hover:bg-white/10 transition-all gap-2"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer className="bg-[#1D1219] text-pink-200/60 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-pink-600 rounded-lg flex items-center justify-center">
                  <Heart className="w-4 h-4 text-white" fill="currentColor" />
                </div>
                <span className="text-lg font-bold text-white">MIMI<span className="text-pink-200/80 font-light">.health</span></span>
              </div>
              <p className="text-sm leading-relaxed">
                AI-powered maternal health companion for underserved communities in Nigeria.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#solution" className="hover:text-pink-400 transition-colors">How It Works</a></li>
                <li><a href="#features" className="hover:text-pink-400 transition-colors">Features</a></li>
                <li><a href="#impact" className="hover:text-pink-400 transition-colors">Impact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm mb-4">For Users</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/signup" className="hover:text-pink-400 transition-colors">Expecting Mothers</Link></li>
                <li><Link to="/signup" className="hover:text-pink-400 transition-colors">Health Workers</Link></li>
                <li><Link to="/signup" className="hover:text-pink-400 transition-colors">Hospitals</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Connect</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-pink-400 transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-pink-400 transition-colors">Partnership</a></li>
                <li><a href="#" className="hover:text-pink-400 transition-colors">Support</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-pink-900/30 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs">&copy; 2026 MIMI.health — All rights reserved.</p>
            <div className="flex items-center gap-6 text-xs">
              <a href="#" className="hover:text-pink-400 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-pink-400 transition-colors">Terms of Use</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
