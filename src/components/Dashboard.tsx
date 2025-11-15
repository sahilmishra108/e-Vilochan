import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Activity, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface VitalRecord {
  created_at: string;
  hr: number | null;
  pulse: number | null;
  spo2: number | null;
  etco2: number | null;
  abp: string | null;
  pap: string | null;
  awrr: number | null;
}

const Dashboard = () => {
  const [vitalsHistory, setVitalsHistory] = useState<VitalRecord[]>([]);
  const [averages, setAverages] = useState({
    hr: 0,
    pulse: 0,
    spo2: 0,
    abpSys: 0,
    papDia: 0,
    etco2: 0,
    awrr: 0
  });

  useEffect(() => {
    fetchVitalsHistory();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('vitals-history-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vitals'
        },
        () => {
          fetchVitalsHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchVitalsHistory = async () => {
    const { data, error } = await supabase
      .from('vitals')
      .select('*')
      .eq('source', 'camera')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching vitals:', error);
      return;
    }

    if (data) {
      setVitalsHistory(data.reverse());
      calculateAverages(data);
    }
  };

  const calculateAverages = (data: VitalRecord[]) => {
    const validData = data.filter(d => d.hr !== null || d.pulse !== null);
    if (validData.length === 0) return;

    const sum = validData.reduce((acc, curr) => ({
      hr: acc.hr + (curr.hr || 0),
      pulse: acc.pulse + (curr.pulse || 0),
      spo2: acc.spo2 + (curr.spo2 || 0),
      abpSys: acc.abpSys + (curr.abp ? parseInt(curr.abp.split('/')[0]) : 0),
      papDia: acc.papDia + (curr.pap ? parseInt(curr.pap.split('/')[1]) : 0),
      etco2: acc.etco2 + (curr.etco2 || 0),
      awrr: acc.awrr + (curr.awrr || 0)
    }), { hr: 0, pulse: 0, spo2: 0, abpSys: 0, papDia: 0, etco2: 0, awrr: 0 });

    setAverages({
      hr: Math.round(sum.hr / validData.length),
      pulse: Math.round(sum.pulse / validData.length),
      spo2: Math.round(sum.spo2 / validData.length),
      abpSys: Math.round(sum.abpSys / validData.length),
      papDia: Math.round(sum.papDia / validData.length),
      etco2: Math.round(sum.etco2 / validData.length),
      awrr: Math.round(sum.awrr / validData.length)
    });
  };

  const chartData = vitalsHistory.map((record) => ({
    time: new Date(record.created_at).toLocaleTimeString(),
    HR: record.hr || 0,
    Pulse: record.pulse || 0,
    SpO2: record.spo2 || 0,
    EtCO2: record.etco2 || 0
  }));

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vitals Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Historical trends and average vitals
            </p>
          </div>
        </div>
      </Card>

      {/* Average Vitals */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground uppercase">Avg HR</p>
          <p className="text-2xl font-bold text-foreground">{averages.hr}</p>
          <p className="text-xs text-muted-foreground">bpm</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground uppercase">Avg Pulse</p>
          <p className="text-2xl font-bold text-foreground">{averages.pulse}</p>
          <p className="text-xs text-muted-foreground">bpm</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground uppercase">Avg SpO2</p>
          <p className="text-2xl font-bold text-foreground">{averages.spo2}</p>
          <p className="text-xs text-muted-foreground">%</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground uppercase">Avg ABP Sys</p>
          <p className="text-2xl font-bold text-foreground">{averages.abpSys}</p>
          <p className="text-xs text-muted-foreground">mmHg</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground uppercase">Avg PAP Dia</p>
          <p className="text-2xl font-bold text-foreground">{averages.papDia}</p>
          <p className="text-xs text-muted-foreground">mmHg</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground uppercase">Avg EtCO2</p>
          <p className="text-2xl font-bold text-foreground">{averages.etco2}</p>
          <p className="text-xs text-muted-foreground">mmHg</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground uppercase">Avg awRR</p>
          <p className="text-2xl font-bold text-foreground">{averages.awrr}</p>
          <p className="text-xs text-muted-foreground">/min</p>
        </Card>
      </div>

      {/* Charts */}
      <Card className="p-6 bg-card border-border">
        <h2 className="text-xl font-bold text-foreground mb-4">Heart Rate & Pulse Trends</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))' 
              }} 
            />
            <Legend />
            <Line type="monotone" dataKey="HR" stroke="hsl(var(--primary))" strokeWidth={2} />
            <Line type="monotone" dataKey="Pulse" stroke="hsl(var(--vital-success))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6 bg-card border-border">
        <h2 className="text-xl font-bold text-foreground mb-4">SpO2 & EtCO2 Trends</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))' 
              }} 
            />
            <Legend />
            <Line type="monotone" dataKey="SpO2" stroke="hsl(var(--chart-2))" strokeWidth={2} />
            <Line type="monotone" dataKey="EtCO2" stroke="hsl(var(--chart-3))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Dashboard;