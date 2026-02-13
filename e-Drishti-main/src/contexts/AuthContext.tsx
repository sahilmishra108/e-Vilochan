import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
    doctor_id: number;
    name: string;
    email: string;
    hospital_id: number;
    role?: 'admin' | 'doctor' | 'staff';
    icu_id?: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
    }, []);

    const login = (token: string, user: User) => {
        setToken(token);
        setUser(user);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = {
            ...init?.headers,
            'Authorization': `Bearer ${token || localStorage.getItem('token')}`,
        };
        return fetch(input, { ...init, headers });
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
