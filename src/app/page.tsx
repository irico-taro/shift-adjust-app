import Link from "next/link";
import { listPeriods, loadScheduleContext } from "@/lib/repo";
import { evaluateSchedule, expandOccurrences } from "@/lib/rules";
import { PHASE_LABEL } from "@/lib/labels";
import { createPeriodAction } from "./actions";
import { formatDate } from "@/lib/time";

export const dynamic = "force-dynamic";

function defaultRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0));
  return {
    start: formatDate(start),
    end: formatDate(end),
    name: `${start.getUTCFullYear()}年${start.getUTCMonth() + 1}月`,
  };
}

export default function HomePage() {
  const periods = listPeriods();
  const preset = defaultRange();

  const summaries = periods.map((period) => {
    const ctx = loadScheduleContext(period.id)!;
    const result = evaluateSchedule(ctx);
    const occurrences = expandOccurrences(period, ctx.slots);
    const required = occurrences.reduce((sum, o) => sum + o.slot.requiredCount, 0);
    const filled = occurrences.reduce(
      (sum, o) => sum + Math.min(result.cellCounts[o.key] ?? 0, o.slot.requiredCount),
      0,
    );
    return { period, result, required, filled };
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>期間一覧</h1>
          <p className="sub">募集 → 調整 → 確定 のフェーズで期間ごとにシフトを運用します。</p>
        </div>
      </div>

      <div className="card card-flush">
        {summaries.length === 0 ? (
          <div className="empty">期間がまだありません。下のフォームから作成してください。</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>期間</th>
                <th>対象日</th>
                <th>フェーズ</th>
                <th>充足</th>
                <th>チェック</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(({ period, result, required, filled }) => (
                <tr key={period.id}>
                  <td>
                    <Link href={`/periods/${period.id}`}>
                      <strong>{period.name}</strong>
                    </Link>
                  </td>
                  <td className="muted small">
                    {period.startDate} 〜 {period.endDate}
                  </td>
                  <td>
                    <span className={`badge badge-${period.phase}`}>{PHASE_LABEL[period.phase]}</span>
                  </td>
                  <td className="small">
                    {filled} / {required} 人
                    <div className="meter" style={{ marginTop: 4 }}>
                      <span
                        className={filled < required ? "under" : ""}
                        style={{ width: `${required === 0 ? 0 : (filled / required) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    {result.errorCount > 0 && (
                      <span className="badge badge-error">違反 {result.errorCount}</span>
                    )}{" "}
                    {result.warningCount > 0 && (
                      <span className="badge badge-warning">注意 {result.warningCount}</span>
                    )}
                    {result.errorCount === 0 && result.warningCount === 0 && (
                      <span className="badge badge-muted">問題なし</span>
                    )}
                  </td>
                  <td>
                    <div className="row">
                      <Link className="btn btn-sm" href={`/periods/${period.id}`}>
                        シフト表
                      </Link>
                      <Link className="btn btn-sm" href={`/periods/${period.id}/availability`}>
                        希望入力
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>期間を追加</h2>
        <form action={createPeriodAction} className="form-row">
          <label className="field">
            名称
            <input type="text" name="name" defaultValue={preset.name} required />
          </label>
          <label className="field">
            開始日
            <input type="date" name="startDate" defaultValue={preset.start} required />
          </label>
          <label className="field">
            終了日
            <input type="date" name="endDate" defaultValue={preset.end} required />
          </label>
          <button className="btn btn-primary" type="submit">
            作成して調整を始める
          </button>
        </form>
      </div>
    </>
  );
}
