// 自動割当(たたき台生成)。
// 要件定義 4. に従い、完全最適化ではなく「日付順の逐次処理で叩き台を作り、人間が手直しする」方針。
// 判定にはバリデーションと同じ violationsForAssignment を使う。

import { violationsForAssignment, expandOccurrences, cellKey, slotLabel } from "./rules";
import { Assignment, ScheduleContext } from "./types";
import { dateRange, slotDurationMinutes, formatDateJa } from "./time";

export type AutoAssignOptions = {
  /** true なら既存の draft を破棄して作り直す。confirmed は常に残す。 */
  resetDrafts: boolean;
};

export type AutoAssignResult = {
  assignments: Assignment[];
  created: number;
  removed: number;
  shortages: { date: string; slotId: string; label: string; missing: number }[];
};

export function generateDraft(
  ctx: ScheduleContext,
  options: AutoAssignOptions = { resetDrafts: true },
): AutoAssignResult {
  const kept = options.resetDrafts
    ? ctx.assignments.filter((a) => a.status === "confirmed")
    : [...ctx.assignments];
  const removed = ctx.assignments.length - kept.length;

  const working: Assignment[] = [...kept];
  const shortages: AutoAssignResult["shortages"] = [];
  let created = 0;

  const slotMinutes = new Map(
    ctx.slots.map((s) => [s.id, slotDurationMinutes(s.startTime, s.endTime)]),
  );
  const loadMinutes = new Map<string, number>(ctx.staff.map((s) => [s.id, 0]));
  const loadCount = new Map<string, number>(ctx.staff.map((s) => [s.id, 0]));
  for (const a of working) {
    loadMinutes.set(a.staffId, (loadMinutes.get(a.staffId) ?? 0) + (slotMinutes.get(a.slotId) ?? 0));
    loadCount.set(a.staffId, (loadCount.get(a.staffId) ?? 0) + 1);
  }

  const availabilityByStaffDate = new Map(
    ctx.availabilities.map((av) => [`${av.staffId}__${av.date}`, av]),
  );
  const occurrences = expandOccurrences(ctx.period, ctx.slots);
  const byDate = new Map<string, typeof occurrences>();
  for (const occ of occurrences) {
    const list = byDate.get(occ.date) ?? [];
    list.push(occ);
    byDate.set(occ.date, list);
  }

  // 資格保有者が少ないコマほど選択肢が狭いので、先に埋める。
  const eligibleCount = (slotId: string) => {
    const slot = ctx.slots.find((s) => s.id === slotId);
    if (!slot || slot.slotType !== "lesson" || !slot.lessonTypeId) return ctx.staff.length;
    return ctx.staff.filter((s) => s.qualifiedLessonTypeIds.includes(slot.lessonTypeId!)).length;
  };

  // 前日の勤務を見ないとルール判定できないため日付順に逐次処理する。
  for (const date of dateRange(ctx.period.startDate, ctx.period.endDate)) {
    const todays = [...(byDate.get(date) ?? [])].sort((a, b) => {
      const diff = eligibleCount(a.slot.id) - eligibleCount(b.slot.id);
      if (diff !== 0) return diff;
      if (a.slot.slotType !== b.slot.slotType) return a.slot.slotType === "lesson" ? -1 : 1;
      return a.slot.startTime.localeCompare(b.slot.startTime);
    });

    for (const occ of todays) {
      const assignedHere = () =>
        working.filter((a) => a.date === occ.date && a.slotId === occ.slot.id);

      while (assignedHere().length < occ.slot.requiredCount) {
        const taken = new Set(assignedHere().map((a) => a.staffId));

        const candidates = ctx.staff
          .filter((s) => !taken.has(s.id))
          .map((s) => {
            const candidate: Assignment = {
              id: `__candidate__${s.id}`,
              periodId: ctx.period.id,
              date: occ.date,
              slotId: occ.slot.id,
              staffId: s.id,
              status: "draft",
            };
            const violations = violationsForAssignment(ctx, candidate, [...working, candidate]);
            return { staff: s, candidate, violations };
          })
          .filter((c) => !c.violations.some((v) => v.severity === "error"));

        if (candidates.length === 0) {
          shortages.push({
            date: occ.date,
            slotId: occ.slot.id,
            label: slotLabel(occ.slot, ctx.lessonTypes),
            missing: occ.slot.requiredCount - assignedHere().length,
          });
          break;
        }

        // 希望を尊重しつつ、担当コマ数・労働時間が均等になる人を選ぶ。
        candidates.sort((a, b) => {
          const availScore = (staffId: string) => {
            const av = availabilityByStaffDate.get(`${staffId}__${occ.date}`);
            if (!av) return 2; // 未提出
            if (av.status === "ok") return 0;
            if (av.status === "conditional") return 1;
            return 3;
          };
          const byAvail = availScore(a.staff.id) - availScore(b.staff.id);
          if (byAvail !== 0) return byAvail;

          const byWarnings = a.violations.length - b.violations.length;
          if (byWarnings !== 0) return byWarnings;

          const byMinutes = (loadMinutes.get(a.staff.id) ?? 0) - (loadMinutes.get(b.staff.id) ?? 0);
          if (byMinutes !== 0) return byMinutes;

          const byCount = (loadCount.get(a.staff.id) ?? 0) - (loadCount.get(b.staff.id) ?? 0);
          if (byCount !== 0) return byCount;

          return a.staff.id.localeCompare(b.staff.id);
        });

        const chosen = candidates[0];
        working.push({ ...chosen.candidate, id: crypto.randomUUID() });
        created++;
        loadMinutes.set(
          chosen.staff.id,
          (loadMinutes.get(chosen.staff.id) ?? 0) + (slotMinutes.get(occ.slot.id) ?? 0),
        );
        loadCount.set(chosen.staff.id, (loadCount.get(chosen.staff.id) ?? 0) + 1);
      }
    }
  }

  return { assignments: working, created, removed, shortages };
}

export function describeShortages(result: AutoAssignResult): string {
  if (result.shortages.length === 0) return "";
  const head = result.shortages
    .slice(0, 5)
    .map((s) => `${formatDateJa(s.date)} ${s.label}(${s.missing}人)`)
    .join(" / ");
  const rest = result.shortages.length > 5 ? ` ほか ${result.shortages.length - 5} 件` : "";
  return `${head}${rest}`;
}

export { cellKey };
