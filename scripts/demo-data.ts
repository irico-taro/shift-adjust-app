/**
 * 出品ページ・提案資料に載せるサンプル帳票を作るためのデモデータ生成スクリプト。
 *
 *   npm run demo:data              -> data/demo-studio.db(ヨガスタジオ)
 *   npm run demo:data -- juku      -> data/demo-juku.db(学習塾)
 *   SHIFT_DB_PATH=data/demo-juku.db npm start
 *
 * 登場する店舗名・氏名はすべて架空。実データは一切含めない。
 * 希望シフトは決定論的に生成するので、何度実行しても同じサンプルが得られる。
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

const START = "2026-09-01";
const END = "2026-09-30";

/** 希望の出しやすさはスタッフによって違う(常勤は出やすく、非常勤は NG が多い)。 */
type DemoStaff = Staff & { ngRate: number };

type Preset = {
  /** 帳票の見出しに出る名称。実在の店舗と紛れないよう「〇〇」で始める。 */
  siteName: string;
  lessonTypes: LessonType[];
  staff: DemoStaff[];
  slots: WeeklyTemplateSlot[];
  workRules: WorkRule[];
};

const slotBuilder = () => {
  const slots: WeeklyTemplateSlot[] = [];
  const add = (
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    slotType: "lesson" | "shift",
    lessonTypeId: string | null,
    shiftLabel: string | null,
    requiredCount = 1,
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
  return { slots, add };
};

// ---------------------------------------------------------------- ヨガスタジオ

function studioPreset(): Preset {
  const { slots, add } = slotBuilder();
  for (let day = 0; day <= 6; day++) {
    const weekend = day === 0 || day === 6;

    // 業務シフト(営業時間に合わせた3交代)
    add(day, "09:00", "14:00", "shift", null, "早番", weekend ? 2 : 1);
    add(day, "14:00", "19:00", "shift", null, "遅番", weekend ? 2 : 1);
    add(day, "19:00", "22:00", "shift", null, "クローズ");

    // レッスン枠
    add(day, "10:00", "11:00", "lesson", "lt-hatha", null);
    if (weekend) {
      add(day, "11:30", "12:30", "lesson", "lt-yin", null);
      add(day, "15:00", "16:00", "lesson", "lt-pilates", null);
    } else {
      add(day, "13:00", "14:00", "lesson", "lt-maternity", null);
      add(day, "19:00", "20:00", "lesson", "lt-pilates", null);
    }
  }

  return {
    siteName: "〇〇スタジオ",
    lessonTypes: [
      { id: "lt-hatha", name: "ハタヨガ", color: "#7c3aed", sortOrder: 0 },
      { id: "lt-pilates", name: "ピラティス", color: "#0ea5e9", sortOrder: 1 },
      { id: "lt-yin", name: "陰ヨガ", color: "#10b981", sortOrder: 2 },
      { id: "lt-maternity", name: "マタニティ", color: "#f97316", sortOrder: 3 },
    ],
    staff: [
      { id: "s1", name: "青木 里奈", color: "#ef4444", qualifiedLessonTypeIds: ["lt-hatha", "lt-pilates", "lt-yin"], weeklyHoursMin: 24, weeklyHoursMax: 40, sortOrder: 0, ngRate: 0.14 },
      { id: "s2", name: "石田 慎一", color: "#f59e0b", qualifiedLessonTypeIds: ["lt-hatha", "lt-pilates"], weeklyHoursMin: 20, weeklyHoursMax: 36, sortOrder: 1, ngRate: 0.14 },
      { id: "s3", name: "上原 かおり", color: "#3b82f6", qualifiedLessonTypeIds: ["lt-pilates", "lt-yin"], weeklyHoursMin: 16, weeklyHoursMax: 32, sortOrder: 2, ngRate: 0.14 },
      { id: "s4", name: "遠藤 拓真", color: "#8b5cf6", qualifiedLessonTypeIds: ["lt-hatha"], weeklyHoursMin: 20, weeklyHoursMax: 40, sortOrder: 3, ngRate: 0.14 },
      { id: "s5", name: "小林 芽依", color: "#ec4899", qualifiedLessonTypeIds: ["lt-yin", "lt-maternity"], weeklyHoursMin: 12, weeklyHoursMax: 28, sortOrder: 4, ngRate: 0.14 },
      { id: "s6", name: "佐々木 悠", color: "#14b8a6", qualifiedLessonTypeIds: [], weeklyHoursMin: 20, weeklyHoursMax: 40, sortOrder: 5, ngRate: 0.14 },
      { id: "s7", name: "田村 由紀", color: "#6366f1", qualifiedLessonTypeIds: ["lt-maternity", "lt-hatha"], weeklyHoursMin: 16, weeklyHoursMax: 32, sortOrder: 6, ngRate: 0.14 },
      { id: "s8", name: "中川 蓮", color: "#84cc16", qualifiedLessonTypeIds: [], weeklyHoursMin: 16, weeklyHoursMax: 36, sortOrder: 7, ngRate: 0.14 },
    ],
    slots,
    workRules: [
      { id: "r1", kind: "minInterval", enabled: true, afterShiftLabel: "クローズ", forbiddenNextLabel: null, hours: 12, days: null },
      { id: "r2", kind: "forbiddenSequence", enabled: true, afterShiftLabel: "クローズ", forbiddenNextLabel: "早番", hours: null, days: null },
      { id: "r3", kind: "maxConsecutiveDays", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: 5 },
      { id: "r4", kind: "weeklyHoursRange", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: null },
    ],
  };
}

// -------------------------------------------------------------------- 学習塾

function jukuPreset(): Preset {
  const { slots, add } = slotBuilder();

  // 月〜金: 3限まで。各限に2教室が並行して動く。
  for (const day of [1, 2, 3, 4, 5]) {
    add(day, "17:00", "18:20", "lesson", "sub-math", null);
    add(day, "17:00", "18:20", "lesson", "sub-eng", null);
    add(day, "18:30", "19:50", "lesson", "sub-eng", null);
    add(day, "18:30", "19:50", "lesson", "sub-sci", null);
    add(day, "20:00", "21:20", "lesson", "sub-math", null);
    add(day, "20:00", "21:20", "lesson", "sub-jpn", null);

    add(day, "15:30", "17:00", "shift", null, "開校当番");
    add(day, "21:20", "22:30", "shift", null, "閉校当番");
  }

  // 土: 昼から3限。日曜は休講(枠を作らない)。
  add(6, "13:00", "14:20", "lesson", "sub-math", null);
  add(6, "14:30", "15:50", "lesson", "sub-eng", null);
  add(6, "16:00", "17:20", "lesson", "sub-sci", null);
  add(6, "11:30", "13:00", "shift", null, "開校当番");
  add(6, "17:20", "18:30", "shift", null, "閉校当番");

  return {
    siteName: "〇〇ゼミナール",
    lessonTypes: [
      { id: "sub-math", name: "数学", color: "#2563eb", sortOrder: 0 },
      { id: "sub-eng", name: "英語", color: "#dc2626", sortOrder: 1 },
      { id: "sub-sci", name: "理科", color: "#059669", sortOrder: 2 },
      { id: "sub-jpn", name: "国語", color: "#d97706", sortOrder: 3 },
    ],
    // 常勤(教室長・専任)と、週数コマだけ入る非常勤講師、授業を持たない事務。
    staff: [
      { id: "j1", name: "高橋 誠", color: "#ef4444", qualifiedLessonTypeIds: ["sub-math", "sub-eng", "sub-sci", "sub-jpn"], weeklyHoursMin: 20, weeklyHoursMax: 40, sortOrder: 0, ngRate: 0.08 },
      { id: "j2", name: "森田 優子", color: "#2563eb", qualifiedLessonTypeIds: ["sub-math", "sub-sci"], weeklyHoursMin: 16, weeklyHoursMax: 34, sortOrder: 1, ngRate: 0.1 },
      { id: "j3", name: "岡本 直樹", color: "#dc2626", qualifiedLessonTypeIds: ["sub-eng", "sub-jpn"], weeklyHoursMin: 16, weeklyHoursMax: 34, sortOrder: 2, ngRate: 0.1 },
      { id: "j4", name: "山下 彩", color: "#8b5cf6", qualifiedLessonTypeIds: ["sub-math"], weeklyHoursMin: 0, weeklyHoursMax: 12, sortOrder: 3, ngRate: 0.26 },
      { id: "j5", name: "藤井 拓海", color: "#f59e0b", qualifiedLessonTypeIds: ["sub-eng"], weeklyHoursMin: 0, weeklyHoursMax: 10, sortOrder: 4, ngRate: 0.35 },
      { id: "j6", name: "西村 香織", color: "#059669", qualifiedLessonTypeIds: ["sub-sci"], weeklyHoursMin: 0, weeklyHoursMax: 12, sortOrder: 5, ngRate: 0.32 },
      { id: "j7", name: "長谷川 亮", color: "#d97706", qualifiedLessonTypeIds: ["sub-jpn"], weeklyHoursMin: 0, weeklyHoursMax: 12, sortOrder: 6, ngRate: 0.26 },
      { id: "j8", name: "松本 さくら", color: "#ec4899", qualifiedLessonTypeIds: ["sub-math", "sub-eng", "sub-jpn"], weeklyHoursMin: 0, weeklyHoursMax: 12, sortOrder: 7, ngRate: 0.26 },
      { id: "j9", name: "井上 美穂", color: "#14b8a6", qualifiedLessonTypeIds: [], weeklyHoursMin: 8, weeklyHoursMax: 28, sortOrder: 8, ngRate: 0.1 },
    ],
    slots,
    workRules: [
      { id: "r1", kind: "minInterval", enabled: true, afterShiftLabel: "閉校当番", forbiddenNextLabel: null, hours: 12, days: null },
      { id: "r2", kind: "forbiddenSequence", enabled: true, afterShiftLabel: "閉校当番", forbiddenNextLabel: "開校当番", hours: null, days: null },
      { id: "r3", kind: "maxConsecutiveDays", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: 5 },
      { id: "r4", kind: "weeklyHoursRange", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: null },
    ],
  };
}

const PRESETS: Record<string, () => Preset> = {
  studio: studioPreset,
  juku: jukuPreset,
};

/** 同じ入力からは必ず同じ希望が生まれるようにする。 */
function pseudoRandom(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const key = process.argv[2] ?? "studio";
const build = PRESETS[key];
if (!build) {
  console.error(`不明なプリセット: ${key}(使えるのは ${Object.keys(PRESETS).join(" / ")})`);
  process.exit(1);
}
const preset = build();

const period: SchedulePeriod = {
  id: "demo-period",
  name: `${preset.siteName} 2026年9月`,
  startDate: START,
  endDate: END,
  phase: "confirmed",
};

const availabilities: Availability[] = [];
for (const member of preset.staff) {
  for (const date of dateRange(START, END)) {
    const r = pseudoRandom(`${member.id}:${date}`);
    if (r < member.ngRate) {
      availabilities.push({ staffId: member.id, periodId: period.id, date, status: "ng", availableFrom: null, availableTo: null });
    } else if (r < member.ngRate + 0.12) {
      availabilities.push({ staffId: member.id, periodId: period.id, date, status: "conditional", availableFrom: "09:00", availableTo: "17:00" });
    } else {
      availabilities.push({ staffId: member.id, periodId: period.id, date, status: "ok", availableFrom: null, availableTo: null });
    }
  }
}

const ctx: ScheduleContext = {
  period,
  staff: preset.staff,
  lessonTypes: preset.lessonTypes,
  slots: preset.slots,
  availabilities,
  assignments: [],
  workRules: preset.workRules,
};

// 実際の運用と同じ手順(自動生成)でシフトを組む
const result = generateDraft(ctx);

const dbPath = process.env.SHIFT_DB_PATH ?? path.join(process.cwd(), "data", `demo-${key}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

db.transaction(() => {
  const lt = db.prepare("INSERT INTO lesson_type (id, name, color, sort_order) VALUES (?, ?, ?, ?)");
  for (const l of preset.lessonTypes) lt.run(l.id, l.name, l.color, l.sortOrder);

  const st = db.prepare("INSERT INTO staff (id, name, color, weekly_hours_min, weekly_hours_max, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
  const q = db.prepare("INSERT INTO staff_qualification (staff_id, lesson_type_id) VALUES (?, ?)");
  for (const s of preset.staff) {
    st.run(s.id, s.name, s.color, s.weeklyHoursMin, s.weeklyHoursMax, s.sortOrder);
    for (const lessonTypeId of s.qualifiedLessonTypeIds) q.run(s.id, lessonTypeId);
  }

  const ws = db.prepare(
    `INSERT INTO weekly_template_slot (id, day_of_week, start_time, end_time, slot_type, lesson_type_id, shift_label, required_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const s of preset.slots) ws.run(s.id, s.dayOfWeek, s.startTime, s.endTime, s.slotType, s.lessonTypeId, s.shiftLabel, s.requiredCount);

  db.prepare("INSERT INTO schedule_period (id, name, start_date, end_date, phase) VALUES (?, ?, ?, ?, ?)").run(
    period.id, period.name, period.startDate, period.endDate, period.phase,
  );

  const wr = db.prepare(
    "INSERT INTO work_rule (id, kind, enabled, after_shift_label, forbidden_next_label, hours, days) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const r of preset.workRules) wr.run(r.id, r.kind, r.enabled ? 1 : 0, r.afterShiftLabel, r.forbiddenNextLabel, r.hours, r.days);

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
console.log(`  ${preset.siteName} / スタッフ ${preset.staff.length}名 / 枠 ${preset.slots.length} / 割当 ${result.assignments.length}件`);
console.log(`  埋まらなかったコマ: ${result.shortages.length}件`);
