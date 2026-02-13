import { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from '@/config';
import { Pill, Plus, Trash2, Edit2, Download, Loader2, Save, X, FileDown, Activity, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Prescription {
    prescription_id: number;
    patient_id: number;
    doctor_id: number;
    doctor_name: string;
    medication_name: string;
    dosage: string;
    frequency: string;
    instructions: string;
    image_url: string | null;
    created_at: string;
}

interface PrescriptionSheetProps {
    patientId: string | number;
    patientName: string;
    hospitalName: string;
    customButton?: React.ReactNode;
}

export const PrescriptionView = ({ patientId, patientName, hospitalName }: { patientId: string | number; patientName: string; hospitalName: string }) => {
    const { user, token } = useAuth();
    const { toast } = useToast();
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [exporting, setExporting] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        medication_name: '',
        dosage: '',
        frequency: '',
        instructions: '',
        image_url: ''
    });

    const isDoctor = user?.role === 'doctor' || user?.role === 'admin';

    useEffect(() => {
        if (patientId) {
            fetchPrescriptions();
        }
    }, [patientId]);

    const fetchPrescriptions = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/prescriptions/${patientId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setPrescriptions(data);
            }
        } catch (error) {
            console.error("Failed to fetch prescriptions", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.medication_name) return;

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/prescriptions/${editingId}`
                : `${API_BASE_URL}/api/prescriptions`;

            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patient_id: patientId,
                    ...formData
                })
            });

            if (response.ok) {
                toast({
                    title: editingId ? "Prescription Updated" : "Prescription Added",
                    description: `${formData.medication_name} has been saved.`
                });
                resetForm();
                fetchPrescriptions();
            }
        } catch (error) {
            console.error("Save failed", error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this prescription?")) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/prescriptions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                toast({ title: "Deleted", description: "Prescription removed successfully" });
                fetchPrescriptions();
            }
        } catch (error) {
            console.error("Delete failed", error);
        }
    };

    const handleEdit = (p: Prescription) => {
        setEditingId(p.prescription_id);
        setFormData({
            medication_name: p.medication_name,
            dosage: p.dosage,
            frequency: p.frequency,
            instructions: p.instructions,
            image_url: p.image_url || ''
        });
        setIsAdding(true);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast({
                variant: "destructive",
                title: "File too large",
                description: "Images must be smaller than 5MB",
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, image_url: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const resetForm = () => {
        setFormData({ medication_name: '', dosage: '', frequency: '', instructions: '', image_url: '' });
        setIsAdding(false);
        setEditingId(null);
    };

    const handleExportFHIR = async () => {
        setExporting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}/fhir`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `EHR_${patientName.replace(/\s+/g, '_')}_FHIR.json`;
                a.click();
                toast({ title: "Export Successful", description: "HL7 FHIR Record downloaded." });
            }
        } catch (error) {
            console.error("Export failed", error);
        } finally {
            setExporting(false);
        }
    };

    const handleDownloadPDF = () => {
        if (prescriptions.length === 0) {
            toast({ title: "No Prescriptions", description: "There are no medications to download." });
            return;
        }
        setDownloading(true);
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Professional Header
            doc.setFillColor(16, 185, 129); // Emerald 500
            doc.rect(0, 0, pageWidth, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text(hospitalName.toUpperCase(), 15, 20);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text("e-Vilochan Clinical Management System", 15, 30);

            doc.setTextColor(51, 65, 85); // Slate 700
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("MEDICAL PRESCRIPTION", 15, 55);

            // Patient Info
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.text(`Patient Name: ${patientName}`, 15, 65);
            doc.text(`Date & Time: ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth - 15, 65, { align: "right" });

            // Prescription Table
            const tableData = prescriptions.map(p => [
                p.medication_name,
                p.dosage,
                p.frequency,
                p.instructions || "-",
                `Dr. ${p.doctor_name}`
            ]);

            autoTable(doc, {
                startY: 75,
                head: [['Medication', 'Dosage', 'Frequency', 'Instructions', 'Prescribed By']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 15, right: 15 }
            });

            // Footer
            const finalY = (doc as any).lastAutoTable.finalY + 30;
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic");
            doc.text("This is an electronically generated prescription from e-Vilochan.", 15, finalY);
            doc.text("No signature required.", 15, finalY + 5);

            doc.save(`Prescription_${patientName.replace(/\s+/g, '_')}.pdf`);
            toast({ title: "PDF Downloaded", description: "Prescription file is ready." });
        } catch (error) {
            console.error("PDF generation failed", error);
            toast({ title: "Error", description: "Could not generate PDF", variant: "destructive" });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100/50 mb-1">
                            <Pill className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Clinical Record</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                            Medical Prescription
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Managed medications for <span className="text-slate-900 font-bold">{patientName}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadPDF}
                            disabled={downloading}
                            className="h-9 px-4 text-xs font-bold bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all rounded-lg gap-2"
                        >
                            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-slate-500" />}
                            Download PDF
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportFHIR}
                            disabled={exporting}
                            className="h-9 px-4 text-xs font-bold bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200 shadow-sm transition-all rounded-lg gap-2"
                        >
                            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-600" />}
                            Export FHIR
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {isAdding && isDoctor && (
                    <div className="p-8 bg-slate-50 border-b border-slate-100 space-y-6 animate-in slide-in-from-top duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                                {editingId ? 'Edit Dosage' : 'New Medicine entry'}
                            </h3>
                            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0 rounded-full hover:bg-slate-200">
                                <X className="w-4 h-4 text-slate-500" />
                            </Button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Medication Name</label>
                                    <Input
                                        placeholder="e.g. Paracetamol"
                                        className="bg-white border-slate-200 focus:border-emerald-500 h-11"
                                        value={formData.medication_name}
                                        onChange={e => setFormData({ ...formData, medication_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Dosage</label>
                                        <Input
                                            placeholder="500mg"
                                            className="bg-white border-slate-200 focus:border-emerald-500 h-11"
                                            value={formData.dosage}
                                            onChange={e => setFormData({ ...formData, dosage: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Frequency</label>
                                        <Input
                                            placeholder="1-0-1"
                                            className="bg-white border-slate-200 focus:border-emerald-500 h-11"
                                            value={formData.frequency}
                                            onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Clinical Instructions</label>
                                <Textarea
                                    placeholder="Take after meals..."
                                    className="bg-white border-slate-200 focus:border-emerald-500 min-h-[100px] resize-none"
                                    value={formData.instructions}
                                    onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Attach medical Reference (Image)</label>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="bg-white border-slate-200 focus:border-emerald-500 h-11"
                                        />
                                    </div>
                                    {formData.image_url && (
                                        <div className="relative h-11 w-11 rounded-lg border border-slate-200 overflow-hidden bg-white">
                                            <img src={formData.image_url} alt="Reference" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, image_url: '' })}
                                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="outline" onClick={resetForm} className="rounded-full px-6 font-bold">Cancel</Button>
                                <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 px-8 rounded-full shadow-lg active:scale-95">
                                    <Save className="w-4 h-4 mr-2" />
                                    {editingId ? 'Update Medication' : 'Save Prescription'}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                <ScrollArea className="flex-1 p-8">
                    {loading ? (
                        <div className="flex items-center justify-center h-60">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-200" />
                        </div>
                    ) : prescriptions.length === 0 ? (
                        <div className="text-center py-24 px-10">
                            <div className="bg-white/50 shadow-sm border border-slate-100 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 transform rotate-12 glow-emerald">
                                <Pill className="w-12 h-12 text-slate-200" />
                            </div>
                            <h3 className="text-slate-900 font-bold text-lg mb-2">No active records</h3>
                            <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed italic">The patient currently has no active clinical prescriptions.</p>
                            {isDoctor && !isAdding && (
                                <Button
                                    onClick={() => setIsAdding(true)}
                                    variant="outline"
                                    className="mt-8 rounded-full border-dashed border-2 px-8 font-bold"
                                >
                                    Authorize First Medication
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {isDoctor && !isAdding && (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="h-full min-h-[180px] border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                                        <Plus className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-700">Add New Entry</span>
                                </button>
                            )}
                            {prescriptions.map((p) => (
                                <div key={p.prescription_id} className="group relative bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-emerald-200/50 transition-all duration-300">
                                    <div className="flex items-start justify-between mb-4 gap-3">
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-black text-slate-900 text-xl tracking-tight break-words">
                                                    {p.medication_name}
                                                </h4>
                                                <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-widest font-black flex items-center gap-1 whitespace-nowrap">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    Active
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md">
                                                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-600 tracking-tight">{p.dosage}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md">
                                                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-600 tracking-tight">{p.frequency}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isDoctor && (
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 flex-shrink-0">
                                                <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl" onClick={() => handleEdit(p)}>
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl" onClick={() => handleDelete(p.prescription_id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {p.instructions && (
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
                                            <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                                                “{p.instructions}”
                                            </p>
                                        </div>
                                    )}

                                    {p.image_url && (
                                        <div className="mt-4 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 mb-4">
                                            <img
                                                src={p.image_url}
                                                alt="Prescription Reference"
                                                className="w-full h-auto max-h-48 object-cover hover:scale-105 transition-transform cursor-pointer"
                                                onClick={() => window.open(p.image_url!, '_blank')}
                                            />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-auto">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 uppercase">
                                                {p.doctor_name?.charAt(0) || 'D'}
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dr. {p.doctor_name}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold">{new Date(p.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
};

const PrescriptionSheet = ({ patientId, patientName, hospitalName, customButton }: PrescriptionSheetProps) => {
    return (
        <Sheet>
            <SheetTrigger asChild>
                {customButton ? customButton : (
                    <Button variant="outline" className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border-slate-200 hover:bg-white hover:border-primary/50 transition-all hover:scale-105 shadow-sm rounded-full px-4 text-slate-700">
                        <Pill className="w-4 h-4 text-emerald-500" />
                        Prescription
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="w-[450px] sm:w-[650px] p-0 bg-transparent border-none">
                <PrescriptionView patientId={patientId} patientName={patientName} hospitalName={hospitalName} />
            </SheetContent>
        </Sheet>
    );
};

export default PrescriptionSheet;
