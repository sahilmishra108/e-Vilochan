import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface VitalCardProps {
  label: string;
  value: string | number | null;
  unit: string;
  trend?: 'stable' | 'up' | 'down';
}

const VitalCard = ({ label, value, unit, trend = 'stable' }: VitalCardProps) => {
  const getValueColor = () => {
    if (value === null || value === 'N/A') return 'text-muted-foreground';

    // Define normal ranges for different vitals
    const numValue = typeof value === 'string' ? parseInt(value.split('/')[0]) : value;

    if (label === 'HR' || label === 'Pulse') {
      if (numValue < 60 || numValue > 100) return 'text-alert';
      if (numValue < 70 || numValue > 90) return 'text-[hsl(var(--vital-warning))]';
      return 'text-[hsl(var(--vital-success))]';
    }

    if (label === 'SpO2') {
      if (numValue < 90) return 'text-alert';
      if (numValue < 95) return 'text-[hsl(var(--vital-warning))]';
      return 'text-[hsl(var(--vital-success))]';
    }

    return 'text-foreground';
  };

  return (
    <Card className="p-6 bg-card border-border hover:border-primary/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </h3>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold tabular-nums ${getValueColor()}`}>
          {value ?? 'N/A'}
        </span>
        <span className="text-sm text-muted-foreground font-medium self-end mb-1">
          {unit}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${getValueColor().replace('text-', 'bg-')} transition-all duration-300`}
            style={{ width: value ? '75%' : '0%' }}
          />
        </div>
      </div>
    </Card>
  );
};

export default VitalCard;