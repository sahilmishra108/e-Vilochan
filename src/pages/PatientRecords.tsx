
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Search, Calendar, FileText, Building2, MapPin, ArrowLeft } from "lucide-react";
import AddPatientDialog from "@/components/AddPatientDialog";
import DeletePatientDialog from "@/components/DeletePatientDialog";
import AddICUDialog from "@/components/AddICUDialog";
import DeleteICUDialog from "@/components/DeleteICUDialog";
import ChatSheet from "@/components/ChatSheet";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from '@/config';

interface Patient {
    patient_id: number;
    patient_name: string;
    age: number;
    gender: string;
    diagnosis: string;
    admission_date: string;
    bed_id: number | null;
    bed_number?: string;
    icu_id: number | null;
}

interface ICU {
    icu_id: number;
    icu_name: string;
    location: string;
    created_at: string;
}

const PatientRecords = () => {
    const [viewMode, setViewMode] = useState<'icus' | 'patients'>('icus');
    const [icus, setIcus] = useState<ICU[]>([]);
    const [selectedICU, setSelectedICU] = useState<ICU | null>(null);

    const [patients, setPatients] = useState<Patient[]>([]);
    const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [icuSearchQuery, setIcuSearchQuery] = useState("");
    const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
    const { authFetch, user } = useAuth();
    const navigate = useNavigate();
    const isStaff = user?.role === 'staff';

    const fetchICUs = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/api/icus`);
            const data = await res.json();
            // Sort ICUs by name in ascending order
            const sortedICUs = data.sort((a: ICU, b: ICU) => a.icu_name.localeCompare(b.icu_name));
            setIcus(sortedICUs);

            if (isStaff && user?.icu_id) {
                const assignedICU = data.find((icu: ICU) => icu.icu_id === user.icu_id);
                if (assignedICU) {
                    setSelectedICU(assignedICU);
                    setViewMode('patients');
                }
            }
        } catch (error) {
            console.error("Error fetching ICUs:", error);
        }
    };

    const fetchPatients = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/api/patients`);
            const data = await res.json();
            setPatients(data);
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchICUs();
        fetchPatients();
    }, [isStaff, user?.icu_id]);

    const filteredIcus = icus.filter(icu =>
        icu.icu_name.toLowerCase().includes(icuSearchQuery.toLowerCase()) ||
        icu.location.toLowerCase().includes(icuSearchQuery.toLowerCase())
    );

    useEffect(() => {
        if (selectedICU) {
            const filtered = patients.filter(patient => {
                const matchesICU = patient.icu_id === selectedICU.icu_id;
                const matchesSearch = (
                    patient.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    patient.patient_id.toString().includes(searchQuery) ||
                    patient.diagnosis.toLowerCase().includes(searchQuery.toLowerCase())
                );

                let matchesDate = true;
                if (dateFilter.start) {
                    matchesDate = matchesDate && new Date(patient.admission_date) >= new Date(dateFilter.start);
                }
                if (dateFilter.end) {
                    matchesDate = matchesDate && new Date(patient.admission_date) <= new Date(dateFilter.end);
                }

                return matchesICU && matchesSearch && matchesDate;
            });
            // Sort patients by ID in ascending order for professional roster organization
            const sorted = filtered.sort((a, b) => a.patient_id - b.patient_id);
            setFilteredPatients(sorted);
        }
    }, [searchQuery, patients, selectedICU, dateFilter]);

    const handleICUClick = (icu: ICU) => {
        setSelectedICU(icu);
        setViewMode('patients');
    };

    const handleBackToICUs = () => {
        if (isStaff) return;
        setSelectedICU(null);
        setViewMode('icus');
        setSearchQuery("");
        setIcuSearchQuery("");
        setDateFilter({ start: "", end: "" });
    };

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-primary">
            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] animate-grid-flow"></div>
                <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
            </div>

            {/* Header Section */}
            <div className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6">
                            <div className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-105" onClick={() => navigate('/')}>
                                <img src="/eye logo.png" alt="Logo" className="h-6 md:h-8 w-auto" />
                                <span className="font-black text-lg md:text-xl tracking-tight text-slate-800"><span className="text-[0.8em]">e</span>-Vilochan</span>
                            </div>

                            <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

                            <div className="flex items-center gap-4">
                                {viewMode === 'patients' && !isStaff && (
                                    <Button variant="ghost" size="sm" onClick={handleBackToICUs} className="mr-2 hover:bg-slate-100 rounded-xl">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                                    </Button>
                                )}
                                <div className="p-2 bg-primary/10 rounded-xl text-primary hidden sm:flex">
                                    {viewMode === 'icus' ? <Building2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                </div>
                                <div className="flex flex-col">
                                    <h1 className="text-lg font-bold text-foreground leading-none mb-1">
                                        {viewMode === 'icus' ? 'Intensive Care Units' : selectedICU?.icu_name}
                                    </h1>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                        {viewMode === 'icus' ? 'Unit Management' : 'Patient Roster'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {viewMode === 'icus' ? (
                                <AddICUDialog onICUAdded={fetchICUs} />
                            ) : (
                                <AddPatientDialog onPatientAdded={fetchPatients} icuId={selectedICU?.icu_id} />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-8">
                {viewMode === 'icus' ? (
                    <>
                        <div className="mb-8 flex flex-col sm:flex-row gap-4 max-w-md">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search ICU by name or location..."
                                    className="pl-10 bg-white/50 border-border focus:border-primary/50 focus:ring-primary/20 transition-all rounded-full shadow-sm hover:bg-white/80"
                                    value={icuSearchQuery}
                                    onChange={(e) => setIcuSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                            {filteredIcus.map((icu) => (
                                <div
                                    key={icu.icu_id}
                                    className="group relative bg-white/40 backdrop-blur-xl border border-white/20 rounded-[2rem] p-6 cursor-pointer hover:bg-white/60 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1.5 overflow-hidden"
                                    onClick={() => handleICUClick(icu)}
                                >
                                    {/* Clinical Accent Bar */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-secondary via-secondary/50 to-primary/30 transition-all duration-500 group-hover:w-2"></div>

                                    <div className="flex flex-col gap-6">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4">
                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/10 to-primary/5 flex items-center justify-center text-secondary transition-all duration-500 group-hover:scale-105 shadow-inner">
                                                    <Building2 className="w-7 h-7" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <h3 className="text-xl font-black tracking-tight text-slate-800 group-hover:text-secondary transition-colors duration-300">
                                                        {icu.icu_name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" /> {icu.location || 'Central Facility'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <DeleteICUDialog
                                                    icuId={icu.icu_id}
                                                    icuName={icu.icu_name}
                                                    onICUDeleted={fetchICUs}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between py-2 border-t border-slate-100/50">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit Status</span>
                                                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    Operational
                                                </span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="rounded-xl font-bold text-[10px] uppercase tracking-wider text-secondary bg-secondary/5 hover:bg-secondary hover:text-white transition-all">
                                                Select Unit
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {icus.length === 0 && (
                                <div className="col-span-full text-center py-24 bg-white/40 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300/50">
                                    <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                        <Building2 className="w-10 h-10 text-muted-foreground/50" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-foreground">No ICU Units Found</h3>
                                    <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                                        Create your first Intensive Care Unit to start adding patients.
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="mb-10 animate-fade-in">
                            <div className="bg-white/40 backdrop-blur-2xl border border-white/30 rounded-[2.5rem] p-4 shadow-2xl shadow-slate-200/50 flex flex-col xl:flex-row items-center gap-4">
                                {/* Search Section */}
                                <div className="relative flex-1 group w-full">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <Search className="w-5 h-5" />
                                        <div className="w-px h-4 bg-slate-200 hidden md:block"></div>
                                    </div>
                                    <Input
                                        placeholder="Search by name, ID, or diagnosis..."
                                        className="h-14 pl-14 pr-6 bg-white/50 border-white/20 focus:bg-white focus:border-primary/50 focus:ring-primary/20 transition-all rounded-[1.5rem] text-sm font-medium placeholder:text-slate-400 shadow-inner"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                {/* Filters Section */}
                                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                                    <div className="flex items-center gap-1 bg-white/80 border border-white p-1 rounded-2xl shadow-sm">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                            <Calendar className="w-4 h-4 text-primary" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Range</span>
                                        </div>
                                        <div className="flex items-center px-4 gap-2">
                                            <Input
                                                type="date"
                                                className="h-9 w-[130px] bg-transparent border-0 focus-visible:ring-0 p-0 text-xs font-bold text-slate-700"
                                                value={dateFilter.start}
                                                onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                                            />
                                            <span className="text-slate-300 font-bold">→</span>
                                            <Input
                                                type="date"
                                                className="h-9 w-[130px] bg-transparent border-0 focus-visible:ring-0 p-0 text-xs font-bold text-slate-700"
                                                value={dateFilter.end}
                                                onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    {(dateFilter.start || dateFilter.end) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDateFilter({ start: "", end: "" })}
                                            className="h-11 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5"
                                        >
                                            Clear Filters
                                        </Button>
                                    )}

                                    <div className="h-10 w-px bg-slate-200/50 mx-2 hidden xl:block"></div>

                                    <div className="flex items-center gap-3 px-6 py-2 bg-gradient-to-r from-primary/10 to-transparent rounded-2xl border border-primary/5 ml-auto xl:ml-0">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black text-primary uppercase tracking-tighter">Registry</span>
                                            <span className="text-sm font-black text-slate-800">{filteredPatients.length} Results</span>
                                        </div>
                                        <Activity className="w-5 h-5 text-primary/40" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-64 bg-muted/50 rounded-2xl animate-pulse"></div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                                {filteredPatients.map((patient) => (
                                    <div
                                        key={patient.patient_id}
                                        className="group relative bg-white/40 backdrop-blur-xl border border-white/20 rounded-[2rem] p-5 hover:bg-white/60 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1.5 overflow-hidden"
                                    >
                                        {/* Clinical Accent Bar */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary via-primary/50 to-secondary/30 transition-all duration-500 group-hover:w-2"></div>

                                        <div className="flex flex-col gap-6">
                                            {/* Header: Identity & Status */}
                                            <div className="flex justify-between items-start">
                                                <div className="flex gap-4">
                                                    <div className="relative group/avatar">
                                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/5 flex items-center justify-center text-primary font-black text-2xl transition-all duration-500 group-hover/avatar:scale-105 shadow-inner">
                                                            {patient.patient_name.charAt(0)}
                                                        </div>
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full p-0.5 shadow-md">
                                                            <div className="w-full h-full rounded-full bg-emerald-500 animate-pulse"></div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <h3 className="text-xl font-black tracking-tight text-slate-800 group-hover:text-primary transition-colors duration-300">
                                                            {patient.patient_name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100/50 px-2 py-0.5 rounded-md border border-slate-200">
                                                                ID: {patient.patient_id}
                                                            </span>
                                                            {patient.bed_number && (
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                                                                    BED: {patient.bed_number?.toString().replace(/Bed\s*/i, '')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <Activity className="w-5 h-5 text-slate-400" />
                                                </div>
                                            </div>

                                            {/* Clinical Details Grid */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50 transition-colors group-hover:bg-white/50">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 items-center flex gap-1">
                                                        <MapPin className="w-2.5 h-2.5" /> Registry Info
                                                    </p>
                                                    <p className="text-xs font-bold text-slate-700">{patient.gender}, {patient.age}Y</p>
                                                </div>
                                                <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50 transition-colors group-hover:bg-white/50">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 items-center flex gap-1">
                                                        <Calendar className="w-2.5 h-2.5" /> Admission
                                                    </p>
                                                    <p className="text-xs font-bold text-slate-700">{new Date(patient.admission_date).toLocaleDateString()}</p>
                                                </div>
                                            </div>

                                            {/* Diagnosis Section */}
                                            <div className="relative">
                                                <div className="absolute left-3 top-0 -translate-y-1/2 px-2 bg-white rounded-full border border-slate-100 text-[9px] font-black text-primary uppercase tracking-widest shadow-sm">
                                                    Primary Diagnosis
                                                </div>
                                                <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-2xl border border-slate-100 pt-5 min-h-[60px]">
                                                    <p className="text-sm font-semibold text-slate-800 leading-relaxed italic opacity-90">
                                                        "{patient.diagnosis}"
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-3 pt-2">
                                                <Link to={`/dashboard?patientId=${patient.patient_id}`} className="flex-[2]">
                                                    <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95 text-xs">
                                                        Access Dashboard
                                                    </Button>
                                                </Link>
                                                <div className="flex-1">
                                                    <DeletePatientDialog
                                                        patientId={patient.patient_id}
                                                        patientName={patient.patient_name}
                                                        onPatientDeleted={fetchPatients}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredPatients.length === 0 && (
                                    <div className="col-span-full text-center py-24 bg-white/40 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300/50">
                                        <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                            <Search className="w-10 h-10 text-muted-foreground/50" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-foreground">No patients found in this ICU</h3>
                                        <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                                            Try adjusting your search terms or add a new patient to this unit.
                                        </p>
                                        <div className="mt-8">
                                            <AddPatientDialog onPatientAdded={fetchPatients} icuId={selectedICU!.icu_id} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PatientRecords;
