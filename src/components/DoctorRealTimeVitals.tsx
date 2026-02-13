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
}

const DoctorRealTimeVitals = ({ patientId }: DoctorRealTimeVitalsProps) => {
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
                    return newHistory.slice(-20);
                });
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
                    setLatestVitals(latest);
                    const history = data.slice(0, 20).reverse().map((v: any) => ({
                        time: new Date(v.created_at).toLocaleTimeString(),
                        HR: v.hr || v.HR,
                        SpO2: v.spo2 || v.SpO2
                    }));
                    setVitalsHistory(history);
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
            <Card className="p-6 bg-white/60 backdrop-blur-md border-white/20 shadow-lg rounded-[2rem]">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Real-Time Analytics</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {isConnected ? 'Connected to live monitoring' : 'Disconnected'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchInitialData} className="rounded-xl">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>

                {!latestVitals && isConnected && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Awaiting live data from staff...</p>
                    </div>
                )}

                {latestVitals && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <VitalCard label="HR" value={latestVitals.hr || latestVitals.HR} unit="bpm" />
                            <VitalCard label="Pulse" value={latestVitals.pulse || latestVitals.Pulse} unit="bpm" />
                            <VitalCard label="SpO2" value={latestVitals.spo2 || latestVitals.SpO2} unit="%" />
                            <VitalCard label="EtCO2" value={latestVitals.etco2 || latestVitals.EtCO2} unit="mmHg" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <VitalCard label="ABP" value={latestVitals.abp || latestVitals.ABP} unit="mmHg" />
                            <VitalCard label="PAP" value={latestVitals.pap || latestVitals.PAP} unit="mmHg" />
                            <VitalCard label="awRR" value={latestVitals.awrr || latestVitals.awRR} unit="/min" />
                        </div>
                    </div>
                )}
            </Card>

            {vitalsHistory.length > 0 && (
                <Card className="p-8 bg-white/60 backdrop-blur-md border-white/20 shadow-xl rounded-[2rem]">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">Live Trends</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={vitalsHistory}>
                                <defs>
                                    <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorSpO2" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                                <XAxis dataKey="time" hide />
                                <YAxis stroke="#94a3b8" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(0,0,0,0.05)',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                        fontSize: '11px',
                                        fontWeight: '700'
                                    }}
                                />
                                <Area type="monotone" dataKey="HR" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorHR)" animationDuration={1000} />
                                <Area type="monotone" dataKey="SpO2" stroke="#06b6d4" strokeWidth={4} fillOpacity={1} fill="url(#colorSpO2)" animationDuration={1000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default DoctorRealTimeVitals;
