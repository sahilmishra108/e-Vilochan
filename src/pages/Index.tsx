import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Dashboard from "@/components/Dashboard";
import CameraFeed from "@/components/CameraFeed";
import VideoProcessor from "@/components/VideoProcessor";
import { Activity, Camera, FileVideo } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-[hsl(var(--medical-bg))] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center py-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Activity className="w-12 h-12 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Medical Vitals Monitor
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Real-time patient monitoring and video analysis system
          </p>
        </header>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="camera" className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Live Camera
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <FileVideo className="w-4 h-4" />
              Video Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard />
          </TabsContent>

          <TabsContent value="camera" className="space-y-6">
            <CameraFeed />
          </TabsContent>

          <TabsContent value="video" className="space-y-6">
            <VideoProcessor />
          </TabsContent>
        </Tabs>

        <footer className="text-center py-6 text-sm text-muted-foreground border-t border-border">
          <p>Medical-grade vitals extraction powered by AI • Secure and HIPAA-compliant ready</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;