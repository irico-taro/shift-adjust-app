import { listLessonTypes, listStaff } from "@/lib/repo";
import { deleteStaffAction, saveStaffAction } from "../actions";

export const dynamic = "force-dynamic";

export default function StaffPage() {
  const staff = listStaff();
  const lessonTypes = listLessonTypes();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>スタッフ管理</h1>
          <p className="sub">担当可能なレッスン種別(資格)と、週の労働時間の下限・上限を設定します。</p>
        </div>
      </div>

      {/* 行ごとの更新フォーム。表のセル内の入力は form 属性でここに紐づける。 */}
      {staff.map((s) => (
        <form key={`form-${s.id}`} id={`staff-${s.id}`} action={saveStaffAction}>
          <input type="hidden" name="id" value={s.id} />
        </form>
      ))}

      <div className="card card-flush">
        {staff.length === 0 ? (
          <div className="empty">スタッフが登録されていません。</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 170 }}>氏名</th>
                <th style={{ width: 56 }}>色</th>
                <th>担当可能なレッスン(資格)</th>
                <th style={{ width: 200 }}>週労働時間 下限 / 上限</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const f = `staff-${s.id}`;
                return (
                  <tr key={s.id}>
                    <td>
                      <input form={f} type="text" name="name" defaultValue={s.name} style={{ width: "100%" }} required />
                    </td>
                    <td>
                      <input form={f} type="color" name="color" defaultValue={s.color} />
                    </td>
                    <td>
                      <div className="row">
                        {lessonTypes.length === 0 && <span className="muted small">レッスン種別が未登録です</span>}
                        {lessonTypes.map((lt) => (
                          <label key={lt.id} className="row small" style={{ gap: 4 }}>
                            <input
                              form={f}
                              type="checkbox"
                              name="qualifiedLessonTypeIds"
                              value={lt.id}
                              defaultChecked={s.qualifiedLessonTypeIds.includes(lt.id)}
                            />
                            <span className="tag" style={{ background: lt.color }}>
                              {lt.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <input form={f} type="number" name="weeklyHoursMin" defaultValue={s.weeklyHoursMin} min={0} step={0.5} style={{ width: 70 }} />
                        <span className="muted">〜</span>
                        <input form={f} type="number" name="weeklyHoursMax" defaultValue={s.weeklyHoursMax} min={0} step={0.5} style={{ width: 70 }} />
                        <span className="muted small">h</span>
                      </div>
                    </td>
                    <td>
                      <div className="row">
                        <button form={f} className="btn btn-sm" type="submit">
                          保存
                        </button>
                        <button form={f} className="btn btn-sm btn-danger" type="submit" formAction={deleteStaffAction}>
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>スタッフを追加</h2>
        <form action={saveStaffAction} className="form-row">
          <label className="field">
            氏名
            <input type="text" name="name" required placeholder="山田 太郎" />
          </label>
          <label className="field">
            色
            <input type="color" name="color" defaultValue="#3b82f6" />
          </label>
          <label className="field">
            週下限 (h)
            <input type="number" name="weeklyHoursMin" defaultValue={16} min={0} step={0.5} style={{ width: 90 }} />
          </label>
          <label className="field">
            週上限 (h)
            <input type="number" name="weeklyHoursMax" defaultValue={40} min={0} step={0.5} style={{ width: 90 }} />
          </label>
          <div className="field">
            担当可能なレッスン
            <div className="row" style={{ minHeight: 30 }}>
              {lessonTypes.map((lt) => (
                <label key={lt.id} className="row small" style={{ gap: 4 }}>
                  <input type="checkbox" name="qualifiedLessonTypeIds" value={lt.id} />
                  <span className="tag" style={{ background: lt.color }}>
                    {lt.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="submit">
            追加
          </button>
        </form>
      </div>
    </>
  );
}
