"use client";

import { useState, useTransition } from "react";
import { setAvailabilityAction } from "@/app/actions";
import { DAY_NAMES_JA, dayOfWeek, parseDate } from "@/lib/time";
import type { Availability, AvailabilityStatus } from "@/lib/types";

type Entry = { status: AvailabilityStatus; from: string; to: string };

const STATUSES: { value: AvailabilityStatus; label: string }[] = [
  { value: "ok", label: "OK" },
  { value: "conditional", label: "条件付" },
  { value: "ng", label: "NG" },
];

export function AvailabilityEditor({
  periodId,
  staffId,
  dates,
  initial,
  readOnly,
}: {
  periodId: string;
  staffId: string;
  dates: string[];
  initial: Availability[];
  readOnly: boolean;
}) {
  const [entries, setEntries] = useState<Record<string, Entry>>(() => {
    const map: Record<string, Entry> = {};
    for (const a of initial) {
      map[a.date] = {
        status: a.status,
        from: a.availableFrom ?? "09:00",
        to: a.availableTo ?? "17:00",
      };
    }
    return map;
  });
  const [, startTransition] = useTransition();

  const save = (date: string, entry: Entry) => {
    setEntries((prev) => ({ ...prev, [date]: entry }));
    startTransition(async () => {
      await setAvailabilityAction({
        periodId,
        staffId,
        date,
        status: entry.status,
        availableFrom: entry.from,
        availableTo: entry.to,
      });
    });
  };

  return (
    <div className="avail-grid">
      {dates.map((date) => {
        const entry = entries[date];
        const dow = dayOfWeek(date);
        return (
          <div key={date} className={`avail-day ${entry?.status ?? ""}`}>
            <div className="date">
              <span>
                {parseDate(date).getUTCMonth() + 1}/{parseDate(date).getUTCDate()}
              </span>
              <span className={dow === 0 ? "day-weekend" : dow === 6 ? "day-sat" : "muted"}>
                {DAY_NAMES_JA[dow]}
              </span>
            </div>
            <div className="seg">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  data-on={entry?.status === s.value}
                  disabled={readOnly}
                  onClick={() =>
                    save(date, {
                      status: s.value,
                      from: entry?.from ?? "09:00",
                      to: entry?.to ?? "17:00",
                    })
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
            {entry?.status === "conditional" && (
              <div className="row" style={{ gap: 2, marginTop: 6 }}>
                <input
                  type="time"
                  value={entry.from}
                  disabled={readOnly}
                  onChange={(e) => save(date, { ...entry, from: e.target.value })}
                  style={{ width: "46%", padding: "2px 4px", fontSize: 11 }}
                />
                <span className="small muted">〜</span>
                <input
                  type="time"
                  value={entry.to}
                  disabled={readOnly}
                  onChange={(e) => save(date, { ...entry, to: e.target.value })}
                  style={{ width: "46%", padding: "2px 4px", fontSize: 11 }}
                />
              </div>
            )}
            {!entry && <div className="small muted" style={{ marginTop: 4 }}>未入力</div>}
          </div>
        );
      })}
    </div>
  );
}
