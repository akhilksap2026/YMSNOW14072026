import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { movePriorityColor, moveStatusColor } from "@/lib/status-colors";
import { formatTitle as formatStatus } from "@/lib/format";
import {
  ArrowRight,
  GripVertical,
  Truck,
  MapPin,
  DoorOpen,
  Clock,
  AlertTriangle,
  Zap,
  User,
  InboxIcon,
} from "lucide-react";

interface MoveTask {
  id: number;
  trailerNumber?: string;
  carrierName?: string;
  moveType?: string;
  fromLocationType?: string;
  fromLocationName?: string;
  toLocationType?: string;
  toLocationName?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt?: string;
}

interface Jockey {
  id: string;
  firstName: string;
  lastName: string;
  activeMoveCount: number;
  jockeyStatus: "available" | "busy";
}

interface BoardColumn {
  id: string;
  label: string;
  jockey: Jockey | null;
  tasks: MoveTask[];
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function getLocationIcon(type?: string) {
  if (type === "dock") return <DoorOpen className="h-3 w-3" />;
  if (type === "gate") return <ArrowRight className="h-3 w-3" />;
  return <MapPin className="h-3 w-3" />;
}

function TaskCard({
  task,
  isDragging = false,
  dragHandleProps,
  style,
}: {
  task: MoveTask;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}) {
  const isOverdue = task.createdAt
    ? Date.now() - new Date(task.createdAt).getTime() > 2 * 60 * 60 * 1000
    : false;

  return (
    <div
      style={style}
      className={`rounded-lg border bg-card text-card-foreground shadow-sm transition-all select-none ${
        isDragging
          ? "opacity-50 scale-105 shadow-xl border-primary/50 rotate-1"
          : "hover:shadow-md hover:border-primary/20"
      } ${isOverdue ? "border-l-4 border-l-red-500" : task.priority === "urgent" || task.priority === "high" ? "border-l-4 border-l-amber-500" : ""}`}
      data-testid={`board-card-${task.id}`}
    >
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span {...(dragHandleProps as Record<string, unknown>)} className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0 touch-none">
              <GripVertical className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold truncate">{task.trailerNumber || "—"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{task.carrierName || "—"}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={`${movePriorityColor(task.priority)} border-transparent text-[9px] px-1.5 py-0`}>
              {task.priority === "urgent" && <Zap className="h-2.5 w-2.5 mr-0.5" />}
              {task.priority}
            </Badge>
            {isOverdue && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-transparent text-[9px] px-1.5 py-0">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                Overdue
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">{getLocationIcon(task.fromLocationType)}{task.fromLocationName || task.fromLocationType || "—"}</span>
          <ArrowRight className="h-2.5 w-2.5 shrink-0" />
          <span className="flex items-center gap-0.5">{getLocationIcon(task.toLocationType)}{task.toLocationName || task.toLocationType || "—"}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">{formatStatus(task.moveType || "")}</span>
          <Badge className={`${moveStatusColor(task.status)} border-transparent text-[9px] px-1.5 py-0`}>
            {formatStatus(task.status)}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function DraggableTaskCard({ task }: { task: MoveTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(task.id),
    data: { task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard task={task} isDragging={isDragging} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function DroppableColumn({ column }: { column: BoardColumn }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const busyCount = column.tasks.filter(t => t.status === "in_progress").length;
  const assignedCount = column.tasks.length;

  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px] w-full">
      <div className={`rounded-t-lg px-3 py-2.5 border border-b-0 ${
        column.jockey === null
          ? "bg-muted/60 border-border"
          : column.jockey.jockeyStatus === "busy"
            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
              column.jockey === null
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
            }`}>
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{column.label}</p>
              {column.jockey && (
                <p className="text-[10px] text-muted-foreground">{column.jockey.jockeyStatus === "busy" ? `${busyCount} in progress` : "Available"}</p>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center justify-center h-5 min-w-[20px] rounded-full text-[10px] font-bold px-1.5 ${
            assignedCount > 0
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}>{assignedCount}</span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[400px] rounded-b-lg border p-2 space-y-2 transition-colors ${
          isOver
            ? "bg-primary/5 border-primary/40 border-dashed"
            : "bg-muted/20 border-border border-dashed"
        }`}
        data-testid={`board-column-${column.id}`}
      >
        {column.tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground/50">
            <InboxIcon className="h-6 w-6 mb-1" />
            <p className="text-[10px]">Drop tasks here</p>
          </div>
        ) : (
          column.tasks
            .slice()
            .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))
            .map((task) => (
              <DraggableTaskCard key={task.id} task={task} />
            ))
        )}
      </div>
    </div>
  );
}

export interface JockeyBoardViewProps {
  tasks: MoveTask[];
  jockeys: Jockey[];
  onReassign: (taskId: number, jockeyId: string | null) => void;
}

export function JockeyBoardView({ tasks, jockeys, onReassign }: JockeyBoardViewProps) {
  const [activeTask, setActiveTask] = useState<MoveTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => String(t.id) === String(event.active.id));
    setActiveTask(task ?? null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = Number(active.id);
    const targetColumnId = String(over.id);

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newJockeyId = targetColumnId === "unassigned" ? null : targetColumnId;
    const currentAssignee = task.assignedTo || null;

    if (newJockeyId === currentAssignee) return;

    onReassign(taskId, newJockeyId);
  }, [tasks, onReassign]);

  const boardTasks = tasks.filter(t =>
    ["open", "assigned", "accepted", "in_progress", "escalated"].includes(t.status)
  );

  const columns: BoardColumn[] = [
    {
      id: "unassigned",
      label: "Unassigned",
      jockey: null,
      tasks: boardTasks.filter(t => !t.assignedTo),
    },
    ...jockeys.map(j => ({
      id: j.id,
      label: `${j.firstName} ${j.lastName}`,
      jockey: j,
      tasks: boardTasks.filter(t => t.assignedTo === j.id),
    })),
  ];

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4" data-testid="jockey-board">
        <div className="flex gap-3 min-w-max">
          {columns.map(col => (
            <DroppableColumn key={col.id} column={col} />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          Drag tasks between columns to reassign. Changes apply immediately.
        </p>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <TaskCard task={activeTask} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
