import Link from "next/link";
import { notFound } from "next/navigation";
import "./month.css";
import { loadScheduleContext } from "@/lib/repo";
import { buildLanes } from "@/lib/lanes";
import { PrintButton } from "@/components/PrintButton";
import { DAY_NAMES_JA, dateRange, dayOfWeek, formatDate, parseDate } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 貼り出し用の月間シフト表(A4横)。行=日付、列=枠。 */
export default async function PrintMonthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = loadScheduleContext(id);
  if (!ctx) notFound();

  const lanes = buildLanes(ctx);
  const dates = dateRange(ctx.period.startDate, ctx.period.endDate);
  const staffById = new Map(ctx.staff.map((s) => [s.id, s]));
  const printedOn = formatDate(new Date());

  const namesIn = (date: string, slotId: string) =>
    ctx.assignments
      .filter((a) => a.date === date && a.slotId === slotId)
      .map((a) => staffById.get(a.staffId))
      .filter((s) => s != null)
      .sort((a, b) => a!.sortOrder - b!.sortOrder);

  return (
    <>
      <div className="print-toolbar no-print">
        <PrintButton />
        <Link className="btn" href={`/periods/${ctx.period.id}/print/staff`}>
          スタッフ別の個人表へ
        </Link>
        <Link className="btn btn-ghost" href={`/periods/${ctx.period.id}`}>
          シフト表に戻る
        </Link>
        <span className="muted small">
          印刷ダイアログで用紙を A4 横、「背景のグラフィック」を有効にすると色付きで出力されます。
        </span>
      </div>

      <div className="sheet">
        <div className="sheet-head">
          <h1 className="sheet-title">{ctx.period.name} シフト表</h1>
          <div className="sheet-meta">
            {ctx.period.startDate} 〜 {ctx.period.endDate}
            <br />
            出力日 {printedOn}
          </div>
        </div>

        <table className="sheet-table">
          <colgroup>
            <col className="col-date" />
            {lanes.map((lane) => (
              <col key={lane.key} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>日付</th>
              {lanes.map((lane) => (
                <th key={lane.key}>
                  <span className="lane-head-bar" style={{ background: lane.color }} />
                  <span className="lane-head-label">{lane.label}</span>
                  <span className="lane-head-time">
                    {lane.startTime}〜{lane.endTime}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const dow = dayOfWeek(date);
              return (
                <tr key={date} className={dow === 0 ? "sun" : dow === 6 ? "sat" : ""}>
                  <td className="date-cell">
                    {parseDate(date).getUTCDate()}({DAY_NAMES_JA[dow]})
                  </td>
                  {lanes.map((lane) => {
                    const slot = lane.byDay.get(dow);
                    if (!slot) return <td key={lane.key} className="no-slot" />;
                    const names = namesIn(date, slot.id);
                    return (
                      <td key={lane.key}>
                        {names.length === 0 ? (
                          <span className="name-empty">―</span>
                        ) : (
                          names.map((s) => (
                            <span className="name" key={s!.id}>
                              {s!.name}
                            </span>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="sheet-foot">
          <span>枠の色:</span>
          {lanes.map((lane) => (
            <span className="legend-item" key={lane.key}>
              <span className="legend-swatch" style={{ background: lane.color }} />
              {lane.label}
            </span>
          ))}
          <span>／ 斜線 = その曜日に枠なし ／ ― = 未配置</span>
        </div>
      </div>
    </>
  );
}
