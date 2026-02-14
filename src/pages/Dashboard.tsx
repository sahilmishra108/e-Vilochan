import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Dashboard from "@/components/Dashboard";
import CameraFeed from "@/components/CameraFeed";
import DoctorRealTimeVitals from "@/components/DoctorRealTimeVitals";

import { Activity, Camera, FileVideo, Home, MessageSquare, Pill, Video, Loader2, Brain, ChevronLeft, ChevronRight, Eye, RotateCw, Zap, Menu, FileEdit, Save, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import PrescriptionSheet, { PrescriptionView } from "@/components/PrescriptionSheet";
import ChatSheet, { ChatView } from "@/components/ChatSheet";
import ConnectWithPatient from "@/components/ConnectWithPatient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import QuestionnaireSheet, { QuestionnaireView } from "@/components/QuestionnaireSheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from 'react-markdown';
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle } from "lucide-react";
import { io } from "socket.io-client";
import { useToast } from "@/components/ui/use-toast";
import { API_BASE_URL } from '@/config';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Bell, FlaskConical as Flask } from "lucide-react";

const DashboardPage = () => {
  const [searchParams] = useSearchParams();
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { authFetch } = useAuth();
  const patientId = searchParams.get("patientId");

  const [patient, setPatient] = useState<any>(null);
  const [loadingSBAR, setLoadingSBAR] = useState(false);
  const [sbarData, setSbarData] = useState<string | null>(null);
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [isEditingSBAR, setIsEditingSBAR] = useState(false);
  const [sbarContent, setSbarContent] = useState("");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["dashboard", "camera", "video", "lab"].includes(tab)) {
      setCurrentTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (patientId) {
      fetchPatientDetails();
    }
  }, [patientId]);

  useEffect(() => {
    if (!user) return;

    // Global Socket for Notifications
    const socket = io(API_BASE_URL);

    // Join my hospital/ICU rooms to hear messages
    if (user.icu_id) {
      socket.emit('join-icu', user.icu_id);
    } else {
      socket.emit('join-hospital', user.hospital_id);
    }

    // Listen for new messages
    socket.on('receive-message', (message: any) => {
      // Don't toast if I sent it
      if (message.sender_id === user.doctor_id) return;

      toast({
        title: `New Message from ${message.sender_name}`,
        description: message.message_type === 'audio' ? '🎤 Voice Message' : (message.message_type === 'image' ? '📷 Image' : message.content),
        duration: 5000,
        action: (
          <Button variant="outline" size="sm" onClick={() => setCurrentTab("chat")}>
            View
          </Button>
        ),
      });
    });

    // Listen for live monitoring notifications
    socket.on('monitoring-notify', (data: any) => {
      if (user.role === 'staff') return;

      toast({
        title: "Live Monitoring Active",
        description: `${data.staff_name} has started real-time analysis for Patient #${data.patient_id?.toString().padStart(4, '0') || 'Unknown'}`,
        duration: 8000,
        action: data.patient_id ? (
          <Button
            variant="default"
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white font-bold"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('patientId', data.patient_id);
              url.searchParams.set('tab', 'camera');
              window.history.pushState({}, '', url);
              window.location.reload();
            }}
          >
            View Live Analytics
          </Button>
        ) : undefined,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user, toast]);

  const fetchPatientDetails = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/patients/${patientId}`);
      if (response.ok) {
        const data = await response.json();
        setPatient(data);
      }
    } catch (error) {
      console.error("Failed to fetch patient details", error);
    }
  };

  const handleGenerateSBAR = async (regenerate = false) => {
    if (!patientId) return;
    setLoadingSBAR(true);
    if (regenerate) setSbarData(null);

    try {
      const url = `${API_BASE_URL}/api/patients/${patientId}/sbar${regenerate ? '?regenerate=true' : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token || localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.summary) {
        setSbarData(data.summary);
        setSbarContent(data.summary);
        if (data.isStored) {
          toast({ title: "Clinical Summary Loaded", description: "Retrieved saved SBAR report." });
        }
      }
    } catch (error) {
      console.error("Failed to generate SBAR", error);
      toast({ title: "Error", description: "Failed to generate summary.", variant: "destructive" });
    } finally {
      setLoadingSBAR(false);
    }
  };

  const handleSaveSBAR = async () => {
    if (!patientId || !sbarContent) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}/sbar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('token')}`
        },
        body: JSON.stringify({ summary: sbarContent })
      });

      if (response.ok) {
        setSbarData(sbarContent);
        setIsEditingSBAR(false);
        toast({ title: "Success", description: "Clinical SBAR summary saved successfully." });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error("Failed to save SBAR", error);
      toast({ title: "Save Failed", description: "Could not save changes.", variant: "destructive" });
    }
  };

  const SidebarContent = ({ isCollapsed = false, onNavItemClick = () => { } }) => (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className={`shrink-0 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden transition-all duration-500 ${isCollapsed ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center gap-3">
          <img
            src="/eye logo.png"
            alt="e-Vilochan Logo"
            className={`h-8 w-auto transition-all duration-500 ${isCollapsed ? 'mx-auto' : ''}`}
          />
          {!isCollapsed && (
            <h1 className="text-sm font-black tracking-tight text-white animate-in fade-in slide-in-from-left-2 duration-500 uppercase">
              <span className="text-[11px] lowercase opacity-80">e</span>-Vilochan
            </h1>
          )}
        </div>
      </div>

      <ScrollArea className={`flex-1 py-6 scrollbar-none transition-all duration-500 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <nav className="space-y-6 pb-8">
          <div>
            {!isCollapsed && (
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4 ml-3 opacity-60 animate-in fade-in duration-500">System Navigation</p>
            )}
            <div className="space-y-1.5">
              {[
                { id: 'dashboard', icon: Activity, label: 'Dashboard', glow: 'bg-primary' },
                { id: 'camera', icon: Camera, label: user?.role === 'doctor' || user?.role === 'admin' ? 'Real Time Analytics' : 'Live Camera', glow: 'bg-blue-500' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    onNavItemClick();
                  }}
                  className={`w-full flex items-center gap-4 py-3 rounded-2xl transition-all duration-300 group relative
                      ${currentTab === item.id
                      ? 'bg-white/10 text-white border border-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}
                      ${isCollapsed ? 'justify-center px-0' : 'px-3 overflow-hidden'}
                    `}
                  title={isCollapsed ? item.label : ''}
                >
                  {currentTab === item.id && (
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${item.glow}`} />
                  )}
                  <div className={`p-2 rounded-xl transition-all duration-300 shrink-0
                      ${currentTab === item.id
                      ? `${item.glow} text-white shadow-lg ${item.glow}/30 scale-110`
                      : 'bg-white/5 group-hover:bg-white/10 text-slate-500'}
                    `}>
                    <item.icon className="w-4.5 h-4.5" />
                  </div>
                  {!isCollapsed && (
                    <span className="text-xs font-bold tracking-wide uppercase whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-500">{item.label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            {!isCollapsed && (
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4 ml-3 opacity-60 animate-in fade-in duration-500">Clinical Actions</p>
            )}
            <div className="space-y-1.5">
              {[
                { id: 'sbar', icon: Brain, label: 'AI SBAR Summary', glow: 'bg-purple-500' },
                { id: 'prescription', icon: Pill, label: 'Prescription', glow: 'bg-emerald-500' },
                { id: 'chat', icon: MessageSquare, label: 'Clinical Chat', glow: 'bg-blue-500' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    onNavItemClick();
                  }}
                  className={`w-full flex items-center gap-4 py-3 rounded-2xl transition-all duration-300 group relative
                      ${currentTab === item.id ? "bg-white/10 text-white border border-white/10" : "text-slate-400 hover:text-white hover:bg-white/[0.03]"}
                      ${isCollapsed ? 'justify-center px-0' : 'px-3 overflow-hidden'}
                    `}
                  title={isCollapsed ? item.label : ''}
                >
                  {currentTab === item.id && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${item.glow}`} />}
                  <div className={`p-2 rounded-xl transition-all duration-300 shrink-0 ${currentTab === item.id ? `${item.glow} text-white shadow-lg ${item.glow}/30 scale-110` : "bg-white/5 text-slate-500 group-hover:bg-white/10"}`}>
                    <item.icon className="w-4.5 h-4.5" />
                  </div>
                  {!isCollapsed && (
                    <span className="text-xs font-bold tracking-wide uppercase whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-500">{item.label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </ScrollArea>

      <div className={`shrink-0 border-t border-white/5 bg-gradient-to-t from-white/[0.01] to-transparent space-y-4 overflow-hidden transition-all duration-500 ${isCollapsed ? 'p-4' : 'p-6'}`}>
        <Link to="/" className="block">
          <Button variant="ghost" className={`w-full justify-start gap-4 h-12 rounded-2xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all group relative ${isCollapsed ? 'px-0 justify-center' : 'px-4 overflow-hidden'}`}>
            <div className="p-2 bg-white/5 rounded-xl group-hover:bg-red-500/20 transition-colors shrink-0">
              <Home className="w-4 h-4" />
            </div>
            {!isCollapsed && <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-500">Exit Console</span>}
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] animate-grid-flow"></div>
        <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
      </div>

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex h-full bg-slate-900/95 backdrop-blur-2xl border-r border-white/5 z-30 flex-col animate-slide-in-right relative shadow-[20px_0_40px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-10 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white border-2 border-slate-900 hover:scale-110 active:scale-95 transition-all shadow-lg z-50"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <SidebarContent isCollapsed={isSidebarCollapsed} />
      </aside>

      {/* Mobile Header & Sidebar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-3xl border-b border-white/5 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <img src="/eye logo.png" className="h-8 w-auto" alt="Logo" />
          <h1 className="text-sm font-black tracking-tight text-white uppercase">
            <span className="text-[11px] lowercase opacity-80">e</span>-Vilochan
          </h1>
        </div>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-xl">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-slate-900 border-r border-white/5 text-white">
            <SidebarContent onNavItemClick={() => setIsMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto relative z-10 p-4 md:p-8 pt-20 lg:pt-8 transition-all duration-500">
        <div className="max-w-7xl mx-auto">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-8 animate-fade-in-up">
            <TabsContent value="dashboard" className="space-y-6 animate-scale-in m-0 focus-visible:ring-0">
              <Dashboard patientId={patientId} patientData={patient} />
              {patient && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ConnectWithPatient
                    patientName={patient.patient_name}
                    variant="grid"
                  />
                  <PrescriptionSheet
                    patientId={patient.patient_id}
                    patientName={patient.patient_name}
                    hospitalName={patient.hospital_name || "e-Vilochan Hospital"}
                  />
                  <ChatSheet
                    patientContext={{
                      id: patient.patient_id,
                      name: patient.patient_name,
                      age: patient.age,
                      diagnosis: patient.diagnosis,
                      icuId: patient.icu_id
                    }}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="camera" className="space-y-6 animate-scale-in m-0 focus-visible:ring-0">
              <div className="flex justify-between items-center bg-white/40 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {user?.role === 'doctor' || user?.role === 'admin' ? 'Real-Time Vital Analytics' : 'Live Camera Stream'}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium tracking-tight">
                      {user?.role === 'doctor' || user?.role === 'admin' ? 'Streaming live vital signs from patient monitor' : 'Real-time computer vision analysis active'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-green-600">Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {user?.role === 'staff' ? (
                  <CameraFeed patientId={patientId} />
                ) : (
                  <DoctorRealTimeVitals patientId={patientId} patientData={patient} />
                )}
              </div>
            </TabsContent>


            <TabsContent value="sbar" className="space-y-6 animate-scale-in m-0 focus-visible:ring-0">
              <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
                <div className="p-8 border-b border-white/10 bg-gradient-to-br from-primary/10 to-blue-500/10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">AI SBAR Clinical Summary</h2>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Intelligent Patient Context Analysis</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-8">
                  {loadingSBAR || !sbarData ? (
                    <div className="space-y-6 h-full flex flex-col justify-center max-w-3xl mx-auto">
                      {loadingSBAR ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 mb-8">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Analyzing clinical data...</span>
                          </div>
                          <Skeleton className="h-6 w-3/4 rounded-lg" />
                          <Skeleton className="h-4 w-full rounded-lg" />
                          <Skeleton className="h-4 w-5/6 rounded-lg" />
                          <Skeleton className="h-4 w-full rounded-lg" />
                          <Skeleton className="h-20 w-full rounded-2xl" />
                        </div>
                      ) : (
                        <div className="text-center space-y-6 py-12">
                          <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <Brain className="w-10 h-10 text-primary/20" />
                          </div>
                          <h3 className="text-xl font-bold text-slate-900">Generate Clinical Summary</h3>
                          <p className="text-slate-500 max-w-md mx-auto italic text-sm">Click the button below to generate a detailed Situation, Background, Assessment, and Recommendation summary using AI.</p>
                          <Button onClick={() => handleGenerateSBAR(false)} className="bg-primary hover:bg-primary/90 text-white font-black px-10 h-14 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95">
                            <Zap className="w-5 h-5 mr-2" />
                            Generate Report Now
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px] pr-6">
                      <div className="max-w-4xl mx-auto py-4">
                        {isEditingSBAR ? (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Textarea
                              value={sbarContent}
                              onChange={(e) => setSbarContent(e.target.value)}
                              className="min-h-[450px] p-8 text-lg leading-relaxed bg-white/80 backdrop-blur-sm border-2 border-primary/10 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-3xl shadow-inner resize-none font-medium text-slate-700"
                              placeholder="Edit clinical summary..."
                            />
                            <div className="flex gap-3 justify-end sticky bottom-0 bg-white/80 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-lg z-20">
                              <Button variant="ghost" onClick={() => { setIsEditingSBAR(false); setSbarContent(sbarData || ""); }} className="gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl">
                                <X className="w-4 h-4" /> Cancel
                              </Button>
                              <Button onClick={handleSaveSBAR} className="gap-2 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 rounded-xl px-6">
                                <Save className="w-4 h-4" /> Save Changes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative group/edit">
                            {user?.role === 'doctor' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditingSBAR(true)}
                                className="absolute -top-2 right-0 z-10 gap-2 bg-white/80 backdrop-blur-md border-primary/20 text-primary hover:bg-primary hover:text-white transition-all opacity-0 group-hover/edit:opacity-100 shadow-lg shadow-primary/5 translate-y-2 group-hover/edit:translate-y-0 duration-300 rounded-xl font-bold text-[10px] uppercase tracking-widest"
                              >
                                <FileEdit className="w-3.5 h-3.5" /> Edit Report
                              </Button>
                            )}
                            <div className="prose prose-slate max-w-none prose-p:text-slate-600 prose-p:leading-relaxed prose-p:text-lg prose-strong:text-slate-900 prose-strong:font-black prose-headings:font-black prose-headings:tracking-tight prose-li:text-slate-600">
                              <ReactMarkdown>{sbarData}</ReactMarkdown>
                            </div>
                          </div>
                        )}

                        {!isEditingSBAR && (
                          <>
                            {/* AI Precaution Footer */}
                            <div className="mt-8 p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50 flex items-start gap-3">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <p className="text-[11px] font-medium text-amber-800/80 leading-relaxed italic">
                                This clinical summary is generated by AI for preliminary review. AI may occasionally produce inaccuracies.
                                <strong> Clinical verification and precaution are advised</strong> before making medical decisions.
                              </p>
                            </div>

                            <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  {user?.role === 'doctor' ? 'Clinical Review Active' : 'Read-Only View'}
                                </span>
                              </div>
                              {user?.role === 'doctor' && (
                                <Button variant="ghost" size="sm" onClick={() => handleGenerateSBAR(true)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl">
                                  <RotateCw className="w-3.5 h-3.5 mr-2" />
                                  Dash-Regenerate
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="prescription" className="space-y-6 animate-scale-in m-0 focus-visible:ring-0">
              {patient && (
                <PrescriptionView
                  patientId={patientId || ""}
                  patientName={patient.patient_name}
                  hospitalName={patient.hospital_name || "e-Vilochan Hospital"}
                />
              )}
            </TabsContent>

            <TabsContent value="chat" className="space-y-6 animate-scale-in m-0 focus-visible:ring-0">
              {patient && (
                <ChatView
                  patientContext={{
                    id: patient.patient_id,
                    name: patient.patient_name,
                    age: patient.age,
                    diagnosis: patient.diagnosis,
                    icuId: patient.icu_id
                  }}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div >
  );
};

export default DashboardPage;
