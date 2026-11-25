import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, type EventType } from '../lib/events/labels';

/** The coloured dot for an event type. Used alone on the /events/ filter chips. */
export function EventTypeDot({ type }: { type: EventType }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: EVENT_TYPE_COLORS[type] }}
    />
  );
}

/** Mono type label with its dot. Shared by /events/ and the entry-page timeline so they match. */
export default function EventTypeBadge({ type }: { type: EventType }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border bg-base px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-secondary">
      <EventTypeDot type={type} />
      {EVENT_TYPE_LABELS[type]}
    </span>
  );
}
