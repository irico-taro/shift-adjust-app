import type Database from "better-sqlite3";
import { dateRange, formatDate, parseDate } from "./time";

/** 初回起動時のサンプルデータ(ヨガスタジオ想定)。空の DB のときだけ投入する。 */
export function seedIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS c FROM staff").get() as { c: number };
  if (count.c > 0) return;

  const lessonTypes = [
    { id: "lt-hatha", name: "ハタヨガ", color: "#7c3aed", sort_order: 0 },
    { id: "lt-pilates", name: "ピラティス", color: "#0ea5e9", sort_order: 1 },
    { id: "lt-yin", name: "陰ヨガ", color: "#10b981", sort_order: 2 },
  ];

  const staff = [
    { id: "st-sato", name: "佐藤 美咲", color: "#ef4444", min: 24, max: 40, quals: ["lt-hatha", "lt-pilates", "lt-yin"] },
    { id: "st-tanaka", name: "田中 陽介", color: "#f59e0b", min: 20, max: 36, quals: ["lt-hatha", "lt-pilates"] },
    { id: "st-suzuki", name: "鈴木 あかり", color: "#3b82f6", min: 16, max: 32, quals: ["lt-pilates", "lt-yin"] },
    { id: "st-takahashi", name: "高橋 健", color: "#8b5cf6", min: 20, max: 40, quals: ["lt-hatha"] },
    { id: "st-ito", name: "伊藤 さやか", color: "#ec4899", min: 12, max: 28, quals: ["lt-yin"] },
    { id: "st-watanabe", name: "渡辺 涼", color: "#14b8a6", min: 20, max: 40, quals: [] },
  ];

  const slots: {
    id: string;
    day: number;
    start: string;
    end: string;
    type: "lesson" | "shift";
    lessonTypeId: string | null;
    label: string | null;
    required: number;
  }[] = [];

  const push = (
    day: number,
    start: string,
    end: string,
    type: "lesson" | "shift",
    lessonTypeId: string | null,
    label: string | null,
    required: number,
  ) => {
    slots.push({
      id: `ws-${day}-${start.replace(":", "")}-${type}-${lessonTypeId ?? label ?? ""}`,
      day,
      start,
      end,
      type,
      lessonTypeId,
      label,
      required,
    });
  };

  for (let day = 0; day <= 6; day++) {
    const isWeekend = day === 0 || day === 6;

    // 業務シフト
    push(day, "09:00", "14:00", "shift", null, "早番", isWeekend ? 2 : 1);
    push(day, "14:00", "19:00", "shift", null, "遅番", isWeekend ? 2 : 1);
    push(day, "22:00", "06:00", "shift", null, "夜勤", 1);

    // レッスン枠
    if (!isWeekend) {
      push(day, "10:00", "11:00", "lesson", "lt-hatha", null, 1);
      push(day, "19:00", "20:00", "lesson", "lt-pilates", null, 1);
    } else {
      push(day, "10:00", "11:00", "lesson", "lt-hatha", null, 1);
      push(day, "11:30", "12:30", "lesson", "lt-yin", null, 1);
      push(day, "15:00", "16:00", "lesson", "lt-pilates", null, 1);
    }
  }

  // 当月を対象期間にする
  const today = new Date();
  const startDate = formatDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  const endDate = formatDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)));
  const periodId = "pd-current";
  const periodName = `${parseDate(startDate).getUTCFullYear()}年${parseDate(startDate).getUTCMonth() + 1}月`;

  const rules = [
    { id: "wr-min-interval", kind: "minInterval", enabled: 1, after: "夜勤", forbidden: null, hours: 11, days: null },
    { id: "wr-forbidden-seq", kind: "forbiddenSequence", enabled: 1, after: "夜勤", forbidden: "早番", hours: null, days: null },
    { id: "wr-max-consecutive", kind: "maxConsecutiveDays", enabled: 1, after: null, forbidden: null, hours: null, days: 5 },
    { id: "wr-weekly-hours", kind: "weeklyHoursRange", enabled: 1, after: null, forbidden: null, hours: null, days: null },
  ];

  const insert = db.transaction(() => {
    const lt = db.prepare("INSERT INTO lesson_type (id, name, color, sort_order) VALUES (?, ?, ?, ?)");
    for (const l of lessonTypes) lt.run(l.id, l.name, l.color, l.sort_order);

    const st = db.prepare(
      "INSERT INTO staff (id, name, color, weekly_hours_min, weekly_hours_max, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const q = db.prepare("INSERT INTO staff_qualification (staff_id, lesson_type_id) VALUES (?, ?)");
    staff.forEach((s, i) => {
      st.run(s.id, s.name, s.color, s.min, s.max, i);
      for (const qual of s.quals) q.run(s.id, qual);
    });

    const ws = db.prepare(
      `INSERT INTO weekly_template_slot
       (id, day_of_week, start_time, end_time, slot_type, lesson_type_id, shift_label, required_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of slots) ws.run(s.id, s.day, s.start, s.end, s.type, s.lessonTypeId, s.label, s.required);

    db.prepare(
      "INSERT INTO schedule_period (id, name, start_date, end_date, phase) VALUES (?, ?, ?, ?, ?)",
    ).run(periodId, periodName, startDate, endDate, "adjusting");

    const wr = db.prepare(
      `INSERT INTO work_rule (id, kind, enabled, after_shift_label, forbidden_next_label, hours, days)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rules) wr.run(r.id, r.kind, r.enabled, r.after, r.forbidden, r.hours, r.days);

    // 希望シフトのサンプル。決定論的な擬似乱数で「ほぼ OK・時々 NG / 条件付き」を作る。
    const av = db.prepare(
      `INSERT INTO availability (staff_id, period_id, date, status, available_from, available_to)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const s of staff) {
      for (const date of dateRange(startDate, endDate)) {
        const r = pseudoRandom(`${s.id}:${date}`);
        if (r < 0.15) av.run(s.id, periodId, date, "ng", null, null);
        else if (r < 0.3) av.run(s.id, periodId, date, "conditional", "09:00", "17:00");
        else av.run(s.id, periodId, date, "ok", null, null);
      }
    }
  });

  insert();
}

function pseudoRandom(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
