import Link from "next/link";
import { notFound } from "next/navigation";
import "./staff.css";
import { loadScheduleContext } from "@/lib/repo";
import { evaluateSchedule, slotColor, slotLabel } from "@/lib/rules";
import { PrintButton } from "@/components/PrintButton";
import {
  DAY_NAMES_JA,
  addDays,
  dayOfWeek,
  formatDate,
  hoursFromMinutes,
  parseDate,
} from "@/lib/time";

export const dynamic = "force-dynamic";

/** 各自に配る個人シフト表(A4縦・1人1ページのカレンダー形式)。 */
export default async function PrintStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = loadScheduleContext(id);
  if (!ctx) notFound();

  const { period } = ctx;
  const evaluation = evaluateSchedule(ctx);
  const slotById = new Map(ctx.slots.map((s) => [s.id, s]));
  const printedOn = formatDate(new Date());

  // 期間を覆う日曜始まりの週に区切る(壁掛けカレンダーと同じ並び)。
  const first = addDays(period.startDate, -dayOfWeek(period.startDate));
  const last = addDays(period.endDate, 6 - dayOfWeek(period.endDate));
  const weeks: string[][] = [];
  for (let d = first; d <= last; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  }

  const sheets = ctx.staff
    .map((staff) => {
      const byDate = new Map<string, { start: string; end: string; label: string; color: string }[]>();
      for (const a of ctx.assignments.filter((x) => x.staffId === staff.id)) {
        const slot = slotById.get(a.slotId);
        if (!slot) continue;
        const list = byDate.get(a.date) ?? [];
        list.push({
          start: slot.startTime,
          end: slot.endTime,
          label: slotLabel(slot, ctx.lessonTypes),
          color: slotColor(slot, ctx.lessonTypes),
        });
        byDate.set(a.date, list);
      }
      for (const list of byDate.values()) list.sort((a, b) => a.start.localeCompare(b.start));
      return { staff, byDate, load: evaluation.staffLoads[staff.id] };
    })
    .filter((sheet) => sheet.byDate.size > 0);

  return (
    <>
      <div className="print-toolbar no-print">
        <PrintButton label="全員分をまとめて印刷 / PDF保存" />
        <Link className="btn" href={`/periods/${period.id}/print`}>
          月間シフト表へ
        </Link>
        <Link className="btn btn-ghost" href={`/periods/${period.id}`}>
          シフト表に戻る
        </Link>
        <span className="muted small">A4 縦・1人1ページで出力されます({sheets.length}人分)。</span>
      </div>

      {sheets.length === 0 && (
        <div className="sheet">
          <p>この期間にはまだ割当がありません。シフト表で作成してから出力してください。</p>
        </div>
      )}

      {sheets.map(({ staff, byDate, load }, index) => (
        <section
          className="sheet staff-sheet"
          key={staff.id}
          style={index < sheets.length - 1 ? { breakAfter: "page" } : undefined}
        >
          <div className="sheet-head">
            <h1 className="sheet-title">
              <span className="staff-chip" style={{ background: staff.color }} />
              {staff.name} さん
            </h1>
            <div className="sheet-meta">
              {period.name} シフト
              <br />
              {period.startDate} 〜 {period.endDate} / 出力日 {printedOn}
            </div>
          </div>

          <table className="sheet-table cal">
            <thead>
              <tr>
                {DAY_NAMES_JA.map((n, i) => (
                  <th key={n} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0]}>
                  {week.map((date) => {
                    const outside = date < period.startDate || date > period.endDate;
                    const shifts = byDate.get(date) ?? [];
                    const dow = dayOfWeek(date);
                    return (
                      <td
                        key={date}
                        className={`cal-cell${outside ? " outside" : ""}${dow === 0 ? " sun" : dow === 6 ? " sat" : ""}`}
                      >
                        <span className="cal-date">{parseDate(date).getUTCDate()}</span>
                        {!outside &&
                          (shifts.length === 0 ? (
                            <span className="cal-off">休</span>
                          ) : (
                            shifts.map((s, i) => (
                              <span className="cal-shift" key={i} style={{ borderLeftColor: s.color }}>
                                <strong>
                                  {s.start}〜{s.end}
                                </strong>
                                <br />
                                {s.label}
                              </span>
                            ))
                          ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="staff-totals">
            出勤 <strong>{byDate.size}</strong> 日 / <strong>{load?.assignmentCount ?? 0}</strong> コマ /
            合計 <strong>{hoursFromMinutes(load?.totalMinutes ?? 0)}</strong> 時間
            <span className="weekly">
              週別:
              {(load?.weeks ?? []).map((w) => (
                <span key={w.weekStart}>
                  {" "}
                  {parseDate(w.weekStart).getUTCMonth() + 1}/{parseDate(w.weekStart).getUTCDate()}〜{" "}
                  {/* 配布物なので週の時間は小数第1位までにする */}
                  {Math.round(hoursFromMinutes(w.minutes) * 10) / 10}h
                </span>
              ))}
            </span>
          </div>

          <div className="sheet-foot">
            <span>変更が必要な場合は管理者までご連絡ください。</span>
          </div>
        </section>
      ))}
    </>
  );
}
