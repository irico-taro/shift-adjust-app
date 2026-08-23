"use client";

import { Fragment, useMemo, useOptimistic, useState, useTransition } from "react";
import { toggleAssignmentAction } from "@/app/actions";
import {
  assignmentKey,
  cellKey,
  evaluateSchedule,
  slotColor,
  slotLabel,
  type Violation,
} from "@/lib/rules";
import {
  DAY_NAMES_JA,
  dateRange,
  dayOfWeek,
  formatDateJa,
  hoursFromMinutes,
  parseDate,
  slotDurationMinutes,
  weekStart,
} from "@/lib/time";
import { AVAILABILITY_LABEL } from "@/lib/labels";
import type { Assignment, ScheduleContext, WeeklyTemplateSlot } from "@/lib/types";
import { StaffPicker } from "./StaffPicker";

type OptimisticAction = {
  periodId: string;
  date: string;
  slotId: string;
  staffId: string;
  assign: boolean;
};

type Lane = {
  key: string;
  slotType: "lesson" | "shift";
  label: string;
  startTime: string;
  endTime: string;
  color: string;
  byDay: Map<number, WeeklyTemplateSlot>;
};

function buildLanes(ctx: ScheduleContext): Lane[] {
  const lanes = new Map<string, Lane>();
  for (const slot of ctx.slots) {
    const label = slotLabel(slot, ctx.lessonTypes);
    const key = `${slot.slotType}|${label}|${slot.startTime}|${slot.endTime}`;
    const lane = lanes.get(key) ?? {
      key,
      slotType: slot.slotType,
      label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      color: slotColor(slot, ctx.lessonTypes),
      byDay: new Map<number, WeeklyTemplateSlot>(),
    };
    lane.byDay.set(slot.dayOfWeek, slot);
    lanes.set(key, lane);
  }
  return [...lanes.values()].sort((a, b) => {
    if (a.slotType !== b.slotType) return a.slotType === "lesson" ? -1 : 1;
    return a.startTime.localeCompare(b.startTime) || a.label.localeCompare(b.label);
  });
}

export function ScheduleBoard({ ctx: initialCtx }: { ctx: ScheduleContext }) {
  // サーバー側の変更(自動生成・全消去)がそのまま反映されるよう、
  // props を土台にした楽観更新で保持する。
  const [assignments, applyOptimistic] = useOptimistic(
    initialCtx.assignments,
    (state: Assignment[], action: OptimisticAction) =>
      action.assign
        ? [
            ...state,
            {
              id: `tmp-${action.date}-${action.slotId}-${action.staffId}`,
              periodId: action.periodId,
              date: action.date,
              slotId: action.slotId,
              staffId: action.staffId,
              status: "draft" as const,
            },
          ]
        : state.filter(
            (a) => !(a.date === action.date && a.slotId === action.slotId && a.staffId === action.staffId),
          ),
  );
  const [view, setView] = useState<"slot" | "staff">("slot");
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [picker, setPicker] = useState<{ date: string; slotId: string } | null>(null);
  const [, startTransition] = useTransition();

  const readOnly = initialCtx.period.phase === "confirmed";
  const ctx = useMemo<ScheduleContext>(() => ({ ...initialCtx, assignments }), [initialCtx, assignments]);
  const evaluation = useMemo(() => evaluateSchedule(ctx), [ctx]);
  const lanes = useMemo(() => buildLanes(ctx), [ctx]);

  const allDates = useMemo(
    () => dateRange(ctx.period.startDate, ctx.period.endDate),
    [ctx.period.startDate, ctx.period.endDate],
  );
  const weeks = useMemo(() => Array.from(new Set(allDates.map(weekStart))).sort(), [allDates]);
  const dates = weekFilter === "all" ? allDates : allDates.filter((d) => weekStart(d) === weekFilter);

  const staffById = useMemo(() => new Map(ctx.staff.map((s) => [s.id, s])), [ctx.staff]);
  const availabilityByStaffDate = useMemo(
    () => new Map(ctx.availabilities.map((a) => [`${a.staffId}__${a.date}`, a])),
    [ctx.availabilities],
  );

  const setAssigned = (date: string, slotId: string, staffId: string, assign: boolean) => {
    if (readOnly) return;
    const periodId = ctx.period.id;
    startTransition(async () => {
      applyOptimistic({ periodId, date, slotId, staffId, assign });
      await toggleAssignmentAction({ periodId, date, slotId, staffId, assign });
    });
  };

  const cellAssignments = (date: string, slotId: string) =>
    assignments.filter((a) => a.date === date && a.slotId === slotId);

  const severityOf = (vs: Violation[] | undefined) =>
    !vs || vs.length === 0 ? "" : vs.some((v) => v.severity === "error") ? "error" : "warning";

  return (
    <>
      <div className="card">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div className="row">
            <div className="seg" style={{ width: 180 }}>
              <button data-on={view === "slot"} onClick={() => setView("slot")} type="button">
                枠ごと
              </button>
              <button data-on={view === "staff"} onClick={() => setView("staff")} type="button">
                スタッフごと
              </button>
            </div>
            <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)}>
              <option value="all">全期間 ({allDates.length}日)</option>
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {formatDateJa(w)} の週
                </option>
              ))}
            </select>
          </div>
          <div className="row small">
            {evaluation.errorCount > 0 ? (
              <span className="badge badge-error">ルール違反 {evaluation.errorCount}</span>
            ) : (
              <span className="badge badge-confirmed">ルール違反なし</span>
            )}
            <span className="badge badge-warning">注意 {evaluation.warningCount}</span>
            <span className="muted">割当 {assignments.length} 件</span>
          </div>
        </div>
      </div>

      {readOnly && (
        <div className="card" style={{ background: "var(--ok-soft)", borderColor: "#bde5d3" }}>
          <strong>確定済みの期間です。</strong>{" "}
          <span className="small">編集するには上部の「調整中に戻す」を押してください。</span>
        </div>
      )}

      <div className="board-wrap">
        {view === "slot" ? (
          <table className="board">
            <thead>
              <tr>
                <th className="corner">枠 / 日付</th>
                {dates.map((date) => {
                  const dow = dayOfWeek(date);
                  return (
                    <th
                      key={date}
                      className={dow === 0 ? "day-weekend" : dow === 6 ? "day-sat" : ""}
                    >
                      {parseDate(date).getUTCDate()}
                      <div className="lane-sub">{DAY_NAMES_JA[dow]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(["lesson", "shift"] as const).map((type) => {
                const group = lanes.filter((l) => l.slotType === type);
                if (group.length === 0) return null;
                return (
                  <Fragment key={`group-${type}`}>
                    <tr className="group-row">
                      <th colSpan={dates.length + 1}>
                        <span className="group-label">{type === "lesson" ? "レッスン枠" : "業務シフト"}</span>
                      </th>
                    </tr>
                    {group.map((lane) => (
                      <tr key={lane.key}>
                        <th className="lane">
                          <span className="lane-title">
                            <span
                              className="dot"
                              style={{ background: lane.color, display: "inline-block", marginRight: 6 }}
                            />
                            {lane.label}
                          </span>
                          <span className="lane-sub">
                            {lane.startTime}〜{lane.endTime}
                          </span>
                        </th>
                        {dates.map((date) => {
                          const slot = lane.byDay.get(dayOfWeek(date));
                          if (!slot) return <td key={date} className="cell na" />;
                          const key = cellKey(date, slot.id);
                          const here = cellAssignments(date, slot.id);
                          const count = here.length;
                          const short = count < slot.requiredCount;
                          const over = count > slot.requiredCount;
                          const cellViolations = evaluation.byCell[key] ?? [];
                          const hasError = cellViolations.some((v) => v.severity === "error");
                          return (
                            <td
                              key={date}
                              className={`cell${short ? " understaffed" : ""}${over ? " overstaffed" : ""}${hasError ? " has-error" : ""}`}
                            >
                              <div className="cell-inner">
                                {here.map((a) => {
                                  const staff = staffById.get(a.staffId);
                                  const sev = severityOf(evaluation.byAssignment[assignmentKey(date, slot.id, a.staffId)]);
                                  return (
                                    <button
                                      key={a.staffId}
                                      className={`chip ${sev}`}
                                      style={sev ? undefined : { borderLeftColor: staff?.color }}
                                      title={
                                        (evaluation.byAssignment[assignmentKey(date, slot.id, a.staffId)] ?? [])
                                          .map((v) => v.message)
                                          .join("\n") || "クリックで割当を外す"
                                      }
                                      onClick={() => setAssigned(date, slot.id, a.staffId, false)}
                                      disabled={readOnly}
                                    >
                                      <span className="chip-name">{staff?.name ?? "?"}</span>
                                      {sev === "error" && <span>!</span>}
                                      <span className="chip-x">×</span>
                                    </button>
                                  );
                                })}
                                {!readOnly && (
                                  <button
                                    className={`cell-add${short ? " short" : ""}`}
                                    onClick={() => setPicker({ date, slotId: slot.id })}
                                  >
                                    {short ? `+ あと${slot.requiredCount - count}人` : "+"}
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="board">
            <thead>
              <tr>
                <th className="corner">スタッフ / 日付</th>
                {dates.map((date) => {
                  const dow = dayOfWeek(date);
                  return (
                    <th key={date} className={dow === 0 ? "day-weekend" : dow === 6 ? "day-sat" : ""}>
                      {parseDate(date).getUTCDate()}
                      <div className="lane-sub">{DAY_NAMES_JA[dow]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ctx.staff.map((staff) => (
                <tr key={staff.id}>
                  <th className="lane">
                    <span className="lane-title">
                      <span className="dot" style={{ background: staff.color, display: "inline-block", marginRight: 6 }} />
                      {staff.name}
                    </span>
                    <span className="lane-sub">
                      {hoursFromMinutes(evaluation.staffLoads[staff.id]?.totalMinutes ?? 0)}h /{" "}
                      {evaluation.staffLoads[staff.id]?.assignmentCount ?? 0} コマ
                    </span>
                  </th>
                  {dates.map((date) => {
                    const av = availabilityByStaffDate.get(`${staff.id}__${date}`);
                    const mine = assignments
                      .filter((a) => a.staffId === staff.id && a.date === date)
                      .map((a) => ({ a, slot: ctx.slots.find((s) => s.id === a.slotId) }))
                      .filter((x) => x.slot)
                      .sort((x, y) => x.slot!.startTime.localeCompare(y.slot!.startTime));
                    const cls =
                      av?.status === "ng" ? " understaffed" : av?.status === "conditional" ? " overstaffed" : "";
                    return (
                      <td key={date} className={`cell${cls}`}>
                        <div className="cell-inner">
                          {mine.length === 0 && av && (
                            <span className="muted small" style={{ textAlign: "center" }}>
                              {AVAILABILITY_LABEL[av.status]}
                            </span>
                          )}
                          {mine.map(({ a, slot }) => {
                            const sev = severityOf(evaluation.byAssignment[assignmentKey(date, a.slotId, staff.id)]);
                            return (
                              <button
                                key={a.slotId}
                                className={`chip ${sev}`}
                                style={sev ? undefined : { borderLeftColor: slotColor(slot!, ctx.lessonTypes) }}
                                onClick={() => setAssigned(date, a.slotId, staff.id, false)}
                                disabled={readOnly}
                                title={`${slot!.startTime}〜${slot!.endTime} クリックで外す`}
                              >
                                <span className="chip-name">
                                  {slot!.startTime} {slotLabel(slot!, ctx.lessonTypes)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>チェック結果</h2>
          <div className="violation-list">
            {evaluation.violations.length === 0 && (
              <p className="muted small">ルール違反・人手不足はありません。</p>
            )}
            {[...evaluation.violations]
              .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1))
              .map((v, i) => (
                <div key={i} className={`violation ${v.severity}`}>
                  <span>{v.severity === "error" ? "✕" : "△"}</span>
                  <span>
                    {v.date && <strong>{formatDateJa(v.date)} </strong>}
                    {v.message}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div className="card">
          <h2>スタッフ別の負荷</h2>
          <table className="data">
            <thead>
              <tr>
                <th>スタッフ</th>
                <th>コマ</th>
                <th>合計</th>
                <th>週あたり(下限/上限)</th>
              </tr>
            </thead>
            <tbody>
              {ctx.staff.map((staff) => {
                const load = evaluation.staffLoads[staff.id];
                return (
                  <tr key={staff.id}>
                    <td>
                      <span className="dot" style={{ background: staff.color, display: "inline-block", marginRight: 6 }} />
                      {staff.name}
                    </td>
                    <td>{load?.assignmentCount ?? 0}</td>
                    <td>{hoursFromMinutes(load?.totalMinutes ?? 0)}h</td>
                    <td>
                      <div className="row" style={{ gap: 3 }}>
                        {(load?.weeks ?? []).map((w) => {
                          const hours = hoursFromMinutes(w.minutes);
                          const state =
                            hours > staff.weeklyHoursMax ? "over" : w.complete && hours < staff.weeklyHoursMin ? "under" : "";
                          return (
                            <span
                              key={w.weekStart}
                              className={`badge badge-${state === "over" ? "error" : state === "under" ? "warning" : "muted"}`}
                              title={`${w.weekStart} の週 (${staff.weeklyHoursMin}〜${staff.weeklyHoursMax}h)`}
                            >
                              {hours}h
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {picker && (
        <StaffPicker
          ctx={ctx}
          date={picker.date}
          slotId={picker.slotId}
          onClose={() => setPicker(null)}
          onPick={(staffId) => {
            setAssigned(picker.date, picker.slotId, staffId, true);
            setPicker(null);
          }}
        />
      )}
    </>
  );
}

export function slotHours(slot: WeeklyTemplateSlot): number {
  return hoursFromMinutes(slotDurationMinutes(slot.startTime, slot.endTime));
}
