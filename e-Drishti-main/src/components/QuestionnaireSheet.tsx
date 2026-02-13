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
import { HelpCircle, Plus, Trash2, Edit2, Loader2, Save, X, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Questionnaire {
    questionnaire_id: number;
    patient_id: number;
    doctor_id: number;
    doctor_name: string;
    question: string;
    answer: string | null;
    status: 'pending' | 'answered';
    created_at: string;
    updated_at: string;
}

interface QuestionnaireSheetProps {
    patientId: string | number;
    patientName: string;
    customButton?: React.ReactNode;
}

export const QuestionnaireView = ({ patientId, patientName }: { patientId: string | number; patientName: string }) => {
    const { token, user } = useAuth();
    const { toast } = useToast();
    const [questions, setQuestions] = useState<Questionnaire[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        question: '',
        answer: ''
    });

    const isDoctor = user?.role === 'doctor' || user?.role === 'admin';

    useEffect(() => {
        if (patientId) {
            fetchQuestionnaires();
        }
    }, [patientId]);

    const fetchQuestionnaires = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/questionnaires/${patientId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setQuestions(data);
            }
        } catch (error) {
            console.error("Failed to fetch questionnaires", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.question) return;

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/questionnaires/${editingId}`
                : `${API_BASE_URL}/api/questionnaires`;

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
                    title: editingId ? "Question Updated" : "Question Added",
                    description: "The clinical questionnaire has been updated."
                });
                resetForm();
                fetchQuestionnaires();
            }
        } catch (error) {
            console.error("Save failed", error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this question?")) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/questionnaires/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                toast({ title: "Deleted", description: "Question removed successfully" });
                fetchQuestionnaires();
            }
        } catch (error) {
            console.error("Delete failed", error);
        }
    };

    const handleEdit = (q: Questionnaire) => {
        setEditingId(q.questionnaire_id);
        setFormData({
            question: q.question,
            answer: q.answer || ''
        });
        setIsAdding(true);
    };

    const resetForm = () => {
        setFormData({ question: '', answer: '' });
        setIsAdding(false);
        setEditingId(null);
    };

    return (
        <div className="flex flex-col h-full bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-gradient-to-br from-blue-50 to-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100/50 mb-1">
                            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Clinical Questionnaire</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                            Patient Q&A
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Monitoring outcomes for <span className="text-slate-900 font-bold">{patientName}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {isAdding && isDoctor && (
                    <div className="p-8 bg-slate-50 border-b border-slate-100 space-y-6 animate-in slide-in-from-top duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                                {editingId ? 'Edit Entry' : 'New Clinical Question'}
                            </h3>
                            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0 rounded-full hover:bg-slate-200">
                                <X className="w-4 h-4 text-slate-500" />
                            </Button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Question</label>
                                <Input
                                    placeholder="e.g. Any history of allergy to Penicillin?"
                                    className="bg-white border-slate-200 focus:border-blue-500 h-11"
                                    value={formData.question}
                                    onChange={e => setFormData({ ...formData, question: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Response/Answer</label>
                                <Textarea
                                    placeholder="Enter findings or patient response..."
                                    className="bg-white border-slate-200 focus:border-blue-500 min-h-[100px] resize-none"
                                    value={formData.answer}
                                    onChange={e => setFormData({ ...formData, answer: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="outline" onClick={resetForm} className="rounded-full px-6 font-bold">Cancel</Button>
                                <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 px-8 rounded-full shadow-lg active:scale-95">
                                    <Save className="w-4 h-4 mr-2" />
                                    {editingId ? 'Update Entry' : 'Save Question'}
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
                    ) : questions.length === 0 ? (
                        <div className="text-center py-24 px-10">
                            <div className="bg-white/50 shadow-sm border border-slate-100 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 transform rotate-12 glow-blue">
                                <MessageSquare className="w-12 h-12 text-slate-200" />
                            </div>
                            <h3 className="text-slate-900 font-bold text-lg mb-2">No records found</h3>
                            <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed italic">No specific clinical questions have been recorded for this patient yet.</p>
                            {isDoctor && !isAdding && (
                                <Button
                                    onClick={() => setIsAdding(true)}
                                    variant="outline"
                                    className="mt-8 rounded-full border-dashed border-2 px-8 font-bold"
                                >
                                    Initiate Questionnaire
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {isDoctor && !isAdding && (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="w-full h-16 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-4 hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                        <Plus className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-700">Add New clinical Question</span>
                                </button>
                            )}
                            {questions.map((q) => (
                                <div key={q.questionnaire_id} className="group relative bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-200/50 transition-all duration-300">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-blue-50 rounded-xl">
                                                    <HelpCircle className="w-4 h-4 text-blue-500" />
                                                </div>
                                                <h4 className="font-bold text-slate-900 text-lg leading-tight">
                                                    {q.question}
                                                </h4>
                                            </div>

                                            {q.answer ? (
                                                <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 flex gap-3">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                    <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                                        {q.answer}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-4 flex gap-3">
                                                    <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                    <p className="text-sm text-amber-700 font-bold italic tracking-tight">
                                                        Awaiting response...
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {isDoctor && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl" onClick={() => handleEdit(q)}>
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl" onClick={() => handleDelete(q.questionnaire_id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 uppercase">
                                                {q.doctor_name?.charAt(0) || 'S'}
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                Logged by {q.doctor_name ? `Dr. ${q.doctor_name}` : 'Staff'}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold">
                                            {new Date(q.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
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

const QuestionnaireSheet = ({ patientId, patientName, customButton }: QuestionnaireSheetProps) => {
    return (
        <Sheet>
            <SheetTrigger asChild>
                {customButton ? customButton : (
                    <Button variant="outline" className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border-slate-200 hover:bg-white hover:border-primary/50 transition-all hover:scale-105 shadow-sm rounded-full px-4 text-slate-700">
                        <HelpCircle className="w-4 h-4 text-blue-500" />
                        Questionnaire
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="w-[450px] sm:w-[650px] p-0 bg-transparent border-none">
                <QuestionnaireView patientId={patientId} patientName={patientName} />
            </SheetContent>
        </Sheet>
    );
};

export default QuestionnaireSheet;
