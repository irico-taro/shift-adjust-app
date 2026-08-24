/**
 * 出品ページ・提案資料に載せるサンプル帳票を作るためのデモデータ生成スクリプト。
 *
 *   npm run demo:data                     -> data/demo.db を作り直す
 *   SHIFT_DB_PATH=data/demo.db npm start  -> そのデータでアプリを起動して帳票を出力する
 *
 * 登場する店舗名・氏名はすべて架空。実データは一切含めない。
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../src/lib/schema";
import { generateDraft } from "../src/lib/autoAssign";
import { dateRange } from "../src/lib/time";
import type {
  Availability,
  LessonType,
  ScheduleContext,
  SchedulePeriod,
  Staff,
  WeeklyTemplateSlot,
  WorkRule,
} from "../src/lib/types";

const STUDIO = "スタジオ・ミモザ";
const START = "2026-09-01";
const END = "2026-09-30";

const lessonTypes: LessonType[] = [
  { id: "lt-hatha", name: "ハタヨガ", color: "#7c3aed", sortOrder: 0 },
  { id: "lt-pilates", name: "ピラティス", color: "#0ea5e9", sortOrder: 1 },
  { id: "lt-yin", name: "陰ヨガ", color: "#10b981", sortOrder: 2 },
  { id: "lt-maternity", name: "マタニティ", color: "#f97316", sortOrder: 3 },
];

const staff: Staff[] = [
  { id: "s1", name: "青木 里奈", color: "#ef4444", qualifiedLessonTypeIds: ["lt-hatha", "lt-pilates", "lt-yin"], weeklyHoursMin: 24, weeklyHoursMax: 40, sortOrder: 0 },
  { id: "s2", name: "石田 慎一", color: "#f59e0b", qualifiedLessonTypeIds: ["lt-hatha", "lt-pilates"], weeklyHoursMin: 20, weeklyHoursMax: 36, sortOrder: 1 },
  { id: "s3", name: "上原 かおり", color: "#3b82f6", qualifiedLessonTypeIds: ["lt-pilates", "lt-yin"], weeklyHoursMin: 16, weeklyHoursMax: 32, sortOrder: 2 },
  { id: "s4", name: "遠藤 拓真", color: "#8b5cf6", qualifiedLessonTypeIds: ["lt-hatha"], weeklyHoursMin: 20, weeklyHoursMax: 40, sortOrder: 3 },
  { id: "s5", name: "小林 芽依", color: "#ec4899", qualifiedLessonTypeIds: ["lt-yin", "lt-maternity"], weeklyHoursMin: 12, weeklyHoursMax: 28, sortOrder: 4 },
  { id: "s6", name: "佐々木 悠", color: "#14b8a6", qualifiedLessonTypeIds: [], weeklyHoursMin: 20, weeklyHoursMax: 40, sortOrder: 5 },
  { id: "s7", name: "田村 由紀", color: "#6366f1", qualifiedLessonTypeIds: ["lt-maternity", "lt-hatha"], weeklyHoursMin: 16, weeklyHoursMax: 32, sortOrder: 6 },
  { id: "s8", name: "中川 蓮", color: "#84cc16", qualifiedLessonTypeIds: [], weeklyHoursMin: 16, weeklyHoursMax: 36, sortOrder: 7 },
];

const slots: WeeklyTemplateSlot[] = [];
const addSlot = (
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  slotType: "lesson" | "shift",
  lessonTypeId: string | null,
  shiftLabel: string | null,
  requiredCount: number,
) => {
  slots.push({
    id: `slot-${dayOfWeek}-${startTime.replace(":", "")}-${lessonTypeId ?? shiftLabel}`,
    dayOfWeek,
    startTime,
    endTime,
    slotType,
    lessonTypeId,
    shiftLabel,
    requiredCount,
  });
};

for (let day = 0; day <= 6; day++) {
  const weekend = day === 0 || day === 6;

  // 業務シフト(スタジオの営業時間に合わせた3交代)
  addSlot(day, "09:00", "14:00", "shift", null, "早番", weekend ? 2 : 1);
  addSlot(day, "14:00", "19:00", "shift", null, "遅番", weekend ? 2 : 1);
  addSlot(day, "19:00", "22:00", "shift", null, "クローズ", 1);

  // レッスン枠
  addSlot(day, "10:00", "11:00", "lesson", "lt-hatha", null, 1);
  if (weekend) {
    addSlot(day, "11:30", "12:30", "lesson", "lt-yin", null, 1);
    addSlot(day, "15:00", "16:00", "lesson", "lt-pilates", null, 1);
  } else {
    addSlot(day, "13:00", "14:00", "lesson", "lt-maternity", null, 1);
    addSlot(day, "19:00", "20:00", "lesson", "lt-pilates", null, 1);
  }
}

const period: SchedulePeriod = {
  id: "demo-period",
  name: `${STUDIO} 2026年9月`,
  startDate: START,
  endDate: END,
  phase: "confirmed",
};

const workRules: WorkRule[] = [
  { id: "r1", kind: "minInterval", enabled: true, afterShiftLabel: "クローズ", forbiddenNextLabel: null, hours: 12, days: null },
  { id: "r2", kind: "forbiddenSequence", enabled: true, afterShiftLabel: "クローズ", forbiddenNextLabel: "早番", hours: null, days: null },
  { id: "r3", kind: "maxConsecutiveDays", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: 5 },
  { id: "r4", kind: "weeklyHoursRange", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: null },
];

/** 同じ入力からは必ず同じ希望が生まれるようにする(サンプルを再現できるように)。 */
function pseudoRandom(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const availabilities: Availability[] = [];
for (const member of staff) {
  for (const date of dateRange(START, END)) {
    const r = pseudoRandom(`${member.id}:${date}`);
    if (r < 0.14) {
      availabilities.push({ staffId: member.id, periodId: period.id, date, status: "ng", availableFrom: null, availableTo: null });
    } else if (r < 0.26) {
      availabilities.push({ staffId: member.id, periodId: period.id, date, status: "conditional", availableFrom: "09:00", availableTo: "17:00" });
    } else {
      availabilities.push({ staffId: member.id, periodId: period.id, date, status: "ok", availableFrom: null, availableTo: null });
    }
  }
}

const ctx: ScheduleContext = {
  period,
  staff,
  lessonTypes,
  slots,
  availabilities,
  assignments: [],
  workRules,
};

// 実際の運用と同じ手順(自動生成)でシフトを組む
const result = generateDraft(ctx);

const dbPath = process.env.SHIFT_DB_PATH ?? path.join(process.cwd(), "data", "demo.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

db.transaction(() => {
  const lt = db.prepare("INSERT INTO lesson_type (id, name, color, sort_order) VALUES (?, ?, ?, ?)");
  for (const l of lessonTypes) lt.run(l.id, l.name, l.color, l.sortOrder);

  const st = db.prepare("INSERT INTO staff (id, name, color, weekly_hours_min, weekly_hours_max, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
  const q = db.prepare("INSERT INTO staff_qualification (staff_id, lesson_type_id) VALUES (?, ?)");
  for (const s of staff) {
    st.run(s.id, s.name, s.color, s.weeklyHoursMin, s.weeklyHoursMax, s.sortOrder);
    for (const lessonTypeId of s.qualifiedLessonTypeIds) q.run(s.id, lessonTypeId);
  }

  const ws = db.prepare(
    `INSERT INTO weekly_template_slot (id, day_of_week, start_time, end_time, slot_type, lesson_type_id, shift_label, required_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const s of slots) ws.run(s.id, s.dayOfWeek, s.startTime, s.endTime, s.slotType, s.lessonTypeId, s.shiftLabel, s.requiredCount);

  db.prepare("INSERT INTO schedule_period (id, name, start_date, end_date, phase) VALUES (?, ?, ?, ?, ?)").run(
    period.id, period.name, period.startDate, period.endDate, period.phase,
  );

  const wr = db.prepare(
    "INSERT INTO work_rule (id, kind, enabled, after_shift_label, forbidden_next_label, hours, days) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const r of workRules) wr.run(r.id, r.kind, r.enabled ? 1 : 0, r.afterShiftLabel, r.forbiddenNextLabel, r.hours, r.days);

  const av = db.prepare(
    "INSERT INTO availability (staff_id, period_id, date, status, available_from, available_to) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const a of availabilities) av.run(a.staffId, a.periodId, a.date, a.status, a.availableFrom, a.availableTo);

  // 納品済みのサンプルなので、割当はすべて確定扱いにする
  const asg = db.prepare(
    "INSERT INTO assignment (id, period_id, date, slot_id, staff_id, status) VALUES (?, ?, ?, ?, ?, 'confirmed')",
  );
  for (const a of result.assignments) asg.run(a.id, period.id, a.date, a.slotId, a.staffId);
})();

console.log(`デモデータを作成しました: ${dbPath}`);
console.log(`  スタッフ ${staff.length}名 / 枠 ${slots.length} / 割当 ${result.assignments.length}件`);
console.log(`  埋まらなかったコマ: ${result.shortages.length}件`);
