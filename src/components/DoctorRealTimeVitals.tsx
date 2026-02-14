import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { io } from 'socket.io-client';
import VitalCard from './VitalCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/config';

interface DoctorRealTimeVitalsProps {
    patientId: string | null;
    patientData?: any;
}

const DoctorRealTimeVitals = ({ patientId, patientData }: DoctorRealTimeVitalsProps) => {
    const [latestVitals, setLatestVitals] = useState<any>(null);
    const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const { authFetch } = useAuth();
    const socketRef = useRef<any>(null);

    useEffect(() => {
        if (!patientId) return;

        const socket = io(API_BASE_URL, {
            reconnectionAttempts: 5,
            timeout: 10000
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log("DoctorRealTimeVitals: Connected!", socket.id);
            setIsConnected(true);
            socket.emit('join-patient', patientId);
        });

        socket.on('vital-update', (newVital: any) => {
            if (newVital.patient_id?.toString() === patientId?.toString()) {
                console.log("DoctorRealTimeVitals: Received update", newVital);
                setLatestVitals(newVital);
                setVitalsHistory(prev => {
                    const newHistory = [...prev, {
                        time: new Date().toLocaleTimeString(),
                        HR: newVital.hr || newVital.HR,
                        SpO2: newVital.spo2 || newVital.SpO2
                    }];
                    return newHistory.slice(-30); // Show more history for "ECG" look
                });
            }
        });

        socket.on('monitoring-stopped', (data) => {
            if (data.patient_id?.toString() === patientId?.toString()) {
                console.log("DoctorRealTimeVitals: Monitoring stopped");
                setLatestVitals(null);
                setVitalsHistory([]);
            }
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        return () => {
            socket.disconnect();
        };
    }, [patientId]);

    const fetchInitialData = async () => {
        if (!patientId) return;
        try {
            const response = await authFetch(`${API_BASE_URL}/api/vitals/${patientId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.length > 0) {
                    const latest = data[0];
                    // Check if the latest data is recent (within last 30 seconds) to avoid showing "dead" data
                    const lastUpdateTime = new Date(latest.created_at).getTime();
                    const now = new Date().getTime();

                    if (now - lastUpdateTime < 30000) {
                        setLatestVitals(latest);
                        const history = data.slice(0, 30).reverse().map((v: any) => ({
                            time: new Date(v.created_at).toLocaleTimeString(),
                            HR: v.hr || v.HR,
                            SpO2: v.spo2 || v.SpO2
                        }));
                        setVitalsHistory(history);
                    } else {
                        setLatestVitals(null);
                        setVitalsHistory([]);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to fetch initial vitals", err);
        }
    }

    useEffect(() => {
        fetchInitialData();
    }, [patientId]);

    if (!patientId) {
        return (
            <Card className="p-12 text-center bg-white/40 backdrop-blur-md border-white/20 rounded-[2rem]">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold">No Patient Selected</h3>
                <p className="text-muted-foreground">Please select a patient to view real-time analytics.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Live ECG Monitor HUD */}
            <Card className="p-0 overflow-hidden bg-slate-950 border-slate-800 shadow-2xl rounded-[1.5rem] md:rounded-[2.5rem] border-2 md:border-4">
                <div className="bg-slate-900/50 px-4 md:px-10 py-5 md:py-7 border-b border-slate-800">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                        {/* Col 1: Status */}
                        <div className="flex items-center gap-6">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'} border border-white/5`}>
                                <Activity className="w-6 h-6" />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`w-3 h-3 rounded-full ${isConnected ? (latestVitals ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500') : 'bg-slate-700'} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}></span>
                                <span className="text-xl font-bold text-slate-100 tracking-tight">
                                    {isConnected ? (latestVitals ? 'LIVE MONITORING' : 'REAL TIME MONITORING') : 'SYSTEM OFFLINE'}
                                </span>
                            </div>
                        </div>

                        {/* Col 2: Utilities */}
                        <div className="flex items-center lg:justify-end gap-4">
                            <div className="px-4 py-2 bg-slate-800/80 rounded-xl border border-slate-700 shadow-inner">
                                <span className="text-sm font-mono font-black text-slate-300 uppercase tracking-tighter">BED {patientData?.bed_number?.toString().replace(/Bed\s*/i, '') || 'N/A'}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={fetchInitialData} className="w-10 h-10 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/5 rounded-xl border border-slate-800 transition-all">
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Row 2: Patient Info */}
                        <div className="lg:col-span-2 pt-4 md:pt-6 mt-2 border-t border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-baseline gap-3 md:gap-4 overflow-hidden">
                                <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase truncate">{patientData?.patient_name || 'Unknown Patient'}</h1>
                                <span className="text-sm md:text-lg font-mono font-bold text-slate-500 tracking-widest opacity-60">#{patientData?.patient_id?.toString().padStart(4, '0')}</span>
                            </div>
                            <div className="flex items-center text-slate-400 font-bold tracking-tight text-[10px] md:text-sm">
                                <span>{patientData?.icu_name || 'General ICU'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    {!latestVitals && isConnected && (
                        <div className="flex flex-col items-center justify-center py-24 gap-6">
                            <div className="relative">
                                <Loader2 className="w-12 h-12 text-primary/40 animate-spin" />
                                <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse"></div>
                            </div>
                            <div className="text-center">
                                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Awaiting Clinical Broadcast</p>
                                <p className="text-slate-600 text-[10px] mt-2 font-medium">Monitoring will start automatically when staff initiates analysis</p>
                            </div>
                        </div>
                    )}

                    {latestVitals && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
                            {/* Main Waveform Area */}
                            <div className="lg:col-span-3 space-y-4 md:space-y-6">
                                <div className="relative bg-slate-900/50 rounded-2xl border border-slate-800 p-4 md:p-6 h-[250px] md:h-[400px]">
                                    <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">HR Waveform</span>
                                    </div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={vitalsHistory}>
                                            <defs>
                                                <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorSpO2" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={true} />
                                            <XAxis dataKey="time" hide />
                                            <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#0f172a',
                                                    borderRadius: '12px',
                                                    border: '1px solid #1e293b',
                                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                                                    fontSize: '11px',
                                                    color: '#f8fafc'
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="HR"
                                                stroke="#f43f5e"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorHR)"
                                                isAnimationActive={false}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="SpO2"
                                                stroke="#06b6d4"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorSpO2)"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                    {/* Scan Line Effect */}
                                    <div className="absolute top-0 right-0 bottom-0 w-px bg-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.5)] z-20 animate-[scan-line_4s_linear_infinite]"></div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                                        <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">ABP Systemic</span>
                                        <div className="text-xl md:text-2xl font-mono font-black text-emerald-400 mt-1">{latestVitals.abp || latestVitals.ABP || '--/--'}</div>
                                        <div className="text-[8px] text-slate-600 mt-0.5 md:mt-1 uppercase font-bold">mmHg • Invasive</div>
                                    </div>
                                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                                        <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">PAP Pulmonary</span>
                                        <div className="text-xl md:text-2xl font-mono font-black text-amber-400 mt-1">{latestVitals.pap || latestVitals.PAP || '--/--'}</div>
                                        <div className="text-[8px] text-slate-600 mt-0.5 md:mt-1 uppercase font-bold">mmHg • Arterial</div>
                                    </div>
                                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                                        <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">awRR Rate</span>
                                        <div className="text-xl md:text-2xl font-mono font-black text-purple-400 mt-1">{latestVitals.awrr || latestVitals.awRR || '--'}</div>
                                        <div className="text-[8px] text-slate-600 mt-0.5 md:mt-1 uppercase font-bold">/min • Resp</div>
                                    </div>
                                </div>
                            </div>

                            {/* Lateral Vitals Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                                <div className="bg-rose-500/10 border border-rose-500/20 p-5 md:p-6 rounded-2xl flex flex-col items-center justify-center">
                                    <span className="text-[9px] md:text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Heart Rate</span>
                                    <div className="text-4xl md:text-5xl lg:text-6xl font-mono font-black text-rose-500 tabular-nums animate-pulse">
                                        {latestVitals.hr || latestVitals.HR || '--'}
                                    </div>
                                    <span className="text-[10px] md:text-xs font-bold text-rose-400/60 mt-1">BPM</span>
                                </div>

                                <div className="bg-cyan-500/10 border border-cyan-500/20 p-5 md:p-6 rounded-2xl flex flex-col items-center justify-center">
                                    <span className="text-[9px] md:text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">Oxygen Saturation</span>
                                    <div className="text-4xl md:text-5xl lg:text-6xl font-mono font-black text-cyan-500 tabular-nums">
                                        {latestVitals.spo2 || latestVitals.SpO2 || '--'}%
                                    </div>
                                    <span className="text-[10px] md:text-xs font-bold text-cyan-400/60 mt-1">SpO2</span>
                                </div>

                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 md:p-6 rounded-2xl flex flex-col items-center justify-center">
                                    <span className="text-[9px] md:text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Capnography</span>
                                    <div className="text-3xl md:text-4xl font-mono font-black text-emerald-500 tabular-nums">
                                        {latestVitals.etco2 || latestVitals.EtCO2 || '--'}
                                    </div>
                                    <span className="text-[10px] md:text-xs font-bold text-emerald-400/60 mt-1">EtCO2 mmHg</span>
                                </div>

                                <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-2xl flex flex-col items-center justify-center">
                                    <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Pulse Rate</span>
                                    <div className="text-3xl md:text-4xl font-mono font-black text-slate-300 tabular-nums">
                                        {latestVitals.pulse || latestVitals.Pulse || '--'}
                                    </div>
                                    <span className="text-[10px] md:text-xs font-bold text-slate-500/60 mt-1">bpm</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default DoctorRealTimeVitals;
