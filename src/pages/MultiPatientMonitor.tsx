
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, HeartPulse, Wind, Thermometer } from "lucide-react";
import { io } from "socket.io-client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from '@/config';

interface Patient {
    patient_id: number;
    patient_name: string;
    bed_number?: string;
    icu_name?: string;
    icu_id: number;
}

interface Vitals {
    hr: number | null;
    pulse: number | null;
    spo2: number | null;
    abp: string | null;
    pap: string | null;
    etco2: number | null;
    awrr: number | null;
    updated_at: Date;
}

const socket = io(API_BASE_URL);

const MultiPatientMonitor = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [patientVitals, setPatientVitals] = useState<Record<number, Vitals>>({});
    const { authFetch, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // Fetch patients
        const fetchPatients = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/api/patients`);
                const data = await res.json();
                setPatients(data);


            } catch (error) {
                console.error("Error fetching patients:", error);
            }
        };

        fetchPatients();

        if (user?.hospital_id) {
            socket.emit('join-hospital', user.hospital_id);
        }

        // Socket.IO listeners
        socket.on("vital-update", (data: any) => {
            setPatientVitals((prev) => ({
                ...prev,
                [data.patient_id]: {
                    hr: data.hr,
                    pulse: data.pulse,
                    spo2: data.spo2,
                    abp: data.abp,
                    pap: data.pap,
                    etco2: data.etco2,
                    awrr: data.awrr,
                    updated_at: new Date()
                }
            }));
        });

        socket.on("monitoring-stopped", (data: any) => {
            setPatientVitals((prev) => {
                const newState = { ...prev };
                delete newState[data.patient_id];
                return newState;
            });
        });

        return () => {
            socket.off("vital-update");
            socket.off("monitoring-stopped");
        };
    }, [user]);

    const getUrgencyColor = (val: number | null, Type: 'HR' | 'SpO2') => {
        if (val === null) return "text-muted-foreground";
        if (Type === 'HR') {
            if (val < 60 || val > 100) return "text-red-500 animate-pulse font-bold";
            return "text-green-500";
        }
        if (Type === 'SpO2') {
            if (val < 90) return "text-red-500 animate-pulse font-bold";
            if (val < 95) return "text-yellow-500";
            return "text-green-500";
        }
        return "text-foreground";
    };

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-105" onClick={() => navigate('/')}>
                            <img src="/eye logo.png" alt="Logo" className="h-8 w-auto" />
                            <span className="font-black text-xl tracking-tight text-slate-800"><span className="text-[0.8em]">e</span>-Vilochan</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
                        <div className="flex items-center gap-4">
                            <Link to="/">
                                <Button variant="ghost" size="icon" className="hover:bg-slate-100 rounded-xl">
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Multi-Patient Monitor</h1>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Clinical Command Center</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-sm font-medium text-green-500">Live Feed Active</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {patients.map((patient) => {
                        const vitals = patientVitals[patient.patient_id];
                        const lastUpdated = vitals ? new Date(vitals.updated_at).toLocaleTimeString() : "No Data";

                        return (
                            <Card key={patient.patient_id} className="bg-card/50 backdrop-blur border-white/10 shadow-lg hover:border-primary/50 transition-all duration-300">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg font-bold">{patient.patient_name}</CardTitle>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                ID: {patient.patient_id} • {patient.icu_name || 'ICU'} • Bed {patient.bed_number ? patient.bed_number.toString().replace(/Bed\s*/i, '') : 'N/A'}
                                            </div>
                                        </div>
                                        {vitals && (
                                            <Activity className={`w-5 h-5 ${vitals.hr && (vitals.hr > 100 || vitals.hr < 60) ? 'text-red-500 animate-bounce' : 'text-primary'}`} />
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <HeartPulse className="w-3 h-3" /> HR (bpm)
                                            </div>
                                            <div className={`text-2xl font-mono font-semibold ${getUrgencyColor(vitals?.hr ?? null, 'HR')}`}>
                                                {vitals?.hr ?? '--'}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Wind className="w-3 h-3" /> SpO2 (%)
                                            </div>
                                            <div className={`text-2xl font-mono font-semibold ${getUrgencyColor(vitals?.spo2 ?? null, 'SpO2')}`}>
                                                {vitals?.spo2 ?? '--'}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Activity className="w-3 h-3" /> BP (mmHg)
                                            </div>
                                            <div className="text-xl font-mono text-foreground">
                                                {vitals?.abp ?? '--/--'}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Thermometer className="w-3 h-3" /> RR (/min)
                                            </div>
                                            <div className="text-xl font-mono text-foreground">
                                                {vitals?.awrr ?? '--'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center">
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Update</span>
                                        <span className="text-[10px] font-mono text-primary">{lastUpdated}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {patients.length === 0 && (
                        <div className="col-span-full py-20 text-center text-muted-foreground">
                            No patients found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MultiPatientMonitor;
