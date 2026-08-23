import { listLessonTypes, listSlots } from "@/lib/repo";
import { SlotForm } from "@/components/SlotForm";
import { DAY_NAMES_JA, slotDurationMinutes, hoursFromMinutes } from "@/lib/time";
import { copyDayTemplateAction, deleteLessonTypeAction, saveLessonTypeAction } from "../actions";

export const dynamic = "force-dynamic";

export default function TemplatePage() {
  const lessonTypes = listLessonTypes();
  const slots = listSlots();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>曜日テンプレート</h1>
          <p className="sub">
            曜日ごとの繰り返しパターンです。レッスン枠・業務シフトを同じ「枠」として登録し、必要人数を曜日単位で設定します。
          </p>
        </div>
      </div>

      <div className="card">
        <h2>レッスン種別</h2>
        <div className="stack">
          {lessonTypes.map((lt) => (
            <form key={lt.id} action={saveLessonTypeAction} className="row" style={{ gap: 6 }}>
              <input type="hidden" name="id" value={lt.id} />
              <input type="color" name="color" defaultValue={lt.color} />
              <input type="text" name="name" defaultValue={lt.name} style={{ width: 180 }} required />
              <button className="btn btn-sm" type="submit">
                保存
              </button>
              <button className="btn btn-sm btn-danger" type="submit" formAction={deleteLessonTypeAction}>
                削除
              </button>
            </form>
          ))}
          <form action={saveLessonTypeAction} className="row" style={{ gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <input type="color" name="color" defaultValue="#7c3aed" />
            <input type="text" name="name" placeholder="種別名を追加" style={{ width: 180 }} required />
            <button className="btn btn-sm btn-primary" type="submit">
              追加
            </button>
          </form>
        </div>
      </div>

      <div className="grid-2">
        {DAY_NAMES_JA.map((dayName, day) => {
          const daySlots = slots.filter((s) => s.dayOfWeek === day);
          const totalRequired = daySlots.reduce((sum, s) => sum + s.requiredCount, 0);
          const totalHours = daySlots.reduce(
            (sum, s) => sum + slotDurationMinutes(s.startTime, s.endTime) * s.requiredCount,
            0,
          );
          return (
            <div className="card" key={day}>
              <div className="card-head">
                <h2 style={{ margin: 0 }}>
                  {dayName}曜日{" "}
                  <span className="muted small" style={{ fontWeight: 400 }}>
                    {daySlots.length} 枠 / 延べ {totalRequired} 人 / {hoursFromMinutes(totalHours)}h
                  </span>
                </h2>
                <form action={copyDayTemplateAction} className="row" style={{ gap: 4 }}>
                  <input type="hidden" name="fromDay" value={day} />
                  <select name="toDay" className="small" defaultValue={(day + 1) % 7}>
                    {DAY_NAMES_JA.map((n, d) => (
                      <option key={d} value={d} disabled={d === day}>
                        {n}曜へコピー
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-sm btn-ghost" type="submit" title="コピー先の枠は置き換えられます">
                    複製
                  </button>
                </form>
              </div>

              {daySlots.length === 0 && <p className="muted small">枠がありません。</p>}
              <div className="stack" style={{ gap: 0 }}>
                {daySlots.map((slot) => (
                  <SlotForm key={slot.id} dayOfWeek={day} lessonTypes={lessonTypes} slot={slot} />
                ))}
              </div>
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 4 }}>
                <SlotForm dayOfWeek={day} lessonTypes={lessonTypes} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
