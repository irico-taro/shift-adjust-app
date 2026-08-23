import { listLessonTypes, listSlots, listWorkRules } from "@/lib/repo";
import { WorkRuleForm } from "@/components/WorkRuleForm";

export const dynamic = "force-dynamic";

export default function RulesPage() {
  const rules = listWorkRules();
  const slots = listSlots();
  const lessonTypes = listLessonTypes();

  // ルールは枠のラベル(業務シフト名 / レッスン種別名)を対象に判定する。
  const labels = Array.from(
    new Set([
      ...slots.filter((s) => s.slotType === "shift" && s.shiftLabel).map((s) => s.shiftLabel!),
      ...lessonTypes.map((lt) => lt.name),
    ]),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>労働ルール</h1>
          <p className="sub">
            テンプレートから選んで数値を設定します。ここでの設定は自動生成と手動調整時の警告の両方に使われます。
          </p>
        </div>
      </div>

      <div className="card">
        <h2>設定済みのルール</h2>
        {rules.length === 0 && <p className="muted small">ルールが未設定です。</p>}
        {rules.map((rule) => (
          <WorkRuleForm key={rule.id} rule={rule} labels={labels} />
        ))}
      </div>

      <div className="card">
        <h2>ルールを追加</h2>
        <WorkRuleForm labels={labels} />
      </div>
    </>
  );
}
