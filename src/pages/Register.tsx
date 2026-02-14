import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Hospital, UserPlus, ShieldCheck, RefreshCw, User, Building2, Stethoscope } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_BASE_URL } from '@/config';

const Register = () => {
    const [registrationType, setRegistrationType] = useState('hospital'); // 'hospital' | 'staff'
    const [formData, setFormData] = useState({
        hospital_name: '',
        address: '',
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        hospital_id: '',
        assigned_icu_id: '' // Optional for staff, but good to have
    });
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [icus, setIcus] = useState<any[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [captchaInput, setCaptchaInput] = useState('');
    const [captchaChallenge, setCaptchaChallenge] = useState({ q: '', a: '' });
    const navigate = useNavigate();
    const { toast } = useToast();

    // Fetch Hospitals on Mount
    useEffect(() => {
        const fetchHospitals = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/public/hospitals`);
                if (res.ok) {
                    const data = await res.json();
                    setHospitals(data);
                }
            } catch (error) {
                console.error("Failed to fetch hospitals", error);
            }
        };
        fetchHospitals();
        generateCaptcha();
    }, []);

    // Fetch ICUs when Hospital Selected
    useEffect(() => {
        if (formData.hospital_id) {
            const fetchIcus = async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/public/hospitals/${formData.hospital_id}/icus`);
                    if (res.ok) {
                        const data = await res.json();
                        setIcus(data);
                    }
                } catch (error) {
                    console.error("Failed to fetch ICUs", error);
                }
            };
            fetchIcus();
        } else {
            setIcus([]);
        }
    }, [formData.hospital_id]);

    const generateCaptcha = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCaptchaChallenge({ q: result, a: result });
        setCaptchaInput('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleValueChange = (name: string, value: string) => {
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (captchaInput.toLowerCase() !== captchaChallenge.a.toLowerCase()) {
            toast({
                variant: "destructive",
                title: "CAPTCHA Failed",
                description: "Please enter the characters correctly.",
            });
            generateCaptcha();
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            return toast({
                variant: "destructive",
                title: "Passwords mismatch",
                description: "Please ensure both passwords match",
            });
        }

        setIsLoading(true);

        try {
            const payload = {
                ...formData,
                registrationType
            };

            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                toast({
                    title: "Registration Successful",
                    description: `${registrationType === 'staff' ? 'Staff' : 'Hospital'} account created. Please login.`,
                });
                navigate('/login');
            } else {
                toast({
                    variant: "destructive",
                    title: "Registration Failed",
                    description: data.error || "Something went wrong",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not connect to the server",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 p-2 md:p-4 py-8 md:py-12 relative overflow-hidden">
            {/* Grid Background Pattern */}
            <div
                className="absolute inset-0 opacity-[0.15]"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, rgb(148 163 184 / 0.3) 1px, transparent 1px),
                        linear-gradient(to bottom, rgb(148 163 184 / 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-48 -mt-48" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -ml-48 -mb-48" />

            <Card className="w-full max-w-2xl relative bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-2xl shadow-slate-200/50">
                <CardHeader className="space-y-3 pb-6">
                    <div className="flex items-center justify-center mb-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-primary/20 rounded-2xl blur-xl" />
                            <div className="relative bg-gradient-to-br from-emerald-50 to-primary/10 p-4 rounded-2xl border border-emerald-200/50 shadow-lg">
                                <img src="/eye logo.png" alt="e-Vilochan" className="w-10 h-10" />
                            </div>
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <h2 className="text-sm font-bold text-blue-600 tracking-[0.3em]"><span className="text-[11px]">e</span>-Vilochan</h2>
                        <CardTitle className="text-3xl text-center font-black tracking-tight text-slate-900">
                            Create Account
                        </CardTitle>
                    </div>
                    <CardDescription className="text-center text-slate-600 font-medium">
                        Register as a new Hospital or join as Clinical Staff
                    </CardDescription>
                </CardHeader>

                <Tabs value={registrationType} onValueChange={setRegistrationType} className="w-full">
                    <div className="px-6">
                        <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-slate-100 p-1 rounded-xl">
                            <TabsTrigger
                                value="hospital"
                                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/30 font-bold rounded-lg transition-all"
                            >
                                <Building2 className="w-4 h-4 mr-2" />
                                Hospital
                            </TabsTrigger>
                            <TabsTrigger
                                value="staff"
                                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/30 font-bold rounded-lg transition-all"
                            >
                                <Stethoscope className="w-4 h-4 mr-2" />
                                Staff
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-6">

                            {/* Hospital Specific Fields */}
                            <TabsContent value="hospital" className="space-y-5 data-[state=active]:block mt-0">
                                <div className="bg-gradient-to-br from-emerald-50/50 to-transparent p-5 rounded-2xl border border-emerald-200/50">
                                    <h3 className="font-black text-xs uppercase tracking-widest text-emerald-700 flex items-center mb-4">
                                        <Hospital className="w-4 h-4 mr-2" /> Hospital Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital Name</label>
                                            <Input name="hospital_name" value={formData.hospital_name} onChange={handleChange} required={registrationType === 'hospital'} placeholder="Apollo Hospital" className="h-11 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Address</label>
                                            <Input name="address" value={formData.address} onChange={handleChange} required={registrationType === 'hospital'} placeholder="City St, Building 4" className="h-11 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Staff Specific Fields */}
                            <TabsContent value="staff" className="space-y-5 data-[state=active]:block mt-0">
                                <div className="bg-gradient-to-br from-emerald-50/50 to-transparent p-5 rounded-2xl border border-emerald-200/50">
                                    <h3 className="font-black text-xs uppercase tracking-widest text-emerald-700 flex items-center mb-4">
                                        <Hospital className="w-4 h-4 mr-2" /> Select Workplace
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Hospital</label>
                                            <Select onValueChange={(val) => handleValueChange('hospital_id', val)}>
                                                <SelectTrigger className="h-11 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm">
                                                    <SelectValue placeholder="Choose your hospital" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {hospitals.map((h) => (
                                                        <SelectItem key={h.hospital_id} value={h.hospital_id.toString()}>
                                                            {h.hospital_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {formData.hospital_id && (
                                            <div className="space-y-2 transition-all animate-in fade-in slide-in-from-top-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select ICU (Optional)</label>
                                                <Select onValueChange={(val) => handleValueChange('assigned_icu_id', val)}>
                                                    <SelectTrigger className="h-11 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm">
                                                        <SelectValue placeholder="Choose your ICU" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {icus.map((icu) => (
                                                            <SelectItem key={icu.icu_id} value={icu.icu_id.toString()}>
                                                                {icu.icu_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Common User Details */}
                            <div className="space-y-5 pt-2 border-t-2 border-slate-100">
                                <h3 className="font-black text-xs uppercase tracking-widest text-slate-600 flex items-center pt-2">
                                    {registrationType === 'hospital' ? <UserPlus className="w-4 h-4 mr-2" /> : <User className="w-4 h-4 mr-2" />}
                                    {registrationType === 'hospital' ? 'Admin Details' : 'Staff Details'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                                        <Input name="name" value={formData.name} onChange={handleChange} required placeholder="Dr. Smith" className="h-11 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                                        <Input name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="doctor@hospital.com" className="h-11 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                                        <Input name="password" type="password" value={formData.password} onChange={handleChange} required className="h-11 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confirm Password</label>
                                        <Input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required className="h-11 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Captcha */}
                            <div className="space-y-4 bg-gradient-to-br from-slate-50 to-emerald-50/30 p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                                <span className="text-xs font-black text-slate-500 flex items-center gap-2 uppercase tracking-wider">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    Security Verification
                                </span>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 bg-white h-14 rounded-xl flex items-center justify-center border-2 border-slate-200 overflow-hidden relative select-none shadow-sm">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span
                                                className="text-2xl font-bold tracking-[0.3em] text-slate-700 italic"
                                                style={{
                                                    fontFamily: "'Courier New', Courier, monospace",
                                                    textShadow: "1px 1px 2px rgba(0,0,0,0.1)",
                                                    transform: "skewX(-15deg)"
                                                }}
                                            >
                                                {captchaChallenge.q}
                                            </span>
                                        </div>
                                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '4px 4px' }}></div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={generateCaptcha}
                                        className="h-14 w-14 border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all shadow-sm"
                                        title="Refresh CAPTCHA"
                                    >
                                        <RefreshCw className="w-5 h-5 text-slate-600" />
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Input
                                        type="text"
                                        placeholder="Type the characters above"
                                        value={captchaInput}
                                        onChange={(e) => setCaptchaInput(e.target.value)}
                                        className="text-center font-bold text-lg h-12 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm"
                                        required
                                    />
                                    <p className="text-xs text-slate-500 text-center font-medium">
                                        Please enter the characters to confirm your registration
                                    </p>
                                </div>
                            </div>

                        </CardContent>
                        <CardFooter className="flex flex-col space-y-5 pt-2">
                            <Button
                                type="submit"
                                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold text-base shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all hover:scale-[1.02] active:scale-95"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Creating account...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <UserPlus className="w-4 h-4" />
                                        {registrationType === 'hospital' ? 'Register Hospital' : 'Register as Staff'}
                                    </span>
                                )}
                            </Button>
                            <p className="text-sm text-center text-slate-600 font-medium">
                                Already have an account?{" "}
                                <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors">
                                    Login
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Tabs>
            </Card>
        </div>
    );
};

export default Register;
