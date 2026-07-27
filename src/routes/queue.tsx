import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { getActiveQueue, updateTransactionStatus } from "../lib/queue-service";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { User, FileText, CheckCircle2, Clock, Loader2, RefreshCw, Ban, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import Draggable from "react-draggable";
import { QueueVerificationPane } from "../components/QueueVerificationPane";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";

// DND Kit imports
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Droppable Column Component
function KanbanColumn({ id, title, items, onStatusChange, setSelectedBatch, setCancelBatch }: any) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="flex flex-col flex-1 bg-card/30 border border-border rounded-2xl overflow-hidden shadow-sm h-[calc(100vh-200px)] min-h-[600px]">
      <div className="p-4 border-b border-border bg-card shadow-sm z-10 flex justify-between items-center">
        <h3 className="font-semibold text-lg text-foreground">{title}</h3>
        <Badge variant="secondary" className="rounded-full px-2.5">
          {items.length}
        </Badge>
      </div>
      <div ref={setNodeRef} className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-accent/5">
        <SortableContext 
          id={id} 
          items={items.map((i: any) => i.queueNumber.toString())}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-4 min-h-full pb-10">
            {items.map((item: any) => (
              <SortableQueueCard 
                key={item.queueNumber} 
                item={item} 
                onStatusChange={onStatusChange}
                setSelectedBatch={setSelectedBatch}
                setCancelBatch={setCancelBatch}
              />
            ))}
            {items.length === 0 && (
              <div className="h-[200px] flex-1 pointer-events-none" />
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// Sortable Card Component
function SortableQueueCard({ item, onStatusChange, setSelectedBatch, setCancelBatch, isOverlay = false }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: item.queueNumber.toString(),
    data: { item }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { style: string; icon: any }> = {
      "Ready to Claim": { style: "bg-emerald-50 text-emerald-600 border-emerald-200/60", icon: CheckCircle },
      Completed: { style: "bg-emerald-50 text-emerald-600 border-emerald-200/60", icon: CheckCircle2 },
      Released: { style: "bg-emerald-50 text-emerald-600 border-emerald-200/60", icon: CheckCircle2 },
      Processing: { style: "bg-accent/50 text-primary border-primary/20", icon: Loader2 },
      Pending: { style: "bg-amber-50 text-amber-600 border-amber-200/60", icon: Clock },
      Cancelled: { style: "bg-red-50 text-red-600 border-red-200/60", icon: XCircle },
    };
    return config[status] || { style: "bg-accent/15 text-muted-foreground", icon: AlertCircle };
  };

  const config = getStatusConfig(item.status);
  const Icon = config.icon;

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      // Added max-w-sm w-full mx-auto to fix the horizontal stretching issue, forcing it to keep its nice vertical card shape
      className={`max-w-sm w-full mx-auto flex flex-col transition-all cursor-grab active:cursor-grabbing hover:border-primary/30 bg-card ${isOverlay ? 'scale-105 shadow-xl rotate-2' : 'shadow-sm z-10 relative'}`}
      {...attributes}
      {...listeners}
    >
      <CardHeader className="pb-0 pt-6 px-6 pointer-events-none">
        <div className="flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-muted-foreground">Queue Number</p>
          <CardTitle className="text-6xl font-semibold tracking-tighter mt-1 text-foreground">
            {item.queueNumber.toString().padStart(4, '0')}
          </CardTitle>
          <Badge variant="outline" className={`mt-3 font-medium shadow-none ${config.style}`}>
            <Icon className="w-4 h-4 mr-1.5" />
            {item.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 px-6 pb-6 flex-1 flex flex-col gap-4">
        <div className="space-y-4 pointer-events-none">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Resident</p>
              <p className="text-sm text-foreground">
                {item.resident?.firstName} {item.resident?.lastName}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Document Requested</p>
              <p className="text-sm text-foreground">
                {item.items.length === 1 
                  ? item.items[0].template?.name 
                  : `${item.items.length} Documents`}
              </p>
              {item.items.length > 1 && item.items.length <= 3 && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                  {item.items.map((i: any) => i.template?.name).join(", ")}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Time Requested</p>
              <p className="text-sm text-foreground/80">
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 flex gap-2 w-full" onPointerDown={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            className="rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 px-4 shrink-0 cursor-pointer pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setCancelBatch(item); }}
          >
            Cancel
          </Button>

          {item.status === 'Pending' && (
            <Button 
              className="flex-1 bg-amber-500 hover:bg-amber-500/90 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer pointer-events-auto"
              onClick={async (e) => {
                e.stopPropagation();
                await onStatusChange(item.items.map((i: any) => i.id), 'Processing');
                setSelectedBatch(item);
              }}
            >
              Process Request
            </Button>
          )}
          
          {item.status === 'Processing' && (
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl cursor-pointer pointer-events-auto"
              onClick={(e) => { e.stopPropagation(); setSelectedBatch(item); }}
            >
              Verify & Print
            </Button>
          )}
          
          {item.status === 'Ready to Claim' && (
            <Button 
              className="flex-1 bg-emerald-600 hover:bg-emerald-600/90 text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)] rounded-xl cursor-pointer pointer-events-auto"
              onClick={(e) => { e.stopPropagation(); onStatusChange(item.items.map((i: any) => i.id), 'Completed'); }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark as Claimed
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute("/queue")({
  component: QueueDashboard,
});

function QueueDashboard() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [cancelBatch, setCancelBatch] = useState<any>(null);
  const dragNodeRef = useRef(null);

  // DND Kit states
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag distance before firing, allowing button clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadQueue = async (silent = false) => {
    if (!silent) setLoading(true);
    setIsRefreshing(true);
    try {
      const data = await getActiveQueue();
      // Filter out Completed, Released, and Cancelled items for the Kanban board
      const activeItems = data.filter((item: any) => 
        !['Completed', 'Released', 'Cancelled'].includes(item.status)
      );
      setQueue(activeItems);
    } catch (error) {
      console.error("Failed to load queue:", error);
      if (!silent) toast.error("Failed to load queue.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load and polling
  useEffect(() => {
    loadQueue();
    const interval = setInterval(() => {
      loadQueue(true);
    }, 5000); 
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (transactionIds: number[], newStatus: string) => {
    try {
      const result = await updateTransactionStatus({ 
        data: { transactionIds, newStatus } 
      });
      if (result.success) {
        toast.success(`Marked as ${newStatus}`);
        loadQueue(true); // Refresh instantly
      }
    } catch (error) {
      toast.error("Failed to update status.");
    }
  };

  // Kanban Columns Data
  const columns = useMemo(() => {
    const cols = {
      Pending: [] as any[],
      Processing: [] as any[],
      'Ready to Claim': [] as any[],
    };
    
    queue.forEach(item => {
      if (cols[item.status as keyof typeof cols]) {
        cols[item.status as keyof typeof cols].push(item);
      }
    });
    
    return cols;
  }, [queue]);

  const activeItem = useMemo(
    () => queue.find(item => item.queueNumber.toString() === activeId),
    [activeId, queue]
  );

  // DND Handlers
  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const activeItem = queue.find(item => item.queueNumber.toString() === active.id);
    if (!activeItem) return;

    const activeStatus = activeItem.status;
    let overStatus = over.id; // Assume dropped directly on a column

    // If dropped on another card, find its column instead
    if (over.id !== 'Pending' && over.id !== 'Processing' && over.id !== 'Ready to Claim') {
      const overItem = queue.find(item => item.queueNumber.toString() === over.id);
      if (overItem) {
        overStatus = overItem.status;
      }
    }

    // No status change
    if (activeStatus === overStatus) return;

    // Strict Workflow Validation (Allow backward moves)
    const validTransitions: Record<string, string[]> = {
      'Pending': ['Processing'], // Pending -> Processing
      'Processing': ['Ready to Claim', 'Pending'], // Can go forward or backward
      'Ready to Claim': ['Processing'], // Can go backward. (Completing is done via button)
    };

    if (!validTransitions[activeStatus]?.includes(overStatus)) {
      toast.error(`Invalid move. You can only move between adjacent stages.`);
      return;
    }

    // Optimistically update the UI
    setQueue(prev => prev.map(item => {
      if (item.queueNumber.toString() === active.id) {
        return { ...item, status: overStatus };
      }
      return item;
    }));

    // Perform API call
    const transactionIds = activeItem.items.map((i: any) => i.id);
    await handleStatusChange(transactionIds, overStatus);
    
    // Automatically open verification pane if moved to Processing
    if (overStatus === 'Processing') {
      setSelectedBatch({ ...activeItem, status: overStatus });
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10 h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Staff Queue Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage incoming document requests. Drag and drop cards to update status.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => loadQueue()}
            disabled={isRefreshing}
            className="bg-card border-border text-foreground/80 hover:bg-muted hover:text-foreground rounded-xl px-4"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && queue.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full px-2">
            <KanbanColumn 
              id="Pending" 
              title="To Do (Pending)" 
              items={columns['Pending']} 
              onStatusChange={handleStatusChange}
              setSelectedBatch={setSelectedBatch}
              setCancelBatch={setCancelBatch}
            />
            <KanbanColumn 
              id="Processing" 
              title="In Progress (Processing)" 
              items={columns['Processing']} 
              onStatusChange={handleStatusChange}
              setSelectedBatch={setSelectedBatch}
              setCancelBatch={setCancelBatch}
            />
            <KanbanColumn 
              id="Ready to Claim" 
              title="Ready for Pickup" 
              items={columns['Ready to Claim']} 
              onStatusChange={handleStatusChange}
              setSelectedBatch={setSelectedBatch}
              setCancelBatch={setCancelBatch}
            />
          </div>
          
          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
            {activeId && activeItem ? (
              <SortableQueueCard 
                item={activeItem} 
                isOverlay={true}
                onStatusChange={handleStatusChange}
                setSelectedBatch={setSelectedBatch}
                setCancelBatch={setCancelBatch}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Document Verification Pane */}
      {selectedBatch && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm" onClick={() => setSelectedBatch(null)} />
          <Draggable nodeRef={dragNodeRef} handle=".drag-handle" cancel=".no-drag">
            <div ref={dragNodeRef} className="fixed top-[5vh] left-1/2 -translate-x-1/2 w-[1300px] h-[85vh] max-h-[900px] z-50 pointer-events-none [&>*]:pointer-events-auto shadow-2xl rounded-2xl overflow-hidden">
              <QueueVerificationPane
                batch={selectedBatch}
                onClose={() => setSelectedBatch(null)}
                onStatusChange={handleStatusChange}
              />
            </div>
          </Draggable>
        </>
      )}

      <Dialog open={!!cancelBatch} onOpenChange={() => setCancelBatch(null)}>
        <DialogContent className="max-w-md bg-background border-border/60 shadow-md text-foreground p-6 sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              <span>Cancel Request</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-foreground/80">
              Are you absolutely sure you want to cancel this queue request? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button type="button" variant="ghost" className="rounded-xl px-5" onClick={() => setCancelBatch(null)}>
                No, keep it
              </Button>
              <Button 
                type="button"
                className="bg-red-600 hover:bg-red-500 text-foreground rounded-xl px-5"
                onClick={async () => {
                  await handleStatusChange(cancelBatch.items.map((i: any) => i.id), 'Cancelled');
                  setCancelBatch(null);
                }}
              >
                Yes, Cancel Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
