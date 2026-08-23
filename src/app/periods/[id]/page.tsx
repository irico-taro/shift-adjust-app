import Link from "next/link";
import { notFound } from "next/navigation";
import { loadScheduleContext } from "@/lib/repo";
import { ScheduleBoard } from "@/components/ScheduleBoard";
import { PHASE_HINT, PHASE_LABEL } from "@/lib/labels";
import { dateRange } from "@/lib/time";
import {
  clearAssignmentsAction,
  deletePeriodAction,
  generateDraftAction,
  setPhaseAction,
} from "@/app/actions";
import type { Phase } from "@/lib/types";

export const dynamic = "force-dynamic";

const NEXT_PHASE: Record<Phase, { phase: Phase; label: string }[]> = {
  collecting: [{ phase: "adjusting", label: "希望を締め切って調整へ" }],
  adjusting: [
    { phase: "collecting", label: "募集中に戻す" },
    { phase: "confirmed", label: "確定して公開" },
  ],
  confirmed: [{ phase: "adjusting", label: "調整中に戻す" }],
};

export default async function PeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = loadScheduleContext(id);
  if (!ctx) notFound();

  const { period } = ctx;
  const dates = dateRange(period.startDate, period.endDate);
  const submitted = ctx.staff.filter(
    (s) => ctx.availabilities.filter((a) => a.staffId === s.id).length >= dates.length,
  ).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {period.name} <span className={`badge badge-${period.phase}`}>{PHASE_LABEL[period.phase]}</span>
          </h1>
          <p className="sub">
            {period.startDate} 〜 {period.endDate}({dates.length}日) / 希望提出 {submitted}/{ctx.staff.length} 人
            <br />
            {PHASE_HINT[period.phase]}
          </p>
        </div>
        <div className="row">
          <Link className="btn" href={`/periods/${period.id}/availability`}>
            希望入力
          </Link>
          {NEXT_PHASE[period.phase].map((next) => (
            <form key={next.phase} action={setPhaseAction}>
              <input type="hidden" name="id" value={period.id} />
              <input type="hidden" name="phase" value={next.phase} />
              <button className={`btn${next.phase === "confirmed" ? " btn-primary" : ""}`} type="submit">
                {next.label}
              </button>
            </form>
          ))}
        </div>
      </div>

      {period.phase !== "confirmed" && (
        <div className="card">
          <div className="card-head" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ marginBottom: 2 }}>たたき台の自動生成</h2>
              <p className="muted small" style={{ margin: 0 }}>
                資格を満たす人が少ないコマから順に、希望と労働ルールを守れる範囲で日付順に割り当てます。生成後は手動で調整してください。
              </p>
            </div>
            <div className="row">
              <form action={generateDraftAction}>
                <input type="hidden" name="periodId" value={period.id} />
                <input type="hidden" name="mode" value="reset" />
                <button className="btn btn-primary" type="submit">
                  自動生成(仮組みを作り直す)
                </button>
              </form>
              <form action={generateDraftAction}>
                <input type="hidden" name="periodId" value={period.id} />
                <input type="hidden" name="mode" value="fill" />
                <button className="btn" type="submit" title="既存の割当を残したまま、不足しているコマだけ埋めます">
                  不足分だけ埋める
                </button>
              </form>
              <form action={clearAssignmentsAction}>
                <input type="hidden" name="periodId" value={period.id} />
                <button className="btn btn-danger" type="submit">
                  全消去
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2 style={{ marginBottom: 2 }}>出力・配布</h2>
            <p className="muted small" style={{ margin: 0 }}>
              貼り出す月間表、各自に配る個人表、Excel で開ける CSV を出力できます。
            </p>
          </div>
          <div className="row">
            <Link className="btn" href={`/periods/${period.id}/print`}>
              月間シフト表(印刷)
            </Link>
            <Link className="btn" href={`/periods/${period.id}/print/staff`}>
              個人シフト表(印刷)
            </Link>
            <a className="btn" href={`/periods/${period.id}/export?type=matrix`}>
              CSV:シフト表
            </a>
            <a className="btn" href={`/periods/${period.id}/export?type=staff`}>
              CSV:スタッフ別
            </a>
            <a className="btn" href={`/periods/${period.id}/export?type=detail`}>
              CSV:明細
            </a>
          </div>
        </div>
      </div>

      <ScheduleBoard ctx={ctx} />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row small muted">
          <span>凡例:</span>
          <span className="badge badge-error">赤セル = 人手不足 / ルール違反</span>
          <span className="badge badge-warning">黄セル = 必要人数超過・条件付き希望</span>
          <span>セルの「+」で候補一覧、名前クリックで解除。</span>
          <div className="spacer" />
          <form action={deletePeriodAction}>
            <input type="hidden" name="id" value={period.id} />
            <button className="btn btn-sm btn-danger" type="submit">
              この期間を削除
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
