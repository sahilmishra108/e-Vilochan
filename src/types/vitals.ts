export interface ROI {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  unit?: string;
}

export interface VitalsData {
  HR: number | null;
  Pulse: number | null;
  SpO2: number | null;
  ABP: string | null;
  PAP: string | null;
  EtCO2: number | null;
  awRR: number | null;
}

export const monitorROIs: ROI[] = [
  {
    "label": "HR",
    "x": 0.69,
    "y": 0.08,
    "width": 0.11,
    "height": 0.1,
    "unit": "bpm"
  },
  {
    "label": "Pulse",
    "x": 0.87,
    "y": 0.08,
    "width": 0.11,
    "height": 0.1,
    "unit": "bpm"
  },
  {
    "label": "SpO2",
    "x": 0.69,
    "y": 0.2,
    "width": 0.11,
    "height": 0.11,
    "unit": "%"
  },
  {
    "label": "ABP",
    "x": 0.71,
    "y": 0.33,
    "width": 0.12,
    "height": 0.12,
    "unit": "mmHg"
  },
  {
    "label": "PAP",
    "x": 0.71,
    "y": 0.46,
    "width": 0.12,
    "height": 0.11,
    "unit": "mmHg"
  },
  {
    "label": "EtCO2",
    "x": 0.7,
    "y": 0.59,
    "width": 0.08,
    "height": 0.11,
    "unit": "mmHg"
  },
  {
    "label": "awRR",
    "x": 0.88,
    "y": 0.61,
    "width": 0.08,
    "height": 0.12,
    "unit": "/min"
  }
];