import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPublicQueue } from "../lib/queue-service";
import { Loader2 } from "lucide-react";


export const Route = createFileRoute("/monitor")({
  component: MonitorDashboard,
});

function MonitorDashboard() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getTextSize = (length: number) => {
    if (length > 12) return "text-5xl";
    if (length > 6) return "text-7xl";
    return "text-8xl"; // Still use 8xl for just a few numbers, but shrink if there are many
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
      <header className="px-10 py-6 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <img
            src="/barangay_logo.png"
            alt="Barangay Logo"
            className="w-16 h-16 object-contain drop-shadow-xl"
          />
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              Barangay Handumanan
            </h1>
            <p className="text-lg text-primary font-medium tracking-wider">
              Document Request Queue
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-4xl font-black tracking-tighter">
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
        {/* LEFT COLUMN: PREPARING (Processing) */}
        <div className="flex-1 border-r border-border flex flex-col bg-transparent">
          <div className="px-10 py-8 shrink-0">
            <h2 className="text-5xl font-black tracking-tight text-foreground/80 uppercase">
              Preparing
            </h2>
            <p className="text-2xl text-primary">
              Please wait for your number
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar">
            {loading && queue.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
            ) : processing.length === 0 ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
                {/* Empty State */}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-8">
                {processing.map((item) => (
                  <div
                    key={item.queueNumber}
                    className="flex items-center justify-center py-4"
                  >
                    <span className={`${getTextSize(processing.length)} font-black tracking-tighter text-foreground drop-shadow-md`}>
                      {String(item.queueNumber).padStart(4, "0")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: NOW SERVING (Ready to Claim) */}
        <div className="flex-1 flex flex-col bg-transparent">
          <div className="px-10 py-8 shrink-0">
            <h2 className="text-5xl font-black tracking-tight text-foreground mb-2 uppercase">
              Ready to Claim
            </h2>
            <p className="text-2xl text-emerald-400">
              Please approach the counter
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar">
            {loading && queue.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
            ) : readyToClaim.length === 0 ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
                {/* Empty State */}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-8">
                {readyToClaim.map((item) => (
                  <div
                    key={item.queueNumber}
                    className="flex items-center justify-center py-4"
                  >
                    <span className={`${getTextSize(readyToClaim.length)} font-black tracking-tighter text-foreground drop-shadow-md`}>
                      {String(item.queueNumber).padStart(4, "0")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
