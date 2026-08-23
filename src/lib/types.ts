// 要件定義 2. データモデル に対応するドメイン型。
// DB のスネークケース行はすべて repo 層でこの形に変換して扱う。

export type SlotType = "lesson" | "shift";
export type Phase = "collecting" | "adjusting" | "confirmed";
export type AvailabilityStatus = "ok" | "ng" | "conditional";
export type AssignmentStatus = "draft" | "confirmed";
export type WorkRuleKind =
  | "minInterval"
  | "forbiddenSequence"
  | "maxConsecutiveDays"
  | "weeklyHoursRange";

export type Staff = {
  id: string;
  name: string;
  color: string;
  qualifiedLessonTypeIds: string[];
  weeklyHoursMin: number;
  weeklyHoursMax: number;
  sortOrder: number;
};

export type LessonType = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
};

export type WeeklyTemplateSlot = {
  id: string;
  dayOfWeek: number; // 0=日 ... 6=土
  startTime: string; // HH:mm
  endTime: string; // HH:mm (startTime より小さい場合は日跨ぎ)
  slotType: SlotType;
  lessonTypeId: string | null;
  shiftLabel: string | null;
  requiredCount: number;
};

export type SchedulePeriod = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  phase: Phase;
};

export type Availability = {
  staffId: string;
  periodId: string;
  date: string;
  status: AvailabilityStatus;
  availableFrom: string | null;
  availableTo: string | null;
};

export type Assignment = {
  id: string;
  periodId: string;
  date: string;
  slotId: string;
  staffId: string;
  status: AssignmentStatus;
};

export type WorkRule = {
  id: string;
  kind: WorkRuleKind;
  enabled: boolean;
  /** minInterval / forbiddenSequence: 起点となる勤務ラベル */
  afterShiftLabel: string | null;
  /** forbiddenSequence: 翌日に禁止するラベル */
  forbiddenNextLabel: string | null;
  /** minInterval: 最低空ける時間 */
  hours: number | null;
  /** maxConsecutiveDays: 連勤上限 */
  days: number | null;
};

/** ルール判定・自動割当が必要とするデータ一式(純粋なプレーンデータ)。 */
export type ScheduleContext = {
  period: SchedulePeriod;
  staff: Staff[];
  lessonTypes: LessonType[];
  slots: WeeklyTemplateSlot[];
  availabilities: Availability[];
  assignments: Assignment[];
  workRules: WorkRule[];
};
