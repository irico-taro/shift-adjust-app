"use client";

import { useState } from "react";
import { deleteSlotAction, saveSlotAction } from "@/app/actions";
import type { LessonType, SlotType, WeeklyTemplateSlot } from "@/lib/types";

export function SlotForm({
  dayOfWeek,
  lessonTypes,
  slot,
}: {
  dayOfWeek: number;
  lessonTypes: LessonType[];
  slot?: WeeklyTemplateSlot;
}) {
  const [slotType, setSlotType] = useState<SlotType>(slot?.slotType ?? "shift");
  const isNew = !slot;

  return (
    <form action={saveSlotAction} className="row" style={{ gap: 6, padding: "6px 0" }}>
      {slot && <input type="hidden" name="id" value={slot.id} />}
      <input type="hidden" name="dayOfWeek" value={dayOfWeek} />

      <input type="time" name="startTime" defaultValue={slot?.startTime ?? "09:00"} required style={{ width: 108 }} />
      <span className="muted small">〜</span>
      <input type="time" name="endTime" defaultValue={slot?.endTime ?? "10:00"} required style={{ width: 108 }} />

      <select
        name="slotType"
        value={slotType}
        onChange={(e) => setSlotType(e.target.value as SlotType)}
        style={{ width: 92 }}
      >
        <option value="lesson">レッスン</option>
        <option value="shift">業務</option>
      </select>

      {slotType === "lesson" ? (
        <select name="lessonTypeId" defaultValue={slot?.lessonTypeId ?? lessonTypes[0]?.id ?? ""} style={{ width: 116 }}>
          {lessonTypes.length === 0 && <option value="">(種別なし)</option>}
          {lessonTypes.map((lt) => (
            <option key={lt.id} value={lt.id}>
              {lt.name}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          name="shiftLabel"
          defaultValue={slot?.shiftLabel ?? ""}
          placeholder="早番 / 夜勤 など"
          required
          style={{ width: 116 }}
        />
      )}

      <input
        type="number"
        name="requiredCount"
        defaultValue={slot?.requiredCount ?? 1}
        min={1}
        max={20}
        style={{ width: 56 }}
        title="必要人数"
      />

      <button className="btn btn-sm btn-primary" type="submit">
        {isNew ? "追加" : "保存"}
      </button>
      {slot && (
        <button className="btn btn-sm btn-danger" type="submit" formAction={deleteSlotAction}>
          削除
        </button>
      )}
    </form>
  );
}
