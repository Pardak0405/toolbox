"use client";

import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

export type FileQueueItem = {
  id: string;
  file: File;
};

export default function FileQueue({
  items,
  onChange,
  onRemove
}: {
  items: FileQueueItem[];
  onChange: (items: FileQueueItem[]) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor));

  const ids = useMemo(() => items.map((item) => item.id), [items]);

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <h4 className="font-semibold">File queue</h4>
      <p className="text-xs text-muted">Drag to reorder. Click trash to remove.</p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;
          const oldIndex = ids.indexOf(active.id as string);
          const newIndex = ids.indexOf(over.id as string);
          onChange(arrayMove(items, oldIndex, newIndex));
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <SortableRow key={item.id} item={item} onRemove={onRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({
  item,
  onRemove
}: {
  item: FileQueueItem;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-xl border border-line bg-fog px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <button
          className="cursor-grab text-muted"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div>
          <p className="text-sm font-medium">{item.file.name}</p>
          <p className="text-xs text-muted">
            {(item.file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="rounded-full p-2 text-muted hover:text-ember"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
