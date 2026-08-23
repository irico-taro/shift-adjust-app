"use client";

import { useState } from "react";
import { deleteWorkRuleAction, saveWorkRuleAction } from "@/app/actions";
import { RULE_DESCRIPTION, RULE_LABEL } from "@/lib/labels";
import type { WorkRule, WorkRuleKind } from "@/lib/types";

const KINDS: WorkRuleKind[] = ["minInterval", "forbiddenSequence", "maxConsecutiveDays", "weeklyHoursRange"];

export function WorkRuleForm({ rule, labels }: { rule?: WorkRule; labels: string[] }) {
  const [kind, setKind] = useState<WorkRuleKind>(rule?.kind ?? "minInterval");
  const isNew = !rule;

  const labelSelect = (name: string, defaultValue: string | null) => (
    <select name={name} defaultValue={defaultValue ?? labels[0] ?? ""} style={{ width: 130 }}>
      {labels.length === 0 && <option value="">(枠が未登録)</option>}
      {labels.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );

  return (
    <form
      action={saveWorkRuleAction}
      className="stack"
      style={{ gap: 6, padding: "10px 0", borderTop: isNew ? "1px solid var(--border)" : undefined }}
    >
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <div className="row" style={{ gap: 8 }}>
        <label className="row small" style={{ gap: 4 }} title="このルールを判定に使う">
          <input type="checkbox" name="enabled" defaultChecked={rule ? rule.enabled : true} />
          有効
        </label>
        {isNew ? (
          <select value={kind} name="kind" onChange={(e) => setKind(e.target.value as WorkRuleKind)} style={{ width: 200 }}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {RULE_LABEL[k]}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input type="hidden" name="kind" value={rule.kind} />
            <strong style={{ width: 200 }}>{RULE_LABEL[rule.kind]}</strong>
          </>
        )}

        {kind === "minInterval" && (
          <>
            {labelSelect("afterShiftLabel", rule?.afterShiftLabel ?? null)}
            <span className="small muted">の後、次の勤務まで</span>
            <input type="number" name="hours" defaultValue={rule?.hours ?? 11} min={0} max={48} step={0.5} style={{ width: 66 }} />
            <span className="small muted">時間空ける</span>
          </>
        )}

        {kind === "forbiddenSequence" && (
          <>
            {labelSelect("afterShiftLabel", rule?.afterShiftLabel ?? null)}
            <span className="small muted">の翌日に</span>
            {labelSelect("forbiddenNextLabel", rule?.forbiddenNextLabel ?? null)}
            <span className="small muted">は不可</span>
          </>
        )}

        {kind === "maxConsecutiveDays" && (
          <>
            <span className="small muted">連勤上限</span>
            <input type="number" name="days" defaultValue={rule?.days ?? 5} min={1} max={31} style={{ width: 66 }} />
            <span className="small muted">日まで</span>
          </>
        )}

        {kind === "weeklyHoursRange" && (
          <span className="small muted">スタッフごとに設定した週の下限・上限時間と照合します(パラメータなし)</span>
        )}

        <div className="spacer" />
        <button className="btn btn-sm btn-primary" type="submit">
          {isNew ? "追加" : "保存"}
        </button>
        {rule && (
          <button className="btn btn-sm btn-danger" type="submit" formAction={deleteWorkRuleAction}>
            削除
          </button>
        )}
      </div>
      <span className="small muted">{RULE_DESCRIPTION[kind]}</span>
    </form>
  );
}
