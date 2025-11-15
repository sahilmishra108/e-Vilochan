import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Square, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { monitorROIs } from '@/types/vitals';

const CameraFeed = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, []);

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
        
        // Capture frame every 3 seconds
        intervalRef.current = setInterval(() => {
          captureAndProcess();
        }, 3000);
        
        toast({
          title: "Camera started",
          description: "Capturing frames every 3 seconds",
        });
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera error",
        description: "Failed to access camera",
        variant: "destructive",
      });
    }
  };

  const stopCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsCapturing(false);
    setPreviewUrl(null);
  };

  const captureAndProcess = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    setIsProcessing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image as base64
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.95);
    setPreviewUrl(imageBase64);
    
    try {
      // Send to edge function for processing
      const { data, error } = await supabase.functions.invoke('extract-vitals', {
        body: { imageBase64, rois: monitorROIs }
      });
      
      if (error) throw error;
      
      if (data?.vitals) {
        // Store in database
        const { error: insertError } = await supabase
          .from('vitals')
          .insert({
            hr: data.vitals.HR,
            pulse: data.vitals.Pulse,
            spo2: data.vitals.SpO2,
            abp: data.vitals.ABP,
            pap: data.vitals.PAP,
            etco2: data.vitals.EtCO2,
            awrr: data.vitals.awRR,
            source: 'camera'
          });
        
        if (insertError) {
          console.error('Error storing vitals:', insertError);
        }
      }
    } catch (error) {
      console.error('Error processing frame:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Camera className="w-6 h-6 text-primary" />
          Real-time Camera Feed
        </h2>
        
        <div className="flex gap-2">
          {!isCapturing ? (
            <Button onClick={startCapture} className="bg-primary hover:bg-primary/90">
              <Camera className="w-4 h-4 mr-2" />
              Start Capture
            </Button>
          ) : (
            <Button onClick={stopCapture} variant="destructive">
              <Square className="w-4 h-4 mr-2" />
              Stop Capture
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative bg-[hsl(var(--monitor-bg))] rounded-lg overflow-hidden border-2 border-[hsl(var(--monitor-border))]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>
        
        <div className="bg-[hsl(var(--monitor-bg))] rounded-lg p-4 border-2 border-[hsl(var(--monitor-border))]">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Last Captured Frame</h3>
          {previewUrl ? (
            <img src={previewUrl} alt="Last frame" className="w-full h-auto rounded" />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center text-muted-foreground">
              No frame captured yet
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-sm text-muted-foreground">
        {isCapturing && (
          <p>• Capturing frames every 3 seconds • Frames are deleted after processing</p>
        )}
      </div>
    </Card>
  );
};

export default CameraFeed;