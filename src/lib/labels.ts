import type { Phase, WorkRuleKind } from "./types";

export const PHASE_LABEL: Record<Phase, string> = {
  collecting: "募集中",
  adjusting: "調整中",
  confirmed: "確定",
};

export const PHASE_HINT: Record<Phase, string> = {
  collecting: "スタッフが希望シフトを入力するフェーズです。",
  adjusting: "管理者が割当を組み、ルール違反と過不足を確認するフェーズです。",
  confirmed: "全員に公開済みです。変更するには調整中に戻してください。",
};

export const RULE_LABEL: Record<WorkRuleKind, string> = {
  minInterval: "勤務間インターバル",
  forbiddenSequence: "連続勤務の禁止パターン",
  maxConsecutiveDays: "連勤上限",
  weeklyHoursRange: "週労働時間の上下限",
};

export const RULE_DESCRIPTION: Record<WorkRuleKind, string> = {
  minInterval: "特定の勤務の後、次の勤務まで最低◯時間空ける",
  forbiddenSequence: "例:夜勤の翌日は早番不可",
  maxConsecutiveDays: "連続して勤務できる日数の上限",
  weeklyHoursRange: "スタッフごとに設定した週の下限・上限時間をチェックする",
};

export const AVAILABILITY_LABEL = {
  ok: "OK",
  ng: "NG",
  conditional: "条件付",
} as const;
