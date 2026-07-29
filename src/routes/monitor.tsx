import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { getPublicQueue } from "../lib/queue-service";
import { Loader2, Volume2, VolumeX } from "lucide-react";


export const Route = createFileRoute("/monitor")({
  component: MonitorDashboard,
});

function MonitorDashboard() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    try {
      const data = await getPublicQueue();
      setQueue(data);
    } catch (error) {
      console.error("Failed to load public queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const readyToClaim = queue.filter((item) => item.status === "Ready to Claim");
  const processing = queue.filter((item) => item.status === "Processing");



  const getGridCols = (length: number) => {
    if (length > 24) return "grid-cols-6";
    if (length > 16) return "grid-cols-5";
    if (length > 8) return "grid-cols-4";
    if (length > 4) return "grid-cols-3";
    return "grid-cols-2";
  };

  const getTextSize = (length: number) => {
    if (length > 24) return "text-xl";
    if (length > 16) return "text-2xl";
    if (length > 8) return "text-4xl";
    if (length > 4) return "text-5xl";
    if (length > 2) return "text-7xl";
    return "text-8xl";
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans selection:bg-primary overflow-hidden flex flex-col z-0">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent pointer-events-none z-[-1]" />
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none z-[-1]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(circle at center, black 40%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(circle at center, black 40%, transparent 80%)",
        }}
      />

      {/* Header */}
      <header className="px-10 py-6 flex items-center justify-between border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-4">
          <img
            src="/barangay_logo.png"
            alt="Barangay Logo"
            className="w-16 h-16 object-contain drop-shadow-xl"
          />
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Barangay Handumanan
            </h1>
            <p className="text-lg text-primary font-medium tracking-wider">
              Document Request Queue
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-4xl font-semibold tracking-tighter">
            {new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="text-lg text-muted-foreground font-medium">
            {new Date().toLocaleDateString([], {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT AREA: QUEUES STACKED VERTICALLY (45% of screen) */}
        <div className="w-[45%] border-r border-border flex flex-col bg-transparent">
          
          {/* NOW SERVING (Ready to Claim) */}
          <div className="h-1/2 flex flex-col border-b border-border bg-transparent">
            <div className="px-10 py-8 shrink-0">
              <h2 className="text-5xl font-semibold tracking-tight text-foreground mb-2 uppercase">
                Ready to Claim
              </h2>
              <p className="text-2xl text-emerald-400">
                Please approach the counter
              </p>
            </div>

            <div className="flex-1 overflow-hidden px-10 pb-10 flex flex-col justify-center">
              {readyToClaim.length === 0 ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                  {/* Empty State */}
                </div>
              ) : (
                <div className={`grid ${getGridCols(readyToClaim.length)} gap-6`}>
                  {readyToClaim.map((item) => (
                    <div
                      key={item.queueNumber}
                      className="flex items-center justify-center py-4"
                    >
                      <span className={`${getTextSize(readyToClaim.length)} font-semibold tracking-tighter text-foreground drop-shadow-md`}>
                        {String(item.queueNumber).padStart(4, "0")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* PREPARING (Processing) */}
          <div className="h-1/2 flex flex-col bg-transparent">
            <div className="px-10 py-8 shrink-0">
              <h2 className="text-5xl font-semibold tracking-tight text-foreground mb-2 uppercase">
                Preparing
              </h2>
              <p className="text-2xl text-primary">
                Please wait for your number
              </p>
            </div>

            <div className="flex-1 overflow-hidden px-10 pb-10 flex flex-col justify-center">
              {processing.length === 0 ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                  {/* Empty State */}
                </div>
              ) : (
                <div className={`grid ${getGridCols(processing.length)} gap-6`}>
                  {processing.map((item) => (
                    <div
                      key={item.queueNumber}
                      className="flex items-center justify-center py-4"
                    >
                      <span className={`${getTextSize(processing.length)} font-semibold tracking-tighter text-foreground drop-shadow-md`}>
                        {String(item.queueNumber).padStart(4, "0")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: NATIVE VIDEO (55% of screen) */}
        <div className="w-[55%] bg-black flex items-center justify-center pointer-events-auto relative group">
          <video 
            ref={videoRef}
            src="/video.mp4" 
            autoPlay 
            loop 
            muted={isMuted}
            className="w-full h-full object-contain"
          />
          
          {/* Custom Volume Overlay */}
          <div className="absolute bottom-6 right-6 flex items-center gap-3 p-3 px-4 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="rounded-full hover:bg-white/20 transition-colors p-1"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const newVol = parseFloat(e.target.value);
                setVolume(newVol);
                if (videoRef.current) videoRef.current.volume = newVol;
                if (newVol > 0 && isMuted) setIsMuted(false);
                if (newVol === 0 && !isMuted) setIsMuted(true);
              }}
              className="w-24 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
