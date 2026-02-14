import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, ShieldCheck, Zap, LogIn, LogOut, LayoutDashboard, Stethoscope, Play, Cpu, Lock, MessageSquare, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { BackgroundGrid } from "@/components/BackgroundGrid";
import QuickAdmitDialog from "@/components/QuickAdmitDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Home = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-slate-900 selection:text-white pb-0 relative overflow-hidden">
      {/* Subtle Medical Background Pattern */}
      <BackgroundGrid />

      {/* Refined Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/eye logo.png" alt="e-Vilochan Logo" className="w-10 h-10 object-contain" />
            <span className="font-bold text-xl tracking-tight text-slate-900">e-Vilochan</span>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
                    <Stethoscope className="h-5 w-5 text-slate-700" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 mt-2 bg-white border border-slate-200 shadow-xl rounded-lg p-1" align="end">
                  <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1.5">Clinical Access</DropdownMenuLabel>

                  <Link to="/multicamera">
                    <DropdownMenuItem className="cursor-pointer rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50">
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Multi-View
                    </DropdownMenuItem>
                  </Link>

                  <QuickAdmitDialog trigger={
                    <div role="menuitem" className="flex select-none items-center rounded-md px-2 py-2 text-sm font-medium text-slate-700 outline-none cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
                      <Zap className="w-4 h-4 mr-2" /> Quick Admit
                    </div>
                  } />

                  <Link to="/patients">
                    <DropdownMenuItem className="cursor-pointer rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50">
                      <Activity className="w-4 h-4 mr-2" /> Patient Records
                    </DropdownMenuItem>
                  </Link>

                  <DropdownMenuSeparator className="bg-slate-100 my-1" />
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md px-2 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50"
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => navigate('/login')}
                variant="ghost"
                className="font-semibold text-slate-600 hover:text-slate-900 hover:bg-transparent text-base"
              >
                Sign In
              </Button>
            )}
            {!isAuthenticated && (
              <Button
                onClick={() => navigate('/login')}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6 h-10 text-sm font-medium shadow-none transition-all hover:bg-slate-700"
              >
                Get Started
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="pt-36 relative z-10">
        <div className="container mx-auto px-6">
          {/* Minimalist Hero */}
          <div className="max-w-4xl mx-auto text-center mb-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-widest mb-8 shadow-sm">
              <Activity className="w-3 h-3 text-emerald-500" />
              Clinical Decision Support System
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 tracking-tight mb-8 leading-[1.1]">
              The Smart <br />
              <span className="text-slate-900">ICU Monitoring</span>
            </h1>

            <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-12 font-medium">
              Next-generation contactless patient monitoring powered by advanced computer vision.
              Precision diagnostics, zero physical contact.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!isAuthenticated ? (
                <Button
                  onClick={() => navigate('/login')}
                  className="h-14 px-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-lg font-bold shadow-lg shadow-slate-900/10 transition-all hover:-translate-y-0.5"
                >
                  Launch Platform <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/patients')}
                  className="h-14 px-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-lg font-bold shadow-lg shadow-slate-900/10 transition-all hover:-translate-y-0.5"
                >
                  Access Records <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Expanded Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mb-24">
            {/* Card 1: Vitals */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 mb-6 border border-slate-100">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Contactless Vitals</h3>
              <p className="text-slate-500 leading-relaxed text-sm font-medium">
                Real-time extraction of Heart Rate, SpO2, and Respiratory Rate using medical-grade computer vision algorithms.
              </p>
            </div>

            {/* Card 2: SBAR */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 mb-6 border border-slate-100">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Secure SBAR</h3>
              <p className="text-slate-500 leading-relaxed text-sm font-medium">
                Automated, role-based SBAR reports generated from 48-hour patient history data for efficient handoffs.
              </p>
            </div>

            {/* Card 3: Alerts */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 mb-6 border border-slate-100">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Instant Alerts</h3>
              <p className="text-slate-500 leading-relaxed text-sm font-medium">
                Immediate anomaly detection with multi-channel notifications (Push, Email) to the assigned response team.
              </p>
            </div>

            {/* Card 4: AI Core */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 mb-6 border border-slate-100">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Llama & Qwen Core</h3>
              <p className="text-slate-500 leading-relaxed text-sm font-medium">
                Powered by state-of-the-art Large Language Models for context-aware medical reasoning and visual analysis.
              </p>
            </div>

            {/* Card 5: Security */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 mb-6 border border-slate-100">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Enterprise Security</h3>
              <p className="text-slate-500 leading-relaxed text-sm font-medium">
                End-to-end encryption for all patient data streams with role-based access control and audit logging.
              </p>
            </div>

            {/* Card 6: ICU Chat */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 mb-6 border border-slate-100">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">ICU Collaboration Chat</h3>
              <p className="text-slate-500 leading-relaxed text-sm font-medium">
                Secure, real-time communication channels for multidisciplinary teams to coordinate critical patient care instantly.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-300 py-16 relative z-10">
        <div className="container mx-auto px-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <span className="font-bold text-3xl text-white tracking-tight">e-Vilochan</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
