import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import VitalCard from './VitalCard';
import { supabase } from '@/integrations/supabase/client';
import { VitalsData } from '@/types/vitals';

const Dashboard = () => {
  const [latestVitals, setLatestVitals] = useState<VitalsData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    // Fetch initial data
    fetchLatestVitals();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('vitals-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vitals'
        },
        (payload) => {
          console.log('New vital received:', payload);
          if (payload.new) {
            setLatestVitals({
              HR: payload.new.hr,
              Pulse: payload.new.pulse,
              SpO2: payload.new.spo2,
              ABP: payload.new.abp,
              PAP: payload.new.pap,
              EtCO2: payload.new.etco2,
              awRR: payload.new.awrr
            });
            setLastUpdate(new Date().toLocaleTimeString());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLatestVitals = async () => {
    const { data, error } = await supabase
      .from('vitals')
      .select('*')
      .eq('source', 'camera')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching vitals:', error);
      return;
    }

    if (data) {
      setLatestVitals({
        HR: data.hr,
        Pulse: data.pulse,
        SpO2: data.spo2,
        ABP: data.abp,
        PAP: data.pap,
        EtCO2: data.etco2,
        awRR: data.awrr
      });
      setLastUpdate(new Date(data.created_at).toLocaleTimeString());
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary animate-pulse" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Live Vitals Monitor</h1>
              <p className="text-sm text-muted-foreground">
                Real-time patient monitoring system
              </p>
            </div>
          </div>
          {lastUpdate && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Last updated</p>
              <p className="text-lg font-semibold text-foreground">{lastUpdate}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard 
          label="HR" 
          value={latestVitals?.HR ?? null} 
          unit="bpm"
        />
        <VitalCard 
          label="Pulse" 
          value={latestVitals?.Pulse ?? null} 
          unit="bpm"
        />
        <VitalCard 
          label="SpO2" 
          value={latestVitals?.SpO2 ?? null} 
          unit="%"
        />
        <VitalCard 
          label="EtCO2" 
          value={latestVitals?.EtCO2 ?? null} 
          unit="mmHg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <VitalCard 
          label="ABP" 
          value={latestVitals?.ABP ?? null} 
          unit="mmHg"
        />
        <VitalCard 
          label="PAP" 
          value={latestVitals?.PAP ?? null} 
          unit="mmHg"
        />
        <VitalCard 
          label="awRR" 
          value={latestVitals?.awRR ?? null} 
          unit="/min"
        />
      </div>
    </div>
  );
};

export default Dashboard;