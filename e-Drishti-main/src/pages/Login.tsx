import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { LogIn, ShieldCheck, RefreshCw, Eye } from 'lucide-react';
import { API_BASE_URL } from '@/config';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [captchaChallenge, setCaptchaChallenge] = useState({ q: '', a: '' });
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const generateCaptcha = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCaptchaChallenge({ q: result, a: result });
        setCaptchaInput('');
    };

    useEffect(() => {
        generateCaptcha();
    }, []);

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

        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                login(data.token, data.user);
                toast({
                    title: "Login Successful",
                    description: `Welcome back, ${data.user.name}`,
                });
                if (data.user.role === 'staff') {
                    navigate('/patients');
                } else {
                    navigate('/');
                }
            } else {
                toast({
                    variant: "destructive",
                    title: "Login Failed",
                    description: data.error || "Invalid credentials",
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 p-4 relative overflow-hidden">
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

            <Card className="w-full max-w-md relative bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-2xl shadow-slate-200/50">
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
                        <h2 className="text-sm font-bold text-blue-600 tracking-[0.3em]">e-Vilochan</h2>
                        <CardTitle className="text-3xl text-center font-black tracking-tight text-slate-900">
                            Clinical Login
                        </CardTitle>
                    </div>
                    <CardDescription className="text-center text-slate-600 font-medium">
                        Enter your credentials to access the ICU management system
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                            <Input
                                type="email"
                                placeholder="doctor@hospital.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-12 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                                <Link
                                    to="/forgot-password"
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 shadow-sm"
                                required
                            />
                        </div>
                        <div className="space-y-4 pt-2">
                            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                                <span className="text-xs font-black text-slate-500 flex items-center gap-2 mb-3 uppercase tracking-wider">
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
                                    Please enter the characters to verify you're human
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
                                    Logging in...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <LogIn className="w-4 h-4" />
                                    Login to Dashboard
                                </span>
                            )}
                        </Button>
                        <p className="text-sm text-center text-slate-600 font-medium">
                            Don't have an account?{" "}
                            <Link to="/register" className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors">
                                Register your Account
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default Login;
