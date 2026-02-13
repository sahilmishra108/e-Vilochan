import { useEffect, useState } from 'react';
import ChatSheet from './ChatSheet';
import PrescriptionSheet from './PrescriptionSheet';
import { Card } from '@/components/ui/card';
import { Filter, Download, RefreshCw, Activity, Trash2, Heart, Wind, Thermometer, Waves, TrendingUp, BarChart2 } from 'lucide-react';
import { io } from 'socket.io-client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/config';

import ConnectWithPatient from './ConnectWithPatient';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import { BrainCircuit, FileText } from "lucide-react";


interface VitalRecord {
  vital_id?: number;
  created_at: string;
  hr: number | null;
  pulse: number | null;
  spo2: number | null;
  etco2: number | null;
  abp: string | null;
  pap: string | null;
  awrr: number | null;
  source?: string;
  patient_id?: number;
  additional_data?: Record<string, any>;
}

interface Patient {
  patient_id: number;
  patient_name: string;
  age: number;
  gender: string;
  diagnosis: string;
  admission_date: string;
  bed_id: number | null;
  bed_number?: string;
  icu_name?: string;
  hospital_name?: string;
}

interface DashboardProps {
  patientId: string | null;
  patientData?: any;
}

const Dashboard = ({ patientId, patientData }: DashboardProps) => {
  const [vitalsHistory, setVitalsHistory] = useState<VitalRecord[]>([]);
  const [filteredVitals, setFilteredVitals] = useState<VitalRecord[]>([]);
  const [patient, setPatient] = useState<any>(patientData || null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const { authFetch } = useAuth();
  const [extremes, setExtremes] = useState({
    hr: { min: 0, minTime: '', max: 0, maxTime: '' },
    pulse: { min: 0, minTime: '', max: 0, maxTime: '' },
    spo2: { min: 0, minTime: '', max: 0, maxTime: '' },
    abp: { sysMin: 0, sysMinTime: '', sysMax: 0, sysMaxTime: '', diaMin: 0, diaMinTime: '', diaMax: 0, diaMaxTime: '' },
    pap: { sysMin: 0, sysMinTime: '', sysMax: 0, sysMaxTime: '', diaMin: 0, diaMinTime: '', diaMax: 0, diaMaxTime: '' },
    etco2: { min: 0, minTime: '', max: 0, maxTime: '' },
    awrr: { min: 0, minTime: '', max: 0, maxTime: '' }
  });

  // SBAR State Moved to DashboardPage.tsx

  useEffect(() => {
    // Update patient state if patientData prop changes
    if (patientData) {
      setPatient(patientData);
    }
  }, [patientData]);

  useEffect(() => {
    fetchVitalsHistory();
    // Patient details now fetched in DashboardPage.tsx


    // Connect to Socket.io server
    const socket = io(API_BASE_URL);

    if (patientId) {
      socket.emit('join-patient', patientId);
    }

    socket.on('vital-update', () => {
      fetchVitalsHistory();
    });

    return () => {
      socket.disconnect();
    };
  }, [patientId]);

  useEffect(() => {
    applyDateFilter();
  }, [vitalsHistory, dateFrom, dateTo]);

  const fetchPatientDetails = async () => {
    // Redundant - moved to DashboardPage.tsx
  };

  const fetchVitalsHistory = async () => {
    try {
      const url = patientId
        ? `${API_BASE_URL}/api/vitals/${patientId}`
        : `${API_BASE_URL}/api/vitals?limit=1000`;

      console.log('[Dashboard] Fetching vitals from:', url);
      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('[Dashboard] Received vitals:', data.length, 'records');
        console.log('[Dashboard] Latest vital:', data[data.length - 1]);
        setVitalsHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const applyDateFilter = () => {
    let filtered = [...vitalsHistory];
    const isFiltered = dateFrom || dateTo;

    if (dateFrom) {
      const fromDate = new Date(`${dateFrom}T00:00:00`);
      filtered = filtered.filter(
        (v) => new Date(v.created_at) >= fromDate
      );
    }

    if (dateTo) {
      const toDate = new Date(`${dateTo}T23:59:59`);
      filtered = filtered.filter(
        (v) => new Date(v.created_at) <= toDate
      );
    }

    setFilteredVitals(isFiltered ? filtered : vitalsHistory);
    calculateExtremes(isFiltered ? filtered : vitalsHistory);
  };
  const clearAllVitals = async () => {
    if (!confirm('Are you sure you want to clear ALL vital history? This cannot be undone.')) return;

    try {
      const url = patientId
        ? `${API_BASE_URL}/api/vitals?patientId=${patientId}`
        : `${API_BASE_URL}/api/vitals`;

      const response = await authFetch(url, {
        method: 'DELETE',
      });

      if (response.ok) {
        setVitalsHistory([]);
        setFilteredVitals([]);
      } else {
        console.error('Failed to clear vitals');
        alert('Failed to clear vitals');
      }
    } catch (error) {
      console.error('Error clearing vitals:', error);
    }
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  const calculateExtremes = (data: VitalRecord[]) => {
    const validData = data.filter(d => d.hr !== null || d.pulse !== null || d.abp !== null);
    if (validData.length === 0) {
      setExtremes({
        hr: { min: 0, minTime: '', max: 0, maxTime: '' },
        pulse: { min: 0, minTime: '', max: 0, maxTime: '' },
        spo2: { min: 0, minTime: '', max: 0, maxTime: '' },
        abp: { sysMin: 0, sysMinTime: '', sysMax: 0, sysMaxTime: '', diaMin: 0, diaMinTime: '', diaMax: 0, diaMaxTime: '' },
        pap: { sysMin: 0, sysMinTime: '', sysMax: 0, sysMaxTime: '', diaMin: 0, diaMinTime: '', diaMax: 0, diaMaxTime: '' },
        etco2: { min: 0, minTime: '', max: 0, maxTime: '' },
        awrr: { min: 0, minTime: '', max: 0, maxTime: '' }
      });
      return;
    };

    const initial = {
      hr: { min: Infinity, minTime: '', max: -Infinity, maxTime: '' },
      pulse: { min: Infinity, minTime: '', max: -Infinity, maxTime: '' },
      spo2: { min: Infinity, minTime: '', max: -Infinity, maxTime: '' },
      abp: { sysMin: Infinity, sysMinTime: '', sysMax: -Infinity, sysMaxTime: '', diaMin: Infinity, diaMinTime: '', diaMax: -Infinity, diaMaxTime: '' },
      pap: { sysMin: Infinity, sysMinTime: '', sysMax: -Infinity, sysMaxTime: '', diaMin: Infinity, diaMinTime: '', diaMax: -Infinity, diaMaxTime: '' },
      etco2: { min: Infinity, minTime: '', max: -Infinity, maxTime: '' },
      awrr: { min: Infinity, minTime: '', max: -Infinity, maxTime: '' }
    };

    const ex = validData.reduce((acc, curr) => {
      const update = (accRange: { min: number, minTime: string, max: number, maxTime: string }, val: number, time: string) => {
        if (val === 0) return accRange;
        return {
          min: Math.min(accRange.min, val),
          minTime: val < accRange.min ? time : accRange.minTime,
          max: Math.max(accRange.max, val),
          maxTime: val > accRange.max ? time : accRange.maxTime
        };
      };

      const parsePressure = (val: string | null) => {
        if (!val || !val.includes('/')) return { sys: 0, dia: 0 };
        const [s, d] = val.split('/').map(n => parseInt(n) || 0);
        return { sys: s || 0, dia: d || 0 };
      };

      const abpVals = parsePressure(curr.abp);
      const papVals = parsePressure(curr.pap);
      const time = curr.created_at;

      return {
        hr: update(acc.hr, curr.hr || 0, time),
        pulse: update(acc.pulse, curr.pulse || 0, time),
        spo2: update(acc.spo2, curr.spo2 || 0, time),
        abp: {
          sysMin: abpVals.sys && abpVals.sys < acc.abp.sysMin ? abpVals.sys : acc.abp.sysMin,
          sysMinTime: abpVals.sys && abpVals.sys < acc.abp.sysMin ? time : acc.abp.sysMinTime,
          sysMax: abpVals.sys && abpVals.sys > acc.abp.sysMax ? abpVals.sys : acc.abp.sysMax,
          sysMaxTime: abpVals.sys && abpVals.sys > acc.abp.sysMax ? time : acc.abp.sysMaxTime,
          diaMin: abpVals.dia && abpVals.dia < acc.abp.diaMin ? abpVals.dia : acc.abp.diaMin,
          diaMinTime: abpVals.dia && abpVals.dia < acc.abp.diaMin ? time : acc.abp.diaMinTime,
          diaMax: abpVals.dia && abpVals.dia > acc.abp.diaMax ? abpVals.dia : acc.abp.diaMax,
          diaMaxTime: abpVals.dia && abpVals.dia > acc.abp.diaMax ? time : acc.abp.diaMaxTime,
        },
        pap: {
          sysMin: papVals.sys && papVals.sys < acc.pap.sysMin ? papVals.sys : acc.pap.sysMin,
          sysMinTime: papVals.sys && papVals.sys < acc.pap.sysMin ? time : acc.pap.sysMinTime,
          sysMax: papVals.sys && papVals.sys > acc.pap.sysMax ? papVals.sys : acc.pap.sysMax,
          sysMaxTime: papVals.sys && papVals.sys > acc.pap.sysMax ? time : acc.pap.sysMaxTime,
          diaMin: papVals.dia && papVals.dia < acc.pap.diaMin ? papVals.dia : acc.pap.diaMin,
          diaMinTime: papVals.dia && papVals.dia < acc.pap.diaMin ? time : acc.pap.diaMinTime,
          diaMax: papVals.dia && papVals.dia > acc.pap.diaMax ? papVals.dia : acc.pap.diaMax,
          diaMaxTime: papVals.dia && papVals.dia > acc.pap.diaMax ? time : acc.pap.diaMaxTime,
        },
        etco2: update(acc.etco2, curr.etco2 || 0, time),
        awrr: update(acc.awrr, curr.awrr || 0, time)
      };
    }, initial);

    const formatTimestamp = (time: string) => {
      if (!time) return '';
      const date = new Date(time);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    setExtremes({
      hr: {
        min: ex.hr.min === Infinity ? 0 : ex.hr.min,
        minTime: formatTimestamp(ex.hr.minTime),
        max: ex.hr.max === -Infinity ? 0 : ex.hr.max,
        maxTime: formatTimestamp(ex.hr.maxTime)
      },
      pulse: {
        min: ex.pulse.min === Infinity ? 0 : ex.pulse.min,
        minTime: formatTimestamp(ex.pulse.minTime),
        max: ex.pulse.max === -Infinity ? 0 : ex.pulse.max,
        maxTime: formatTimestamp(ex.pulse.maxTime)
      },
      spo2: {
        min: ex.spo2.min === Infinity ? 0 : ex.spo2.min,
        minTime: formatTimestamp(ex.spo2.minTime),
        max: ex.spo2.max === -Infinity ? 0 : ex.spo2.max,
        maxTime: formatTimestamp(ex.spo2.maxTime)
      },
      abp: {
        sysMin: ex.abp.sysMin === Infinity ? 0 : ex.abp.sysMin,
        sysMinTime: formatTimestamp(ex.abp.sysMinTime),
        sysMax: ex.abp.sysMax === -Infinity ? 0 : ex.abp.sysMax,
        sysMaxTime: formatTimestamp(ex.abp.sysMaxTime),
        diaMin: ex.abp.diaMin === Infinity ? 0 : ex.abp.diaMin,
        diaMinTime: formatTimestamp(ex.abp.diaMinTime),
        diaMax: ex.abp.diaMax === -Infinity ? 0 : ex.abp.diaMax,
        diaMaxTime: formatTimestamp(ex.abp.diaMaxTime),
      },
      pap: {
        sysMin: ex.pap.sysMin === Infinity ? 0 : ex.pap.sysMin,
        sysMinTime: formatTimestamp(ex.pap.sysMinTime),
        sysMax: ex.pap.sysMax === -Infinity ? 0 : ex.pap.sysMax,
        sysMaxTime: formatTimestamp(ex.pap.sysMaxTime),
        diaMin: ex.pap.diaMin === Infinity ? 0 : ex.pap.diaMin,
        diaMinTime: formatTimestamp(ex.pap.diaMinTime),
        diaMax: ex.pap.diaMax === -Infinity ? 0 : ex.pap.diaMax,
        diaMaxTime: formatTimestamp(ex.pap.diaMaxTime),
      },
      etco2: {
        min: ex.etco2.min === Infinity ? 0 : ex.etco2.min,
        minTime: formatTimestamp(ex.etco2.minTime),
        max: ex.etco2.max === -Infinity ? 0 : ex.etco2.max,
        maxTime: formatTimestamp(ex.etco2.maxTime)
      },
      awrr: {
        min: ex.awrr.min === Infinity ? 0 : ex.awrr.min,
        minTime: formatTimestamp(ex.awrr.minTime),
        max: ex.awrr.max === -Infinity ? 0 : ex.awrr.max,
        maxTime: formatTimestamp(ex.awrr.maxTime)
      }
    });
  };

  const chartData = filteredVitals.map((record) => ({
    time: new Date(record.created_at).toLocaleTimeString(),
    HR: record.hr || 0,
    Pulse: record.pulse || 0,
    SpO2: record.spo2 || 0,
    EtCO2: record.etco2 || 0
  }));

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Source', 'HR (bpm)', 'Pulse (bpm)', 'SpO2 (%)', 'ABP (mmHg)', 'PAP (mmHg)', 'EtCO2 (mmHg)', 'awRR (/min)'];
    const rows = filteredVitals
      .slice()
      .map(record => [
        new Date(record.created_at).toLocaleString(),
        record.source || 'N/A',
        record.hr ?? 'N/A',
        record.pulse ?? 'N/A',
        record.spo2 ?? 'N/A',
        record.abp ? ` ${record.abp}` : 'N/A',
        record.pap ? ` ${record.pap}` : 'N/A',
        record.etco2 ?? 'N/A',
        record.awrr ?? 'N/A'
      ]);

    // Format as proper CSV with quoted values to handle commas in timestamps
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vitals-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (value: number | null, type: 'hr' | 'spo2' | 'etco2' | 'awrr') => {
    if (value === null) return 'text-muted-foreground';

    if (type === 'hr') {
      if (value < 60 || value > 100) return 'text-red-600 font-semibold';
      if (value < 70 || value > 90) return 'text-yellow-600';
      return 'text-green-600';
    }

    if (type === 'spo2') {
      if (value < 90) return 'text-red-600 font-semibold';
      if (value < 95) return 'text-yellow-600';
      return 'text-green-600';
    }

    return 'text-foreground';
  };

  return (
    <div className="space-y-8 animate-fade-in">


      {/* Connect with Patient Button Section Removed - Moved to Sidebar */}

      {/* Clinical Command Header */}
      <div className="relative w-full rounded-[2rem] overflow-hidden shadow-2xl animate-scale-in border border-white/10 bg-slate-900 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-slate-900 to-blue-500/10 z-0 opacity-50"></div>

        <div className="relative z-10 p-8 md:p-10 flex flex-col gap-6">
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            {patient ? `${patient.patient_name}'s Dashboard` : 'Patient Console'}
          </h1>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
            {[
              { label: 'Patient ID', value: patient ? `#PAT-${patient.patient_id.toString().padStart(4, '0')}` : 'N/A', color: 'text-primary' },
              { label: 'Bed ID', value: patient?.bed_number || 'N/A', color: 'text-white' },
              { label: 'Age', value: patient ? `${patient.age} Yrs` : 'N/A', color: 'text-white' },
              { label: 'Diagnosis', value: patient?.diagnosis || 'General Observation', color: 'text-emerald-400' }
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-900/40 backdrop-blur-md p-4 flex flex-col gap-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{item.label}</span>
                <span className={`text-sm font-bold tracking-wider ${item.color} truncate`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Subtle bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60"></div>
      </div>

      {/* Date Filter */}
      <Card className="p-8 bg-white/60 backdrop-blur-md border-white/20 shadow-xl rounded-[2rem]">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Temporal Diagnostics</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filter monitoring data by timeline</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">
              Start Record
            </label>
            <Input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-white/50 border-white/20 focus:ring-primary/20 rounded-xl h-11 font-bold text-slate-700 transition-all hover:bg-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">
              End Record
            </label>
            <Input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-white/50 border-white/20 focus:ring-primary/20 rounded-xl h-11 font-bold text-slate-700 transition-all hover:bg-white"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={clearFilters}
              className="w-full h-11 rounded-xl hover:bg-white uppercase text-[10px] font-black tracking-widest border-white/20"
            >
              Reset Console Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Clinical Session Insights Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-1.5 bg-primary rounded-full"></div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Session Analytics</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Clinical Extreme Tracking</p>
          </div>
        </div>
        <div />
      </div>

      {/* Professional Medical Vital Panel - Image Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6 px-4 pb-8">
        {[
          { label: 'Heart Rate', value: extremes.hr, unit: 'bpm', color: 'rose', icon: Heart, type: 'single', animation: 'animate-pulse' },
          { label: 'Pulse Rate', value: extremes.pulse, unit: 'bpm', color: 'rose', icon: Activity, type: 'single', animation: 'animate-bounce-subtle' },
          { label: 'SpO2', value: extremes.spo2, unit: '%', color: 'cyan', icon: Wind, type: 'single', animation: 'animate-pulse-slow' },
          { label: 'ABP', value: extremes.abp, unit: 'mmHg', color: 'amber', icon: BarChart2, type: 'pressure', animation: 'animate-pulse-fast' },
          { label: 'PAP', value: extremes.pap, unit: 'mmHg', color: 'amber', icon: TrendingUp, type: 'pressure', animation: 'animate-pulse-fast' },
          { label: 'EtCO2', value: extremes.etco2, unit: 'mmHg', color: 'emerald', icon: Thermometer, type: 'single', animation: 'animate-pulse-slow' },
          { label: 'awRR', value: extremes.awrr, unit: '/min', color: 'blue', icon: Waves, type: 'single', animation: 'animate-pulse' },
        ].map((item, idx) => (
          <Card
            key={idx}
            className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_15px_35px_rgba(0,0,0,0.03)] transition-all duration-300 hover:shadow-[0_25px_50px_rgba(0,0,0,0.06)] hover:-translate-y-1 animate-fade-in-up"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex flex-col items-center mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-${item.color}-50/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] border border-${item.color}-100/50 mb-2 transition-transform duration-500 group-hover:scale-110`}>
                <item.icon className={`h-5 w-5 text-${item.color}-500 ${(item as any).animation}`} />
              </div>
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.1em] text-center mb-0.5 leading-tight">{item.label}</h3>
              <span className="text-[8px] font-extrabold text-slate-300 uppercase tracking-[0.1em]">{item.unit === 'mmHg' ? 'MMHG' : item.unit === 'bpm' ? 'BPM' : item.unit}</span>
            </div>

            <div className="border-t border-slate-50 w-full mb-4" />

            <div className="grid grid-cols-2 w-full gap-0">
              {/* MAX Column */}
              <div className="flex flex-col items-center border-r border-slate-50 px-0.5">
                <span className="text-[7.5px] font-black text-slate-300 uppercase tracking-widest mb-1">MAX</span>
                <div className="flex flex-col items-center">
                  {item.type === 'single' ? (
                    <span className="text-xl font-black text-slate-800 tracking-tighter leading-none">
                      {(item.value as any).max}
                    </span>
                  ) : (
                    <div className="flex items-center leading-none">
                      <span className="text-[14px] font-black text-slate-800 tracking-tighter">{(item.value as any).sysMax}</span>
                      <span className="text-[10px] font-black text-slate-200 mx-0.5">/</span>
                      <span className="text-[10px] font-black text-slate-400 tracking-tighter">{(item.value as any).diaMax}</span>
                    </div>
                  )}
                  <span className="text-[7.5px] font-black text-slate-600 text-center leading-tight mt-1 px-1">
                    [{(item.value as any).maxTime || (item.value as any).sysMaxTime}]
                  </span>
                </div>
              </div>

              {/* MIN Column */}
              <div className="flex flex-col items-center px-0.5">
                <span className="text-[7.5px] font-black text-slate-300 uppercase tracking-widest mb-1">MIN</span>
                <div className="flex flex-col items-center">
                  {item.type === 'single' ? (
                    <span className="text-lg font-black text-slate-500 tracking-tighter leading-none">
                      {(item.value as any).min}
                    </span>
                  ) : (
                    <div className="flex items-center leading-none">
                      <span className="text-[13px] font-black text-slate-500 tracking-tighter">{(item.value as any).sysMin}</span>
                      <span className="text-[8px] font-black text-slate-200 mx-0.5">/</span>
                      <span className="text-[9px] font-black text-slate-300 tracking-tighter">{(item.value as any).diaMin}</span>
                    </div>
                  )}
                  <span className="text-[7.5px] font-black text-slate-500 text-center leading-tight mt-1 px-1">
                    [{(item.value as any).minTime || (item.value as any).sysMinTime}]
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Dynamic Vitals - Extra Parameters Section */}
      {vitalsHistory.length > 0 && vitalsHistory[vitalsHistory.length - 1].additional_data && Object.keys(vitalsHistory[vitalsHistory.length - 1].additional_data || {}).length > 0 && (
        <div className="mb-8 animate-fade-in-up delay-500">
          <div className="flex items-center gap-4 mb-4 px-6">
            <div className="flex h-8 w-1.5 bg-indigo-500 rounded-full"></div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">Extended Diagnostics</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Dynamically Detected Parameters</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 px-4">
            {Object.entries(vitalsHistory[vitalsHistory.length - 1].additional_data || {}).map(([key, value], idx) => (
              <Card
                key={`extra-${idx}`}
                className="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-indigo-100 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
              >
                <div className="flex flex-col items-center">
                  <h3 className="text-[10px] font-black text-indigo-800 uppercase tracking-[0.1em] text-center mb-1">{key}</h3>
                  <span className="text-2xl font-black text-slate-800 tracking-tighter leading-none">{String(value)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up delay-700">
        <Card className="p-8 bg-white/60 backdrop-blur-md border-white/20 shadow-xl rounded-[2rem] hover:shadow-2xl transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Heart Dynamics</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">HR & Pulse Correlation</p>
            </div>
            <div className="flex gap-4">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></span> HR
              </span>
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-300"></span> Pulse
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fda4af" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fda4af" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} tickFormatter={(val) => val.split(' ')[0]} />
              <YAxis stroke="#94a3b8" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#1e293b'
                }}
              />
              <Area type="monotone" dataKey="HR" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorHR)" animationDuration={1000} />
              <Area type="monotone" dataKey="Pulse" stroke="#fda4af" strokeWidth={4} fillOpacity={1} fill="url(#colorPulse)" animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-8 bg-white/60 backdrop-blur-md border-white/20 shadow-xl rounded-[2rem] hover:shadow-2xl transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Ventilation Index</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">SpO2 Oxygen Saturation</p>
            </div>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-500">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]"></span> SpO2
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSpO2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} tickFormatter={(val) => val.split(' ')[0]} />
              <YAxis domain={[80, 100]} stroke="#94a3b8" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#1e293b'
                }}
              />
              <Area type="monotone" dataKey="SpO2" stroke="#06b6d4" strokeWidth={4} fillOpacity={1} fill="url(#colorSpO2)" animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Real-Time Monitoring Data Table */}
      <Card className="p-8 bg-white/60 backdrop-blur-md border-white/20 shadow-xl rounded-[2rem] overflow-hidden animate-fade-in-up delay-1000">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Clinical Monitoring Intelligence</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">High-fidelity vitals acquisition log</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVitalsHistory}
              className="gap-2 rounded-xl h-10 hover:bg-white border-white/20 uppercase text-[10px] font-black tracking-widest"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="gap-2 rounded-xl h-10 hover:bg-white border-white/20 uppercase text-[10px] font-black tracking-widest"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={clearAllVitals}
              className="gap-2 rounded-xl h-10 shadow-red-500/20 uppercase text-[10px] font-black tracking-widest"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/20 overflow-hidden bg-white/40 shadow-inner">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50/80 backdrop-blur-md z-10 border-b border-white/20">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest py-4">Timestamp</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">HR</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Pulse</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">SpO2</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">ABP</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">PAP</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">EtCO2</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">awRR</TableHead>
                  {/* Dynamic Headers */}
                  {Array.from(new Set(filteredVitals.flatMap(v => Object.keys(v.additional_data || {})))).map(key => (
                    <TableHead key={key} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center">{key}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVitals
                  .slice()
                  .slice(0, 100)
                  .map((record, index) => (
                    <TableRow
                      key={record.vital_id || index}
                      className="hover:bg-white/60 transition-colors border-b border-white/10 group"
                    >
                      <TableCell className="font-bold text-slate-700 text-xs">
                        {new Date(record.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${record.source === 'camera'
                          ? 'bg-blue-50 text-blue-600 border-blue-100'
                          : record.source === 'video'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-slate-50 text-slate-600 border-slate-100'
                          }`}>
                          {record.source || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className={`text-center font-black text-sm ${getStatusColor(record.hr, 'hr')}`}>
                        {record.hr ?? '-'}
                      </TableCell>
                      <TableCell className={`text-center font-black text-sm ${getStatusColor(record.pulse, 'hr')}`}>
                        {record.pulse ?? '-'}
                      </TableCell>
                      <TableCell className={`text-center font-black text-sm ${getStatusColor(record.spo2, 'spo2')}`}>
                        {record.spo2 ?? '-'}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs text-slate-500">
                        {record.abp ?? '-'}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs text-slate-500">
                        {record.pap ?? '-'}
                      </TableCell>
                      <TableCell className={`text-center font-black text-sm ${getStatusColor(record.etco2, 'etco2')}`}>
                        {record.etco2 ?? '-'}
                      </TableCell>
                      <TableCell className={`text-center font-black text-sm ${getStatusColor(record.awrr, 'awrr')}`}>
                        {record.awrr ?? '-'}
                      </TableCell>
                      {/* Dynamic Cells */}
                      {Array.from(new Set(filteredVitals.flatMap(v => Object.keys(v.additional_data || {})))).map(key => (
                        <TableCell key={key} className="text-center font-bold text-xs text-emerald-600">
                          {record.additional_data?.[key] ?? '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-6 border-t border-white/20 bg-slate-50/40 backdrop-blur-sm flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Showing <span className="text-slate-900">
                {Math.min(100, filteredVitals.length)}
              </span> of <span className="text-slate-900">
                {filteredVitals.length}
              </span> telemetry records
            </p>
            <div className="flex gap-1">
              {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-slate-300"></div>)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;