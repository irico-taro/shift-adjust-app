// シフト表の「レーン」= 同じ内容・同じ時間帯の枠を曜日をまたいで束ねたもの。
// 画面のマトリクス表示と印刷用の帳票で同じ並びを使うため、ここに切り出している。

import { slotColor, slotLabel } from "./rules";
import type { ScheduleContext, SlotType, WeeklyTemplateSlot } from "./types";

export type Lane = {
  key: string;
  slotType: SlotType;
  label: string;
  startTime: string;
  endTime: string;
  color: string;
  byDay: Map<number, WeeklyTemplateSlot>;
};

export function buildLanes(ctx: ScheduleContext): Lane[] {
  const lanes = new Map<string, Lane>();
  for (const slot of ctx.slots) {
    const label = slotLabel(slot, ctx.lessonTypes);
    const key = `${slot.slotType}|${label}|${slot.startTime}|${slot.endTime}`;
    const lane = lanes.get(key) ?? {
      key,
      slotType: slot.slotType,
      label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      color: slotColor(slot, ctx.lessonTypes),
      byDay: new Map<number, WeeklyTemplateSlot>(),
    };
    lane.byDay.set(slot.dayOfWeek, slot);
    lanes.set(key, lane);
  }
  // レッスン枠を先、業務シフトを後に並べる(帳票でも同じ順序)。
  return [...lanes.values()].sort((a, b) => {
    if (a.slotType !== b.slotType) return a.slotType === "lesson" ? -1 : 1;
    return a.startTime.localeCompare(b.startTime) || a.label.localeCompare(b.label);
  });
}
