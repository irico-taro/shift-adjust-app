import Link from "next/link";
import { notFound } from "next/navigation";
import { getPeriod, listAvailabilities, listStaff } from "@/lib/repo";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { PHASE_LABEL } from "@/lib/labels";
import { dateRange } from "@/lib/time";
import { fillAvailabilityAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ staff?: string }>;
}) {
  const { id } = await params;
  const { staff: staffParam } = await searchParams;
  const period = getPeriod(id);
  if (!period) notFound();

  const staff = listStaff();
  const selected = staff.find((s) => s.id === staffParam) ?? staff[0];
  const dates = dateRange(period.startDate, period.endDate);
  const availabilities = listAvailabilities(id);
  const readOnly = period.phase === "confirmed";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>希望シフト入力</h1>
          <p className="sub">
            <Link href={`/periods/${period.id}`}>{period.name}</Link>{" "}
            <span className={`badge badge-${period.phase}`}>{PHASE_LABEL[period.phase]}</span> / {period.startDate} 〜{" "}
            {period.endDate}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div className="row">
            <span className="muted small">スタッフ:</span>
            {staff.map((s) => (
              <Link
                key={s.id}
                className="btn btn-sm"
                href={`/periods/${period.id}/availability?staff=${s.id}`}
                style={
                  s.id === selected?.id
                    ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" }
                    : undefined
                }
              >
                <span className="dot" style={{ background: s.color }} />
                {s.name}
                <span className="muted small">
                  {availabilities.filter((a) => a.staffId === s.id).length}/{dates.length}
                </span>
              </Link>
            ))}
          </div>
          {selected && !readOnly && (
            <div className="row">
              <span className="muted small">一括:</span>
              {(["ok", "ng"] as const).map((status) => (
                <form key={status} action={fillAvailabilityAction}>
                  <input type="hidden" name="periodId" value={period.id} />
                  <input type="hidden" name="staffId" value={selected.id} />
                  <input type="hidden" name="status" value={status} />
                  <button className="btn btn-sm" type="submit">
                    全日 {status === "ok" ? "OK" : "NG"}
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selected ? (
        <div className="card empty">スタッフが登録されていません。</div>
      ) : (
        <div className="card">
          <h2>
            {selected.name} の希望
            {readOnly && <span className="muted small"> (確定済みのため変更できません)</span>}
          </h2>
          <AvailabilityEditor
            key={selected.id}
            periodId={period.id}
            staffId={selected.id}
            dates={dates}
            initial={availabilities.filter((a) => a.staffId === selected.id)}
            readOnly={readOnly}
          />
        </div>
      )}
    </>
  );
}
