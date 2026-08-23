"use client";

import { useMemo } from "react";
import { slotLabel, violationsIfAssigned } from "@/lib/rules";
import { AVAILABILITY_LABEL } from "@/lib/labels";
import { formatDateJa } from "@/lib/time";
import type { ScheduleContext } from "@/lib/types";

export function StaffPicker({
  ctx,
  date,
  slotId,
  onPick,
  onClose,
}: {
  ctx: ScheduleContext;
  date: string;
  slotId: string;
  onPick: (staffId: string) => void;
  onClose: () => void;
}) {
  const slot = ctx.slots.find((s) => s.id === slotId);

  const candidates = useMemo(() => {
    const assignedHere = new Set(
      ctx.assignments.filter((a) => a.date === date && a.slotId === slotId).map((a) => a.staffId),
    );
    return ctx.staff
      .filter((s) => !assignedHere.has(s.id))
      .map((staff) => {
        const violations = violationsIfAssigned(ctx, date, slotId, staff.id);
        const errors = violations.filter((v) => v.severity === "error");
        const warnings = violations.filter((v) => v.severity === "warning");
        const availability = ctx.availabilities.find((a) => a.staffId === staff.id && a.date === date);
        return { staff, errors, warnings, availability };
      })
      .sort((a, b) => {
        if (a.errors.length !== b.errors.length) return a.errors.length - b.errors.length;
        if (a.warnings.length !== b.warnings.length) return a.warnings.length - b.warnings.length;
        return a.staff.sortOrder - b.staff.sortOrder;
      });
  }, [ctx, date, slotId]);

  if (!slot) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong>{slotLabel(slot, ctx.lessonTypes)}</strong>
            <div className="muted small">
              {formatDateJa(date)} {slot.startTime}〜{slot.endTime} / 必要 {slot.requiredCount} 人
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="modal-body">
          {candidates.length === 0 && <div className="empty">割当できるスタッフがいません。</div>}
          {candidates.map(({ staff, errors, warnings, availability }) => (
            <button
              key={staff.id}
              className={`candidate${errors.length > 0 ? " blocked" : ""}`}
              onClick={() => onPick(staff.id)}
            >
              <span className="dot" style={{ background: staff.color }} />
              <span style={{ minWidth: 96 }}>
                <strong>{staff.name}</strong>
              </span>
              <span className={`badge badge-${availability?.status === "ng" ? "error" : availability?.status === "conditional" ? "warning" : availability ? "muted" : "muted"}`}>
                {availability ? AVAILABILITY_LABEL[availability.status] : "希望未提出"}
              </span>
              <span className="stack" style={{ gap: 2, flex: 1 }}>
                {errors.map((v, i) => (
                  <span key={`e${i}`} className="why">
                    ✕ {v.message}
                  </span>
                ))}
                {warnings.map((v, i) => (
                  <span key={`w${i}`} className="why-warn">
                    △ {v.message}
                  </span>
                ))}
                {errors.length === 0 && warnings.length === 0 && (
                  <span className="small" style={{ color: "var(--ok)" }}>
                    ✓ 問題なし
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
