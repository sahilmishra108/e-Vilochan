import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, Camera, ArrowRight, Stethoscope, HeartPulse, Brain, MessageSquare, Zap, LogIn, LogOut, Plus, Monitor } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
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
    <div className="min-h-screen bg-background overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] animate-grid-flow"></div>
        <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-b from-primary/5 via-background to-background"></div>
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] animate-pulse-glow"></div>
        <div className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/40 backdrop-blur-xl border-b border-white/20">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
            <img
              src="/eye logo.png"
              alt="e-Vilochan Logo"
              className="w-12 h-auto group-hover:scale-110 transition-transform duration-500"
            />
            <div className="flex flex-col text-left">
              <span className="font-bold text-2xl tracking-tight text-slate-800">e-Vilochan</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:bg-primary/10 transition-colors">
                    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                      <Stethoscope className="h-5 w-5 text-primary" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 mt-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 text-slate-200 shadow-2xl" align="end">
                  <DropdownMenuLabel className="text-xs font-bold text-primary uppercase tracking-wider px-2 py-1.5 opacity-80 decoration-none">Available Modules</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5" />

                  <Link to="/multicamera">
                    <DropdownMenuItem className="cursor-pointer rounded-lg p-2.5 hover:bg-white/10 focus:bg-white/10 focus:text-white transition-colors">
                      <Camera className="w-4 h-4 mr-2 text-primary" />
                      <span className="font-medium">Multi Camera View</span>
                    </DropdownMenuItem>
                  </Link>

                  <QuickAdmitDialog trigger={
                    <div role="menuitem" className="flex select-none items-center rounded-lg p-2.5 text-sm outline-none cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white transition-colors text-slate-200">
                      <Plus className="w-4 h-4 mr-2 text-emerald-400" />
                      <span className="font-medium">Quick Admit & Monitor</span>
                    </div>
                  } />

                  <Link to="/patients">
                    <DropdownMenuItem className="cursor-pointer rounded-lg p-2.5 hover:bg-white/10 focus:bg-white/10 focus:text-white transition-colors">
                      <Monitor className="w-4 h-4 mr-2 text-blue-400" />
                      <span className="font-medium">Patient Records</span>
                    </DropdownMenuItem>
                  </Link>

                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg p-2.5 text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10 transition-colors"
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    <span className="font-medium">Logout Clinical Session</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => navigate('/login')}
                className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 flex items-center gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 border-none"
              >
                <LogIn className="w-4 h-4" />
                <span className="font-semibold">Clinical Login</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-32 pb-20 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card rounded-[2.5rem] overflow-hidden mb-20 border-white/30 group">
            <div className="grid lg:grid-cols-2">
              <div className="p-12 lg:p-20 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -ml-32 -mt-32 animate-pulse"></div>

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary mb-8 animate-fade-in-up">
                    <HeartPulse className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Next-Gen Patient Monitoring</span>
                  </div>

                  <h1 className="text-6xl lg:text-7xl font-extrabold text-slate-900 mb-8 leading-[1.1] tracking-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    The Smart <br />
                    <span className="animate-text-shimmer">ICU</span> <br />

                  </h1>

                  <p className="text-xl text-slate-600 mb-12 leading-relaxed max-w-lg animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    Empowering healthcare providers with real-time AI vision and seamless clinical collaboration for faster, smarter decision-making in high-acuity environments.
                  </p>

                  <div className="flex flex-wrap gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                    {!isAuthenticated ? (
                      <div className="flex flex-col gap-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                        <Button
                          size="lg"
                          onClick={() => navigate('/login')}
                          className="bg-primary hover:bg-primary/90 text-white px-10 h-16 rounded-2xl shadow-xl shadow-primary/20 text-lg font-bold flex items-center gap-3 transition-all hover:scale-105 active:scale-95 border-none group/launch"
                        >
                          Launch Smart ICU
                          <ArrowRight className="w-5 h-5 group-hover/launch:translate-x-2 transition-transform" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-4">
                        <Button
                          size="lg"
                          onClick={() => navigate('/patients')}
                          className="bg-primary hover:bg-primary/90 text-white px-10 h-16 rounded-2xl shadow-xl shadow-primary/20 text-lg font-bold transition-all hover:scale-105 active:scale-95 border-none"
                        >
                          Patient Records
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual Section */}
              <div className="relative hidden lg:block overflow-hidden bg-slate-100 h-full">
                <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent z-10 pointer-events-none"></div>
                <img
                  src="/Gemini_Generated_Image_6xwqr56xwqr56xwq.png"
                  alt="Clinical Monitor Analysis"
                  className="w-full h-full object-cover transform scale-110 group-hover:scale-100 transition-transform duration-[2000ms] opacity-90"
                />
              </div>
            </div>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-10 mb-20">
            {[
              {
                icon: <Brain className="w-10 h-10 text-primary" />,
                title: "Llama-Qwen Pipeline",
                desc: "Verified clinical monitoring using a multi-step Llama extraction and Qwen2-VL verification engine for zero-error vitals tracking.",
                bg: "bg-primary/5",
                gradient: "from-primary/20 to-transparent"
              },
              {
                icon: <MessageSquare className="w-10 h-10 text-secondary" />,
                title: "Isolated Coordination",
                desc: "Clinically-isolated chat rooms with secure, high-capacity image transmission for real-time staff collaboration and patient sync.",
                bg: "bg-secondary/5",
                gradient: "from-secondary/20 to-transparent"
              },
              {
                icon: <Zap className="w-10 h-10 text-blue-500" />,
                title: "AI Clinical Summary",
                desc: "Automated SBAR generation utilizing 48-hour longitudinal data to provide rapid, actionable insights for ICU clinical rounds.",
                bg: "bg-blue-500/5",
                gradient: "from-blue-500/20 to-transparent"
              }
            ].map((feature, idx) => (
              <div key={idx} className="glass-card glass-border p-10 rounded-[2.5rem] hover:-translate-y-4 transition-all duration-500 group relative">
                <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${feature.gradient} rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
                <div className={`w-20 h-20 rounded-3xl ${feature.bg} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 relative z-10 shadow-inner`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4 relative z-10 tracking-tight">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed relative z-10 text-lg">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 py-16 text-white border-t border-slate-800 relative z-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <img src="/eye logo.png" alt="Logo" className="w-8 h-auto opacity-80" />
            <span className="font-bold text-lg tracking-tight">e-Vilochan</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
