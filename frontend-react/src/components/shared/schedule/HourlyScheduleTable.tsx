"use client";

import { formatHourLabel } from "@/lib/date";
import type { CalendarEvent } from "@/hooks/shared/calendar/use-calendar-events";

function getStickyNoteTone(source: string) {
  if (source === "schedule") {
    return {
      card: "border-sky-200 bg-[#DDF2FF] shadow-[0_6px_14px_rgba(14,116,144,0.08)]",
      tape: "before:bg-white/45",
      overlay:
        "after:bg-[linear-gradient(180deg,rgba(255,255,255,0.1),transparent_30%)]",
      chip: "ring-sky-200/70 bg-white/85 text-slate-700",
      meta: "text-sky-800/70",
    };
  }

  return {
    card: "border-amber-200 bg-[#FFF3A6] shadow-[0_6px_14px_rgba(120,84,0,0.08)]",
    tape: "before:bg-white/45",
    overlay:
      "after:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_30%)]",
    chip: "ring-amber-300/60 bg-white/85 text-slate-700",
    meta: "text-amber-800/70",
  };
}

function getEventHourRange(event: {
  start_time: string;
  end_time?: string | null;
}) {
  const start = new Date(event.start_time);
  const end = event.end_time
    ? new Date(event.end_time)
    : new Date(event.start_time);
  const startHour = Number.isNaN(start.getTime()) ? 0 : start.getHours();
  const endHourRaw = Number.isNaN(end.getTime()) ? startHour : end.getHours();
  const endHasMinutes = !Number.isNaN(end.getTime()) && end.getMinutes() > 0;
  const endHourExclusive = endHasMinutes
    ? endHourRaw + 1
    : Math.max(startHour + 1, endHourRaw);

  return {
    startHour,
    endHourExclusive: Math.min(24, Math.max(startHour + 1, endHourExclusive)),
  };
}

export function HourlyScheduleTable({
  events,
  title,
}: {
  events: CalendarEvent[];
  title?: string;
}) {
  const MIN_LANES = 8;
  const hourRows = Array.from({ length: 11 }, (_, index) => index + 8);
  const laidOutEvents: Array<
    CalendarEvent & {
      lane: number;
      startHour: number;
      rowSpan: number;
    }
  > = [];
  const laneEndHours: number[] = [];

  for (const event of events) {
    const { startHour, endHourExclusive } = getEventHourRange(event);
    const visibleStart = Math.max(8, startHour);
    const visibleEnd = Math.min(19, endHourExclusive);
    const rowSpan = Math.max(0, visibleEnd - visibleStart);

    if (rowSpan <= 0) continue;

    let lane = laneEndHours.findIndex((endHour) => visibleStart >= endHour);
    if (lane === -1) {
      lane = laneEndHours.length;
      laneEndHours.push(visibleEnd);
    } else {
      laneEndHours[lane] = visibleEnd;
    }

    laidOutEvents.push({
      ...event,
      lane,
      startHour: visibleStart,
      rowSpan,
    });
  }

  const laneCount = Math.max(MIN_LANES, laneEndHours.length);
  const hiddenCells = new Set<string>();
  laidOutEvents.forEach((event) => {
    for (
      let hour = event.startHour + 1;
      hour < event.startHour + event.rowSpan;
      hour += 1
    ) {
      hiddenCells.add(`${event.lane}-${hour}`);
    }
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h4 className="text-sm font-semibold text-slate-900">
          {title || "Agenda Per Jam"}
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table
          className="table-fixed border-collapse bg-white text-sm"
          style={{ minWidth: `${112 + laneCount * 260}px` }}
        >
          <colgroup>
            <col style={{ width: "112px" }} />
            {Array.from({ length: laneCount }, (_, laneIndex) => (
              <col key={`col-${laneIndex}`} style={{ width: "260px" }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="sticky left-0 z-30 w-28 border-b border-r border-slate-300 bg-slate-50 px-4 py-3 font-semibold after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-slate-400 after:content-[''] shadow-[6px_0_12px_-8px_rgba(15,23,42,0.28)]">
                Jam
              </th>
              {Array.from({ length: laneCount }, (_, laneIndex) => (
                <th
                  key={`lane-head-${laneIndex}`}
                  className={`border-b border-slate-200 px-4 py-3 font-semibold ${
                    laneIndex < laneCount - 1 ? "border-r" : ""
                  }`}
                >
                  Agenda {laneCount > 1 ? laneIndex + 1 : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hourRows.map((hour) => (
              <tr key={hour} className="align-top">
                <td className="sticky left-0 z-20 border-b border-r border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-slate-400 after:content-[''] shadow-[6px_0_12px_-8px_rgba(15,23,42,0.22)]">
                  {formatHourLabel(hour)}
                </td>
                {Array.from({ length: laneCount }, (_, laneIndex) => {
                  const hiddenKey = `${laneIndex}-${hour}`;
                  if (hiddenCells.has(hiddenKey)) return null;

                  const event = laidOutEvents.find(
                    (item) => item.lane === laneIndex && item.startHour === hour,
                  );

                  if (!event) {
                    return (
                      <td
                        key={`empty-${laneIndex}-${hour}`}
                        className={`border-b border-slate-200 bg-white px-4 py-3 text-slate-400 ${
                          laneIndex < laneCount - 1 ? "border-r" : ""
                        }`}
                      />
                    );
                  }

                  const noteTone = getStickyNoteTone(event.source);

                  return (
                    <td
                      key={`${event.source}-${event.id}-${laneIndex}-${hour}`}
                      rowSpan={event.rowSpan}
                      className={`h-px border-b border-slate-200 bg-sky-50/60 p-2 align-top ${
                        laneIndex < laneCount - 1 ? "border-r" : ""
                      }`}
                    >
                      <div
                        className={`relative h-full rounded-[18px] px-3 py-3 before:absolute before:left-1/2 before:top-2 before:h-4 before:w-14 before:-translate-x-1/2 before:rounded-sm after:absolute after:inset-0 after:rounded-[18px] after:content-[''] ${noteTone.card} ${noteTone.tape} ${noteTone.overlay}`}
                      >
                        <div className="relative z-10 flex flex-wrap gap-1">
                          {event.room_name ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${noteTone.chip}`}
                            >
                              {event.room_number
                                ? `${event.room_name} (${event.room_number})`
                                : event.room_name}
                            </span>
                          ) : null}
                          {event.purpose ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${noteTone.chip}`}
                            >
                              {event.purpose}
                            </span>
                          ) : null}
                        </div>
                        <div className={`relative ${event.room_name || event.purpose ? "mt-3" : ""}`}>
                          <span className={`text-xs font-medium ${noteTone.meta}`}>
                            {event.rowSpan} jam
                          </span>
                        </div>
                        <p className="relative mt-3 font-semibold text-slate-900">
                          {event.title}
                        </p>
                        <div className="relative mt-3 grid gap-2 text-xs text-slate-600">
                          {event.requested_by_name ? (
                            <p className="font-medium text-slate-700">
                              {event.source === "schedule"
                                ? `Kelas ${event.requested_by_name}`
                                : `Oleh ${event.requested_by_name}`}
                            </p>
                          ) : null}
                          {event.attendee_count != null ? (
                            <p className="font-medium text-slate-500">
                              {event.attendee_count} peserta
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
