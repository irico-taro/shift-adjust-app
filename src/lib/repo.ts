import "server-only";
import { getDb } from "./db";
import {
  Assignment,
  Availability,
  LessonType,
  Phase,
  ScheduleContext,
  SchedulePeriod,
  Staff,
  WeeklyTemplateSlot,
  WorkRule,
} from "./types";

const newId = () => crypto.randomUUID();

// ---------- スタッフ ----------

export function listStaff(): Staff[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM staff ORDER BY sort_order, name")
    .all() as Record<string, never>[];
  const quals = db.prepare("SELECT staff_id, lesson_type_id FROM staff_qualification").all() as {
    staff_id: string;
    lesson_type_id: string;
  }[];
  const byStaff = new Map<string, string[]>();
  for (const q of quals) {
    const list = byStaff.get(q.staff_id) ?? [];
    list.push(q.lesson_type_id);
    byStaff.set(q.staff_id, list);
  }
  return rows.map((r) => {
    const row = r as unknown as {
      id: string;
      name: string;
      color: string;
      weekly_hours_min: number;
      weekly_hours_max: number;
      sort_order: number;
    };
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      qualifiedLessonTypeIds: byStaff.get(row.id) ?? [],
      weeklyHoursMin: row.weekly_hours_min,
      weeklyHoursMax: row.weekly_hours_max,
      sortOrder: row.sort_order,
    };
  });
}

export function createStaff(input: {
  name: string;
  color: string;
  weeklyHoursMin: number;
  weeklyHoursMax: number;
  qualifiedLessonTypeIds: string[];
}): string {
  const db = getDb();
  const id = newId();
  const max = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM staff").get() as { m: number };
  db.transaction(() => {
    db.prepare(
      "INSERT INTO staff (id, name, color, weekly_hours_min, weekly_hours_max, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, input.name, input.color, input.weeklyHoursMin, input.weeklyHoursMax, max.m + 1);
    const q = db.prepare("INSERT INTO staff_qualification (staff_id, lesson_type_id) VALUES (?, ?)");
    for (const lt of input.qualifiedLessonTypeIds) q.run(id, lt);
  })();
  return id;
}

export function updateStaff(
  id: string,
  input: {
    name: string;
    color: string;
    weeklyHoursMin: number;
    weeklyHoursMax: number;
    qualifiedLessonTypeIds: string[];
  },
): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      "UPDATE staff SET name = ?, color = ?, weekly_hours_min = ?, weekly_hours_max = ? WHERE id = ?",
    ).run(input.name, input.color, input.weeklyHoursMin, input.weeklyHoursMax, id);
    db.prepare("DELETE FROM staff_qualification WHERE staff_id = ?").run(id);
    const q = db.prepare("INSERT INTO staff_qualification (staff_id, lesson_type_id) VALUES (?, ?)");
    for (const lt of input.qualifiedLessonTypeIds) q.run(id, lt);
  })();
}

export function deleteStaff(id: string): void {
  getDb().prepare("DELETE FROM staff WHERE id = ?").run(id);
}

// ---------- レッスン種別 ----------

export function listLessonTypes(): LessonType[] {
  const rows = getDb()
    .prepare("SELECT * FROM lesson_type ORDER BY sort_order, name")
    .all() as { id: string; name: string; color: string; sort_order: number }[];
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order }));
}

export function createLessonType(input: { name: string; color: string }): string {
  const db = getDb();
  const id = newId();
  const max = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM lesson_type").get() as { m: number };
  db.prepare("INSERT INTO lesson_type (id, name, color, sort_order) VALUES (?, ?, ?, ?)").run(
    id,
    input.name,
    input.color,
    max.m + 1,
  );
  return id;
}

export function updateLessonType(id: string, input: { name: string; color: string }): void {
  getDb().prepare("UPDATE lesson_type SET name = ?, color = ? WHERE id = ?").run(input.name, input.color, id);
}

export function deleteLessonType(id: string): void {
  getDb().prepare("DELETE FROM lesson_type WHERE id = ?").run(id);
}

// ---------- 曜日テンプレート ----------

type SlotRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_type: "lesson" | "shift";
  lesson_type_id: string | null;
  shift_label: string | null;
  required_count: number;
};

const toSlot = (r: SlotRow): WeeklyTemplateSlot => ({
  id: r.id,
  dayOfWeek: r.day_of_week,
  startTime: r.start_time,
  endTime: r.end_time,
  slotType: r.slot_type,
  lessonTypeId: r.lesson_type_id,
  shiftLabel: r.shift_label,
  requiredCount: r.required_count,
});

export function listSlots(): WeeklyTemplateSlot[] {
  const rows = getDb()
    .prepare("SELECT * FROM weekly_template_slot ORDER BY day_of_week, start_time")
    .all() as SlotRow[];
  return rows.map(toSlot);
}

export type SlotInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotType: "lesson" | "shift";
  lessonTypeId: string | null;
  shiftLabel: string | null;
  requiredCount: number;
};

export function createSlot(input: SlotInput): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO weekly_template_slot
       (id, day_of_week, start_time, end_time, slot_type, lesson_type_id, shift_label, required_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.dayOfWeek,
      input.startTime,
      input.endTime,
      input.slotType,
      input.slotType === "lesson" ? input.lessonTypeId : null,
      input.slotType === "shift" ? input.shiftLabel : null,
      input.requiredCount,
    );
  return id;
}

export function updateSlot(id: string, input: SlotInput): void {
  getDb()
    .prepare(
      `UPDATE weekly_template_slot
       SET day_of_week = ?, start_time = ?, end_time = ?, slot_type = ?, lesson_type_id = ?, shift_label = ?, required_count = ?
       WHERE id = ?`,
    )
    .run(
      input.dayOfWeek,
      input.startTime,
      input.endTime,
      input.slotType,
      input.slotType === "lesson" ? input.lessonTypeId : null,
      input.slotType === "shift" ? input.shiftLabel : null,
      input.requiredCount,
      id,
    );
}

export function deleteSlot(id: string): void {
  getDb().prepare("DELETE FROM weekly_template_slot WHERE id = ?").run(id);
}

/** ある曜日の枠をまとめて別の曜日へコピーする(テンプレート作成の手間を減らす)。 */
export function copyDayTemplate(fromDay: number, toDay: number): number {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM weekly_template_slot WHERE day_of_week = ?")
    .all(fromDay) as SlotRow[];
  db.transaction(() => {
    db.prepare("DELETE FROM weekly_template_slot WHERE day_of_week = ?").run(toDay);
    const stmt = db.prepare(
      `INSERT INTO weekly_template_slot
       (id, day_of_week, start_time, end_time, slot_type, lesson_type_id, shift_label, required_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rows) {
      stmt.run(newId(), toDay, r.start_time, r.end_time, r.slot_type, r.lesson_type_id, r.shift_label, r.required_count);
    }
  })();
  return rows.length;
}

// ---------- 期間 ----------

type PeriodRow = { id: string; name: string; start_date: string; end_date: string; phase: Phase };
const toPeriod = (r: PeriodRow): SchedulePeriod => ({
  id: r.id,
  name: r.name,
  startDate: r.start_date,
  endDate: r.end_date,
  phase: r.phase,
});

export function listPeriods(): SchedulePeriod[] {
  const rows = getDb()
    .prepare("SELECT * FROM schedule_period ORDER BY start_date DESC")
    .all() as PeriodRow[];
  return rows.map(toPeriod);
}

export function getPeriod(id: string): SchedulePeriod | null {
  const row = getDb().prepare("SELECT * FROM schedule_period WHERE id = ?").get(id) as PeriodRow | undefined;
  return row ? toPeriod(row) : null;
}

export function createPeriod(input: { name: string; startDate: string; endDate: string }): string {
  const id = newId();
  getDb()
    .prepare("INSERT INTO schedule_period (id, name, start_date, end_date, phase) VALUES (?, ?, ?, ?, 'collecting')")
    .run(id, input.name, input.startDate, input.endDate);
  return id;
}

export function updatePeriodPhase(id: string, phase: Phase): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE schedule_period SET phase = ? WHERE id = ?").run(phase, id);
    // 確定フェーズに入ったら仮組みをすべて確定扱いにする。
    if (phase === "confirmed") {
      db.prepare("UPDATE assignment SET status = 'confirmed' WHERE period_id = ?").run(id);
    }
  })();
}

export function deletePeriod(id: string): void {
  getDb().prepare("DELETE FROM schedule_period WHERE id = ?").run(id);
}

// ---------- 希望シフト ----------

type AvailabilityRow = {
  staff_id: string;
  period_id: string;
  date: string;
  status: Availability["status"];
  available_from: string | null;
  available_to: string | null;
};

const toAvailability = (r: AvailabilityRow): Availability => ({
  staffId: r.staff_id,
  periodId: r.period_id,
  date: r.date,
  status: r.status,
  availableFrom: r.available_from,
  availableTo: r.available_to,
});

export function listAvailabilities(periodId: string): Availability[] {
  const rows = getDb()
    .prepare("SELECT * FROM availability WHERE period_id = ?")
    .all(periodId) as AvailabilityRow[];
  return rows.map(toAvailability);
}

export function setAvailability(input: Availability): void {
  getDb()
    .prepare(
      `INSERT INTO availability (staff_id, period_id, date, status, available_from, available_to)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (staff_id, period_id, date)
       DO UPDATE SET status = excluded.status, available_from = excluded.available_from, available_to = excluded.available_to`,
    )
    .run(
      input.staffId,
      input.periodId,
      input.date,
      input.status,
      input.status === "conditional" ? input.availableFrom : null,
      input.status === "conditional" ? input.availableTo : null,
    );
}

export function clearAvailability(staffId: string, periodId: string, date: string): void {
  getDb()
    .prepare("DELETE FROM availability WHERE staff_id = ? AND period_id = ? AND date = ?")
    .run(staffId, periodId, date);
}

/** その期間の全日をまとめて同じ状態にする(「基本 OK」から始めたいとき用)。 */
export function fillAvailability(
  staffId: string,
  periodId: string,
  dates: string[],
  status: Availability["status"],
): void {
  const db = getDb();
  db.transaction(() => {
    for (const date of dates) {
      setAvailability({ staffId, periodId, date, status, availableFrom: null, availableTo: null });
    }
  })();
}

// ---------- 割当 ----------

type AssignmentRow = {
  id: string;
  period_id: string;
  date: string;
  slot_id: string;
  staff_id: string;
  status: Assignment["status"];
};

const toAssignment = (r: AssignmentRow): Assignment => ({
  id: r.id,
  periodId: r.period_id,
  date: r.date,
  slotId: r.slot_id,
  staffId: r.staff_id,
  status: r.status,
});

export function listAssignments(periodId: string): Assignment[] {
  const rows = getDb()
    .prepare("SELECT * FROM assignment WHERE period_id = ? ORDER BY date, slot_id")
    .all(periodId) as AssignmentRow[];
  return rows.map(toAssignment);
}

export function addAssignment(input: {
  periodId: string;
  date: string;
  slotId: string;
  staffId: string;
  status?: Assignment["status"];
}): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO assignment (id, period_id, date, slot_id, staff_id, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (period_id, date, slot_id, staff_id) DO NOTHING`,
    )
    .run(id, input.periodId, input.date, input.slotId, input.staffId, input.status ?? "draft");
  return id;
}

export function removeAssignment(id: string): void {
  getDb().prepare("DELETE FROM assignment WHERE id = ?").run(id);
}

export function removeAssignmentAt(periodId: string, date: string, slotId: string, staffId: string): void {
  getDb()
    .prepare("DELETE FROM assignment WHERE period_id = ? AND date = ? AND slot_id = ? AND staff_id = ?")
    .run(periodId, date, slotId, staffId);
}

/** 自動生成の結果で置き換える。 */
export function replaceAssignments(periodId: string, assignments: Assignment[]): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM assignment WHERE period_id = ?").run(periodId);
    const stmt = db.prepare(
      "INSERT INTO assignment (id, period_id, date, slot_id, staff_id, status) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const a of assignments) {
      stmt.run(a.id === "__candidate__" ? newId() : a.id, periodId, a.date, a.slotId, a.staffId, a.status);
    }
  })();
}

export function clearAssignments(periodId: string): void {
  getDb().prepare("DELETE FROM assignment WHERE period_id = ?").run(periodId);
}

// ---------- 労働ルール ----------

type WorkRuleRow = {
  id: string;
  kind: WorkRule["kind"];
  enabled: number;
  after_shift_label: string | null;
  forbidden_next_label: string | null;
  hours: number | null;
  days: number | null;
};

export function listWorkRules(): WorkRule[] {
  const rows = getDb().prepare("SELECT * FROM work_rule").all() as WorkRuleRow[];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    enabled: r.enabled === 1,
    afterShiftLabel: r.after_shift_label,
    forbiddenNextLabel: r.forbidden_next_label,
    hours: r.hours,
    days: r.days,
  }));
}

export type WorkRuleInput = {
  kind: WorkRule["kind"];
  enabled: boolean;
  afterShiftLabel: string | null;
  forbiddenNextLabel: string | null;
  hours: number | null;
  days: number | null;
};

export function createWorkRule(input: WorkRuleInput): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO work_rule (id, kind, enabled, after_shift_label, forbidden_next_label, hours, days)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.kind, input.enabled ? 1 : 0, input.afterShiftLabel, input.forbiddenNextLabel, input.hours, input.days);
  return id;
}

export function updateWorkRule(id: string, input: WorkRuleInput): void {
  getDb()
    .prepare(
      `UPDATE work_rule
       SET kind = ?, enabled = ?, after_shift_label = ?, forbidden_next_label = ?, hours = ?, days = ?
       WHERE id = ?`,
    )
    .run(input.kind, input.enabled ? 1 : 0, input.afterShiftLabel, input.forbiddenNextLabel, input.hours, input.days, id);
}

export function deleteWorkRule(id: string): void {
  getDb().prepare("DELETE FROM work_rule WHERE id = ?").run(id);
}

// ---------- まとめ読み ----------

export function loadScheduleContext(periodId: string): ScheduleContext | null {
  const period = getPeriod(periodId);
  if (!period) return null;
  return {
    period,
    staff: listStaff(),
    lessonTypes: listLessonTypes(),
    slots: listSlots(),
    availabilities: listAvailabilities(periodId),
    assignments: listAssignments(periodId),
    workRules: listWorkRules(),
  };
}
