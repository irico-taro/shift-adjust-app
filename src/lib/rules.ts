// ルール判定エンジン。
// 要件定義 4. の通り「自動生成用ロジックとバリデーション用ロジックは共通化する」ため、
// ここに定義した純粋関数をサーバー(自動割当)とクライアント(リアルタイム警告)の双方から呼ぶ。

import {
  Assignment,
  Availability,
  LessonType,
  ScheduleContext,
  Staff,
  WeeklyTemplateSlot,
} from "./types";
import {
  absoluteSpan,
  dateRange,
  dayOfWeek,
  diffDays,
  hoursFromMinutes,
  slotDurationMinutes,
  toMinutes,
  weekStart,
  MINUTES_PER_DAY,
  formatDateJa,
} from "./time";

export type ViolationCode =
  | "qualification"
  | "availabilityNg"
  | "availabilityConditional"
  | "availabilityMissing"
  | "overlap"
  | "minInterval"
  | "forbiddenSequence"
  | "maxConsecutiveDays"
  | "weeklyHoursOver"
  | "weeklyHoursUnder"
  | "understaffed"
  | "overstaffed";

export type Severity = "error" | "warning";

export type Violation = {
  code: ViolationCode;
  severity: Severity;
  message: string;
  date?: string;
  slotId?: string;
  staffId?: string;
};

/** 期間内に展開された 1 コマ(日付 × 曜日テンプレート枠)。 */
export type SlotOccurrence = {
  key: string;
  date: string;
  slot: WeeklyTemplateSlot;
};

export function cellKey(date: string, slotId: string): string {
  return `${date}__${slotId}`;
}

export function slotLabel(slot: WeeklyTemplateSlot, lessonTypes: LessonType[]): string {
  if (slot.slotType === "lesson") {
    return lessonTypes.find((l) => l.id === slot.lessonTypeId)?.name ?? "(未設定レッスン)";
  }
  return slot.shiftLabel ?? "(未設定シフト)";
}

export function slotColor(
  slot: WeeklyTemplateSlot,
  lessonTypes: LessonType[],
): string {
  if (slot.slotType === "lesson") {
    return lessonTypes.find((l) => l.id === slot.lessonTypeId)?.color ?? "#94a3b8";
  }
  return "#64748b";
}

/** 期間の各日に曜日テンプレートを当てはめ、実際のコマ一覧を作る。 */
export function expandOccurrences(
  period: { startDate: string; endDate: string },
  slots: WeeklyTemplateSlot[],
): SlotOccurrence[] {
  const byDay = new Map<number, WeeklyTemplateSlot[]>();
  for (const slot of slots) {
    const list = byDay.get(slot.dayOfWeek) ?? [];
    list.push(slot);
    byDay.set(slot.dayOfWeek, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
  }

  const out: SlotOccurrence[] = [];
  for (const date of dateRange(period.startDate, period.endDate)) {
    for (const slot of byDay.get(dayOfWeek(date)) ?? []) {
      out.push({ key: cellKey(date, slot.id), date, slot });
    }
  }
  return out;
}

type Indexes = {
  epoch: string;
  staffById: Map<string, Staff>;
  slotById: Map<string, WeeklyTemplateSlot>;
  availabilityByStaffDate: Map<string, Availability>;
  assignmentsByStaff: Map<string, Assignment[]>;
  labelOf: (a: Assignment) => string;
  spanOf: (a: Assignment) => { start: number; end: number } | null;
};

function buildIndexes(ctx: ScheduleContext, assignments: Assignment[]): Indexes {
  const slotById = new Map(ctx.slots.map((s) => [s.id, s]));
  const assignmentsByStaff = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const list = assignmentsByStaff.get(a.staffId) ?? [];
    list.push(a);
    assignmentsByStaff.set(a.staffId, list);
  }
  const epoch = ctx.period.startDate;

  const spanOf = (a: Assignment) => {
    const slot = slotById.get(a.slotId);
    if (!slot) return null;
    return absoluteSpan(epoch, a.date, slot.startTime, slot.endTime);
  };

  for (const list of assignmentsByStaff.values()) {
    list.sort((x, y) => (spanOf(x)?.start ?? 0) - (spanOf(y)?.start ?? 0));
  }

  return {
    epoch,
    staffById: new Map(ctx.staff.map((s) => [s.id, s])),
    slotById,
    availabilityByStaffDate: new Map(
      ctx.availabilities.map((av) => [`${av.staffId}__${av.date}`, av]),
    ),
    assignmentsByStaff,
    labelOf: (a) => {
      const slot = slotById.get(a.slotId);
      return slot ? slotLabel(slot, ctx.lessonTypes) : "";
    },
    spanOf,
  };
}

function assignedMinutes(idx: Indexes, staffId: string, filter?: (a: Assignment) => boolean): number {
  let total = 0;
  for (const a of idx.assignmentsByStaff.get(staffId) ?? []) {
    if (filter && !filter(a)) continue;
    const slot = idx.slotById.get(a.slotId);
    if (slot) total += slotDurationMinutes(slot.startTime, slot.endTime);
  }
  return total;
}

/** 連続勤務日数(その日付を含む連勤の長さ)。 */
function consecutiveStreak(idx: Indexes, staffId: string, date: string): number {
  const days = new Set((idx.assignmentsByStaff.get(staffId) ?? []).map((a) => a.date));
  if (!days.has(date)) return 0;
  let length = 1;
  for (let offset = 1; ; offset++) {
    const prev = shiftDate(date, -offset);
    if (!days.has(prev)) break;
    length++;
  }
  for (let offset = 1; ; offset++) {
    const next = shiftDate(date, offset);
    if (!days.has(next)) break;
    length++;
  }
  return length;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 1 件の割当が抱えるルール違反を返す。
 * 既存割当の検証にも、「この人をここに入れられるか」の候補判定にも同じ関数を使う。
 */
export function violationsForAssignment(
  ctx: ScheduleContext,
  target: Assignment,
  assignments: Assignment[],
  prebuilt?: Indexes,
): Violation[] {
  const idx = prebuilt ?? buildIndexes(ctx, assignments);
  const out: Violation[] = [];
  const slot = idx.slotById.get(target.slotId);
  const staff = idx.staffById.get(target.staffId);
  if (!slot || !staff) return out;

  const at = { date: target.date, slotId: target.slotId, staffId: target.staffId };
  const label = slotLabel(slot, ctx.lessonTypes);
  const push = (code: ViolationCode, severity: Severity, message: string) =>
    out.push({ code, severity, message, ...at });

  // --- 資格 ---
  if (slot.slotType === "lesson" && slot.lessonTypeId) {
    if (!staff.qualifiedLessonTypeIds.includes(slot.lessonTypeId)) {
      push("qualification", "error", `${staff.name} は「${label}」を担当できません`);
    }
  }

  // --- 希望シフト ---
  const av = idx.availabilityByStaffDate.get(`${target.staffId}__${target.date}`);
  if (!av) {
    push("availabilityMissing", "warning", `${staff.name} はこの日の希望が未提出です`);
  } else if (av.status === "ng") {
    push("availabilityNg", "error", `${staff.name} はこの日 NG です`);
  } else if (av.status === "conditional" && av.availableFrom && av.availableTo) {
    const from = toMinutes(av.availableFrom);
    let to = toMinutes(av.availableTo);
    if (to <= from) to += MINUTES_PER_DAY;
    const start = toMinutes(slot.startTime);
    const end = start + slotDurationMinutes(slot.startTime, slot.endTime);
    if (start < from || end > to) {
      push(
        "availabilityConditional",
        "error",
        `${staff.name} の可能時間帯 ${av.availableFrom}〜${av.availableTo} の範囲外です`,
      );
    }
  }

  const span = idx.spanOf(target);
  const others = (idx.assignmentsByStaff.get(target.staffId) ?? []).filter(
    (a) => !(a.date === target.date && a.slotId === target.slotId),
  );

  // --- 同一スタッフの勤務時間の重なり ---
  if (span) {
    for (const other of others) {
      const otherSpan = idx.spanOf(other);
      if (!otherSpan) continue;
      if (span.start < otherSpan.end && otherSpan.start < span.end) {
        push(
          "overlap",
          "error",
          `${staff.name} の勤務が「${idx.labelOf(other)}」(${other.date})と重複しています`,
        );
        break;
      }
    }
  }

  for (const rule of ctx.workRules) {
    if (!rule.enabled) continue;

    // --- 特定勤務の後、次の勤務まで最低◯時間 ---
    if (rule.kind === "minInterval" && rule.afterShiftLabel && rule.hours != null && span) {
      const needed = rule.hours * 60;
      for (const other of others) {
        const otherSpan = idx.spanOf(other);
        if (!otherSpan) continue;
        const otherLabel = idx.labelOf(other);
        // 自分が後ろの勤務 / 自分が起点の勤務、どちらの側でも警告を出す。
        const gapAfterOther = span.start - otherSpan.end;
        if (otherLabel === rule.afterShiftLabel && gapAfterOther >= 0 && gapAfterOther < needed) {
          push(
            "minInterval",
            "error",
            `「${rule.afterShiftLabel}」の後は ${rule.hours} 時間空ける必要があります(現在 ${hoursFromMinutes(gapAfterOther)} 時間)`,
          );
        }
        const gapAfterSelf = otherSpan.start - span.end;
        if (label === rule.afterShiftLabel && gapAfterSelf >= 0 && gapAfterSelf < needed) {
          push(
            "minInterval",
            "error",
            `「${label}」の後 ${hoursFromMinutes(gapAfterSelf)} 時間で次の勤務(${other.date})が入っています`,
          );
        }
      }
    }

    // --- 例:夜勤の翌日は早番不可 ---
    if (rule.kind === "forbiddenSequence" && rule.afterShiftLabel && rule.forbiddenNextLabel) {
      if (label === rule.forbiddenNextLabel) {
        const prev = shiftDate(target.date, -1);
        if (others.some((a) => a.date === prev && idx.labelOf(a) === rule.afterShiftLabel)) {
          push(
            "forbiddenSequence",
            "error",
            `「${rule.afterShiftLabel}」の翌日に「${rule.forbiddenNextLabel}」は割り当てられません`,
          );
        }
      }
      if (label === rule.afterShiftLabel) {
        const next = shiftDate(target.date, 1);
        if (others.some((a) => a.date === next && idx.labelOf(a) === rule.forbiddenNextLabel)) {
          push(
            "forbiddenSequence",
            "error",
            `翌日に「${rule.forbiddenNextLabel}」が入っています(「${rule.afterShiftLabel}」の翌日は不可)`,
          );
        }
      }
    }

    // --- 連勤上限 ---
    if (rule.kind === "maxConsecutiveDays" && rule.days != null) {
      const streak = consecutiveStreak(idx, target.staffId, target.date);
      if (streak > rule.days) {
        push(
          "maxConsecutiveDays",
          "error",
          `${staff.name} が ${streak} 連勤になっています(上限 ${rule.days} 日)`,
        );
      }
    }

    // --- 週労働時間の上限 ---
    if (rule.kind === "weeklyHoursRange") {
      const week = weekStart(target.date);
      const minutes = assignedMinutes(idx, target.staffId, (a) => weekStart(a.date) === week);
      if (minutes > staff.weeklyHoursMax * 60) {
        push(
          "weeklyHoursOver",
          "error",
          `${staff.name} の週労働時間が上限 ${staff.weeklyHoursMax}h を超えています(${hoursFromMinutes(minutes)}h)`,
        );
      }
    }
  }

  return out;
}

export type StaffLoad = {
  staffId: string;
  totalMinutes: number;
  assignmentCount: number;
  weeks: { weekStart: string; minutes: number; complete: boolean }[];
};

export type EvaluationResult = {
  violations: Violation[];
  /** セル(日付×枠)ごとの違反。ハイライト用。 */
  byCell: Record<string, Violation[]>;
  /** 割当(日付×枠×スタッフ)ごとの違反。 */
  byAssignment: Record<string, Violation[]>;
  byStaff: Record<string, Violation[]>;
  /** セルごとの割当人数。requiredCount との比較に使う。 */
  cellCounts: Record<string, number>;
  staffLoads: Record<string, StaffLoad>;
  errorCount: number;
  warningCount: number;
};

export function assignmentKey(date: string, slotId: string, staffId: string): string {
  return `${date}__${slotId}__${staffId}`;
}

/** スケジュール全体を検証する。画面の警告表示はこの結果を参照する。 */
export function evaluateSchedule(ctx: ScheduleContext): EvaluationResult {
  const assignments = ctx.assignments;
  const idx = buildIndexes(ctx, assignments);
  const occurrences = expandOccurrences(ctx.period, ctx.slots);

  const violations: Violation[] = [];
  const byCell: Record<string, Violation[]> = {};
  const byAssignment: Record<string, Violation[]> = {};
  const byStaff: Record<string, Violation[]> = {};

  const record = (v: Violation) => {
    violations.push(v);
    if (v.date && v.slotId) {
      const key = cellKey(v.date, v.slotId);
      (byCell[key] ??= []).push(v);
      if (v.staffId) {
        (byAssignment[assignmentKey(v.date, v.slotId, v.staffId)] ??= []).push(v);
      }
    }
    if (v.staffId) (byStaff[v.staffId] ??= []).push(v);
  };

  for (const a of assignments) {
    for (const v of violationsForAssignment(ctx, a, assignments, idx)) record(v);
  }

  // --- requiredCount に対する過不足 ---
  const cellCounts: Record<string, number> = {};
  for (const a of assignments) cellCounts[cellKey(a.date, a.slotId)] = (cellCounts[cellKey(a.date, a.slotId)] ?? 0) + 1;

  for (const occ of occurrences) {
    const count = cellCounts[occ.key] ?? 0;
    const label = slotLabel(occ.slot, ctx.lessonTypes);
    if (count < occ.slot.requiredCount) {
      record({
        code: "understaffed",
        severity: "warning",
        message: `${formatDateJa(occ.date)} ${occ.slot.startTime} ${label}: ${occ.slot.requiredCount - count} 人不足`,
        date: occ.date,
        slotId: occ.slot.id,
      });
    } else if (count > occ.slot.requiredCount) {
      record({
        code: "overstaffed",
        severity: "warning",
        message: `${formatDateJa(occ.date)} ${occ.slot.startTime} ${label}: 必要人数より ${count - occ.slot.requiredCount} 人多く割当されています`,
        date: occ.date,
        slotId: occ.slot.id,
      });
    }
  }

  // --- 週労働時間の下限(期間に完全に含まれる週のみ判定) ---
  const weeklyRuleEnabled = ctx.workRules.some((r) => r.kind === "weeklyHoursRange" && r.enabled);
  const staffLoads: Record<string, StaffLoad> = {};
  const weekStarts = Array.from(
    new Set(dateRange(ctx.period.startDate, ctx.period.endDate).map(weekStart)),
  ).sort();

  for (const staff of ctx.staff) {
    const list = idx.assignmentsByStaff.get(staff.id) ?? [];
    const weeks = weekStarts.map((ws) => {
      const minutes = assignedMinutes(idx, staff.id, (a) => weekStart(a.date) === ws);
      const complete =
        ws >= ctx.period.startDate && diffDays(ctx.period.startDate, ws) + 6 <= diffDays(ctx.period.startDate, ctx.period.endDate);
      if (weeklyRuleEnabled && complete && minutes < staff.weeklyHoursMin * 60) {
        record({
          code: "weeklyHoursUnder",
          severity: "warning",
          message: `${staff.name}: ${ws} の週の労働時間が下限 ${staff.weeklyHoursMin}h に届いていません(${hoursFromMinutes(minutes)}h)`,
          staffId: staff.id,
        });
      }
      return { weekStart: ws, minutes, complete };
    });
    staffLoads[staff.id] = {
      staffId: staff.id,
      totalMinutes: assignedMinutes(idx, staff.id),
      assignmentCount: list.length,
      weeks,
    };
  }

  return {
    violations,
    byCell,
    byAssignment,
    byStaff,
    cellCounts,
    staffLoads,
    errorCount: violations.filter((v) => v.severity === "error").length,
    warningCount: violations.filter((v) => v.severity === "warning").length,
  };
}

/** ある枠に staff を追加した場合に生じる違反(候補者判定用)。 */
export function violationsIfAssigned(
  ctx: ScheduleContext,
  date: string,
  slotId: string,
  staffId: string,
): Violation[] {
  const candidate: Assignment = {
    id: "__candidate__",
    periodId: ctx.period.id,
    date,
    slotId,
    staffId,
    status: "draft",
  };
  const next = [...ctx.assignments, candidate];
  return violationsForAssignment(ctx, candidate, next);
}
