/**
 * ルール判定と自動割当の検証。`npm test` で実行する。
 * DB を使わず、手で組んだデータに対して純粋関数の振る舞いを確かめる。
 */
import assert from "node:assert/strict";
import { evaluateSchedule, violationsIfAssigned, expandOccurrences } from "../src/lib/rules";
import { generateDraft } from "../src/lib/autoAssign";
import { slotDurationMinutes, weekStart, absoluteSpan, dateRange } from "../src/lib/time";
import type { ScheduleContext, WeeklyTemplateSlot, Staff, WorkRule } from "../src/lib/types";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✕ ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
};

// 2026-06-01 は月曜。
const START = "2026-06-01";
const END = "2026-06-07";

const staff = (over: Partial<Staff> & { id: string; name: string }): Staff => ({
  color: "#000",
  qualifiedLessonTypeIds: [],
  weeklyHoursMin: 0,
  weeklyHoursMax: 40,
  sortOrder: 0,
  ...over,
});

const slot = (over: Partial<WeeklyTemplateSlot> & { id: string; dayOfWeek: number }): WeeklyTemplateSlot => ({
  startTime: "09:00",
  endTime: "14:00",
  slotType: "shift",
  lessonTypeId: null,
  shiftLabel: "早番",
  requiredCount: 1,
  ...over,
});

const baseCtx = (over: Partial<ScheduleContext> = {}): ScheduleContext => ({
  period: { id: "p1", name: "テスト", startDate: START, endDate: END, phase: "adjusting" },
  staff: [staff({ id: "s1", name: "A" })],
  lessonTypes: [{ id: "lt1", name: "ハタヨガ", color: "#7c3aed", sortOrder: 0 }],
  slots: [slot({ id: "sl1", dayOfWeek: 1 })],
  availabilities: [],
  assignments: [],
  workRules: [],
  ...over,
});

console.log("時刻ユーティリティ");

test("日跨ぎ勤務の所要時間を正しく計算する", () => {
  assert.equal(slotDurationMinutes("22:00", "06:00"), 8 * 60);
  assert.equal(slotDurationMinutes("09:00", "14:00"), 5 * 60);
});

test("週は月曜始まりで区切られる", () => {
  assert.equal(weekStart("2026-06-07"), "2026-06-01"); // 日曜 → その週の月曜
  assert.equal(weekStart("2026-06-08"), "2026-06-08"); // 月曜
});

test("日跨ぎ勤務は翌日にまたがる絶対時刻になる", () => {
  const span = absoluteSpan(START, "2026-06-01", "22:00", "06:00");
  assert.equal(span.start, 22 * 60);
  assert.equal(span.end, 30 * 60);
});

console.log("バリデーション");

test("資格のないレッスンは違反になる", () => {
  const ctx = baseCtx({
    slots: [slot({ id: "sl1", dayOfWeek: 1, slotType: "lesson", lessonTypeId: "lt1", shiftLabel: null })],
  });
  const v = violationsIfAssigned(ctx, "2026-06-01", "sl1", "s1");
  assert.ok(v.some((x) => x.code === "qualification" && x.severity === "error"));

  const qualified = baseCtx({
    ...ctx,
    staff: [staff({ id: "s1", name: "A", qualifiedLessonTypeIds: ["lt1"] })],
  });
  assert.ok(!violationsIfAssigned(qualified, "2026-06-01", "sl1", "s1").some((x) => x.code === "qualification"));
});

test("NG の日への割当は違反になる", () => {
  const ctx = baseCtx({
    availabilities: [
      { staffId: "s1", periodId: "p1", date: "2026-06-01", status: "ng", availableFrom: null, availableTo: null },
    ],
  });
  assert.ok(violationsIfAssigned(ctx, "2026-06-01", "sl1", "s1").some((x) => x.code === "availabilityNg"));
});

test("条件付き希望の時間帯外は違反、範囲内なら通る", () => {
  const outside = baseCtx({
    availabilities: [
      { staffId: "s1", periodId: "p1", date: "2026-06-01", status: "conditional", availableFrom: "10:00", availableTo: "12:00" },
    ],
  });
  assert.ok(violationsIfAssigned(outside, "2026-06-01", "sl1", "s1").some((x) => x.code === "availabilityConditional"));

  const inside = baseCtx({
    availabilities: [
      { staffId: "s1", periodId: "p1", date: "2026-06-01", status: "conditional", availableFrom: "08:00", availableTo: "18:00" },
    ],
  });
  assert.ok(!violationsIfAssigned(inside, "2026-06-01", "sl1", "s1").some((x) => x.code === "availabilityConditional"));
});

test("希望未提出は警告(エラーではない)", () => {
  const v = violationsIfAssigned(baseCtx(), "2026-06-01", "sl1", "s1");
  const missing = v.find((x) => x.code === "availabilityMissing");
  assert.ok(missing);
  assert.equal(missing!.severity, "warning");
});

test("夜勤明けのインターバル不足を検出する", () => {
  const rule: WorkRule = {
    id: "r1", kind: "minInterval", enabled: true,
    afterShiftLabel: "夜勤", forbiddenNextLabel: null, hours: 11, days: null,
  };
  const ctx = baseCtx({
    slots: [
      slot({ id: "night", dayOfWeek: 1, startTime: "22:00", endTime: "06:00", shiftLabel: "夜勤" }),
      slot({ id: "late", dayOfWeek: 2, startTime: "14:00", endTime: "19:00", shiftLabel: "遅番" }),
    ],
    workRules: [rule],
    assignments: [
      { id: "a1", periodId: "p1", date: "2026-06-01", slotId: "night", staffId: "s1", status: "draft" },
    ],
  });
  // 06:00 終わり → 同日 14:00 開始は 8 時間しか空かない
  assert.ok(violationsIfAssigned(ctx, "2026-06-02", "late", "s1").some((x) => x.code === "minInterval"));

  // 11 時間以上空けば通る
  const relaxed = { ...ctx, workRules: [{ ...rule, hours: 8 }] };
  assert.ok(!violationsIfAssigned(relaxed, "2026-06-02", "late", "s1").some((x) => x.code === "minInterval"));
});

test("夜勤の翌日の早番を禁止できる", () => {
  const ctx = baseCtx({
    slots: [
      slot({ id: "night", dayOfWeek: 1, startTime: "22:00", endTime: "06:00", shiftLabel: "夜勤" }),
      slot({ id: "early", dayOfWeek: 2, startTime: "09:00", endTime: "14:00", shiftLabel: "早番" }),
    ],
    workRules: [
      { id: "r2", kind: "forbiddenSequence", enabled: true, afterShiftLabel: "夜勤", forbiddenNextLabel: "早番", hours: null, days: null },
    ],
    assignments: [
      { id: "a1", periodId: "p1", date: "2026-06-01", slotId: "night", staffId: "s1", status: "draft" },
    ],
  });
  assert.ok(violationsIfAssigned(ctx, "2026-06-02", "early", "s1").some((x) => x.code === "forbiddenSequence"));
});

test("連勤上限を超えると違反になる", () => {
  const slots = [0, 1, 2, 3, 4, 5, 6].map((d) => slot({ id: `d${d}`, dayOfWeek: d }));
  const dates = dateRange(START, "2026-06-03");
  const ctx = baseCtx({
    slots,
    workRules: [
      { id: "r3", kind: "maxConsecutiveDays", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: 3 },
    ],
    assignments: dates.map((date, i) => ({
      id: `a${i}`, periodId: "p1", date,
      slotId: `d${new Date(`${date}T00:00:00Z`).getUTCDay()}`,
      staffId: "s1", status: "draft" as const,
    })),
  });
  // 3 連勤までは OK
  assert.equal(evaluateSchedule(ctx).violations.filter((v) => v.code === "maxConsecutiveDays").length, 0);
  // 4 日目を足すと違反
  assert.ok(violationsIfAssigned(ctx, "2026-06-04", "d4", "s1").some((x) => x.code === "maxConsecutiveDays"));
});

test("週労働時間の上限超過と下限未達を検出する", () => {
  const slots = [1, 2, 3, 4, 5].map((d) => slot({ id: `d${d}`, dayOfWeek: d, startTime: "09:00", endTime: "19:00" })); // 10h
  const ctx = baseCtx({
    staff: [staff({ id: "s1", name: "A", weeklyHoursMin: 20, weeklyHoursMax: 30 })],
    slots,
    workRules: [
      { id: "r4", kind: "weeklyHoursRange", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: null },
    ],
    assignments: [1, 2, 3].map((d) => ({
      id: `a${d}`, periodId: "p1", date: `2026-06-0${d}`, slotId: `d${d}`, staffId: "s1", status: "draft" as const,
    })),
  });
  // 30h ちょうどは上限内
  assert.equal(evaluateSchedule(ctx).violations.filter((v) => v.code === "weeklyHoursOver").length, 0);
  // 4 日目 (40h) で超過
  assert.ok(violationsIfAssigned(ctx, "2026-06-04", "d4", "s1").some((x) => x.code === "weeklyHoursOver"));

  // 下限未達は警告として出る
  const light = { ...ctx, assignments: [ctx.assignments[0]] }; // 10h < 20h
  assert.ok(evaluateSchedule(light).violations.some((v) => v.code === "weeklyHoursUnder" && v.severity === "warning"));
});

test("同じ人の勤務時間が重なると違反になる", () => {
  const ctx = baseCtx({
    slots: [
      slot({ id: "am", dayOfWeek: 1, startTime: "09:00", endTime: "14:00" }),
      slot({ id: "mid", dayOfWeek: 1, startTime: "13:00", endTime: "18:00", shiftLabel: "遅番" }),
    ],
    assignments: [{ id: "a1", periodId: "p1", date: "2026-06-01", slotId: "am", staffId: "s1", status: "draft" }],
  });
  assert.ok(violationsIfAssigned(ctx, "2026-06-01", "mid", "s1").some((x) => x.code === "overlap"));
});

test("必要人数に対する過不足を検出する", () => {
  const ctx = baseCtx({
    slots: [slot({ id: "sl1", dayOfWeek: 1, requiredCount: 2 })],
    staff: [staff({ id: "s1", name: "A" }), staff({ id: "s2", name: "B" })],
  });
  assert.ok(evaluateSchedule(ctx).violations.some((v) => v.code === "understaffed"));

  const filled = {
    ...ctx,
    assignments: ["s1", "s2"].map((id) => ({
      id: `a-${id}`, periodId: "p1", date: "2026-06-01", slotId: "sl1", staffId: id, status: "draft" as const,
    })),
  };
  const result = evaluateSchedule(filled);
  assert.equal(result.violations.filter((v) => v.code === "understaffed").length, 0);
  assert.equal(result.cellCounts["2026-06-01__sl1"], 2);
});

console.log("自動割当");

test("期間内の全コマが展開される", () => {
  const ctx = baseCtx({ slots: [slot({ id: "sl1", dayOfWeek: 1 }), slot({ id: "sl2", dayOfWeek: 3 })] });
  const occ = expandOccurrences(ctx.period, ctx.slots);
  assert.equal(occ.length, 2); // 1週間なので月曜1回・水曜1回
});

test("たたき台はルール違反(エラー)を作らない", () => {
  const lessonTypes = [
    { id: "lt1", name: "ハタヨガ", color: "#7c3aed", sortOrder: 0 },
    { id: "lt2", name: "ピラティス", color: "#0ea5e9", sortOrder: 1 },
  ];
  const slots: WeeklyTemplateSlot[] = [];
  for (let d = 0; d <= 6; d++) {
    slots.push(slot({ id: `early-${d}`, dayOfWeek: d, startTime: "09:00", endTime: "14:00", shiftLabel: "早番" }));
    slots.push(slot({ id: `late-${d}`, dayOfWeek: d, startTime: "14:00", endTime: "19:00", shiftLabel: "遅番" }));
    slots.push(slot({ id: `night-${d}`, dayOfWeek: d, startTime: "22:00", endTime: "06:00", shiftLabel: "夜勤" }));
    slots.push(slot({ id: `hatha-${d}`, dayOfWeek: d, startTime: "10:00", endTime: "11:00", slotType: "lesson", lessonTypeId: "lt1", shiftLabel: null }));
    slots.push(slot({ id: `pilates-${d}`, dayOfWeek: d, startTime: "19:00", endTime: "20:00", slotType: "lesson", lessonTypeId: "lt2", shiftLabel: null }));
  }
  const members = [
    staff({ id: "s1", name: "A", qualifiedLessonTypeIds: ["lt1", "lt2"], weeklyHoursMax: 40 }),
    staff({ id: "s2", name: "B", qualifiedLessonTypeIds: ["lt1"], weeklyHoursMax: 40 }),
    staff({ id: "s3", name: "C", qualifiedLessonTypeIds: ["lt2"], weeklyHoursMax: 40 }),
    staff({ id: "s4", name: "D", weeklyHoursMax: 40 }),
    staff({ id: "s5", name: "E", weeklyHoursMax: 40 }),
  ];
  const ctx = baseCtx({
    lessonTypes,
    slots,
    staff: members,
    availabilities: members.flatMap((m) =>
      dateRange(START, END).map((date) => ({
        staffId: m.id, periodId: "p1", date,
        status: "ok" as const, availableFrom: null, availableTo: null,
      })),
    ),
    workRules: [
      { id: "r1", kind: "minInterval", enabled: true, afterShiftLabel: "夜勤", forbiddenNextLabel: null, hours: 11, days: null },
      { id: "r2", kind: "forbiddenSequence", enabled: true, afterShiftLabel: "夜勤", forbiddenNextLabel: "早番", hours: null, days: null },
      { id: "r3", kind: "maxConsecutiveDays", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: 5 },
      { id: "r4", kind: "weeklyHoursRange", enabled: true, afterShiftLabel: null, forbiddenNextLabel: null, hours: null, days: null },
    ],
  });

  const result = generateDraft(ctx);
  assert.ok(result.created > 0, "割当が生成されること");

  const evaluated = evaluateSchedule({ ...ctx, assignments: result.assignments });
  const errors = evaluated.violations.filter((v) => v.severity === "error");
  assert.deepEqual(errors.map((e) => `${e.date} ${e.message}`), [], "エラーレベルの違反が残らないこと");
});

test("確定済みの割当は作り直しても残る", () => {
  const ctx = baseCtx({
    staff: [staff({ id: "s1", name: "A" }), staff({ id: "s2", name: "B" })],
    assignments: [
      { id: "keep", periodId: "p1", date: "2026-06-01", slotId: "sl1", staffId: "s2", status: "confirmed" },
    ],
  });
  const result = generateDraft(ctx, { resetDrafts: true });
  assert.ok(result.assignments.some((a) => a.id === "keep"));
});

test("希望 NG の人は自動割当されない", () => {
  const ctx = baseCtx({
    staff: [staff({ id: "s1", name: "A" }), staff({ id: "s2", name: "B" })],
    availabilities: [
      { staffId: "s1", periodId: "p1", date: "2026-06-01", status: "ng", availableFrom: null, availableTo: null },
      { staffId: "s2", periodId: "p1", date: "2026-06-01", status: "ok", availableFrom: null, availableTo: null },
    ],
  });
  const result = generateDraft(ctx);
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0].staffId, "s2");
});

test("割当できる人がいないコマは不足として報告される", () => {
  const ctx = baseCtx({
    slots: [slot({ id: "sl1", dayOfWeek: 1, slotType: "lesson", lessonTypeId: "lt1", shiftLabel: null })],
    staff: [staff({ id: "s1", name: "A" })], // 資格なし
  });
  const result = generateDraft(ctx);
  assert.equal(result.assignments.length, 0);
  assert.equal(result.shortages.length, 1);
  assert.equal(result.shortages[0].label, "ハタヨガ");
});

console.log(`\n${passed} 件のテストが通りました。`);
