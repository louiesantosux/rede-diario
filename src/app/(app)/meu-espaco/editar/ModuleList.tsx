'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MODULE_INFO, MODULE_VIS, MODULE_VIS_LABEL, type ModuleVis, type SpaceModule } from '@/lib/space';

type Props = { modules: SpaceModule[]; onChange: (modules: SpaceModule[]) => void };

/** Lista de módulos do espaço: liga/desliga, visibilidade e ordem (arrastar ou teclado). */
export function ModuleList({ modules, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );
  const labelOf = (id: string | number) => MODULE_INFO[id as SpaceModule['key']]?.label ?? 'módulo';

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onChange(
      arrayMove(
        modules,
        modules.findIndex((m) => m.key === active.id),
        modules.findIndex((m) => m.key === over.id),
      ),
    );
  };

  const update = (key: SpaceModule['key'], patch: Partial<SpaceModule>) =>
    onChange(modules.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Para reordenar, pressione Espaço, use as setas para cima e para baixo e pressione Espaço de novo para soltar. Esc cancela.',
        },
        announcements: {
          onDragStart: ({ active }) => `Movendo o módulo ${labelOf(active.id)}.`,
          onDragOver: ({ active, over }) =>
            over ? `${labelOf(active.id)} está sobre ${labelOf(over.id)}.` : `${labelOf(active.id)} fora da lista.`,
          onDragEnd: ({ active, over }) =>
            over ? `${labelOf(active.id)} solto na posição de ${labelOf(over.id)}.` : 'Movimento cancelado.',
          onDragCancel: ({ active }) => `Movimento de ${labelOf(active.id)} cancelado.`,
        },
      }}
    >
      <SortableContext items={modules.map((m) => m.key)} strategy={verticalListSortingStrategy}>
        <ul className="module-list">
          {modules.map((m) => (
            <ModuleRow key={m.key} module={m} onChange={(patch) => update(m.key, patch)} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function ModuleRow({ module: m, onChange }: { module: SpaceModule; onChange: (patch: Partial<SpaceModule>) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: m.key,
  });
  const info = MODULE_INFO[m.key];
  const visId = `vis-${m.key}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={['module-row', isDragging ? 'is-dragging' : '', m.on ? '' : 'is-off'].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="module-row__grip"
        aria-label={`Mover ${info.label}`}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <label className="module-row__toggle">
        <input type="checkbox" checked={m.on} onChange={(e) => onChange({ on: e.target.checked })} />
        <span>
          <span className="module-row__label">{info.label}</span>
          <span className="module-row__hint">{info.hint}</span>
        </span>
      </label>
      <div className="module-row__vis">
        <label htmlFor={visId} className="sr-only">
          Quem vê {info.label}
        </label>
        <select
          id={visId}
          value={m.vis}
          disabled={!m.on}
          onChange={(e) => onChange({ vis: e.target.value as ModuleVis })}
        >
          {MODULE_VIS.map((v) => (
            <option key={v} value={v}>
              {MODULE_VIS_LABEL[v]}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}
