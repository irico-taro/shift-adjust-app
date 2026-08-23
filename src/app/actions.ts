"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as repo from "@/lib/repo";
import { generateDraft } from "@/lib/autoAssign";
import { dateRange } from "@/lib/time";
import type { AvailabilityStatus, Phase, SlotType, WorkRuleKind } from "@/lib/types";

const refresh = () => revalidatePath("/", "layout");

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string, fallback = 0) => {
  const v = Number(fd.get(key));
  return Number.isFinite(v) ? v : fallback;
};

// ---------- スタッフ ----------

export async function saveStaffAction(fd: FormData) {
  const id = str(fd, "id");
  const input = {
    name: str(fd, "name"),
    color: str(fd, "color") || "#64748b",
    weeklyHoursMin: num(fd, "weeklyHoursMin"),
    weeklyHoursMax: num(fd, "weeklyHoursMax", 40),
    qualifiedLessonTypeIds: fd.getAll("qualifiedLessonTypeIds").map(String),
  };
  if (!input.name) return;
  if (id) repo.updateStaff(id, input);
  else repo.createStaff(input);
  refresh();
}

export async function deleteStaffAction(fd: FormData) {
  repo.deleteStaff(str(fd, "id"));
  refresh();
}

// ---------- レッスン種別 ----------

export async function saveLessonTypeAction(fd: FormData) {
  const id = str(fd, "id");
  const input = { name: str(fd, "name"), color: str(fd, "color") || "#7c3aed" };
  if (!input.name) return;
  if (id) repo.updateLessonType(id, input);
  else repo.createLessonType(input);
  refresh();
}

export async function deleteLessonTypeAction(fd: FormData) {
  repo.deleteLessonType(str(fd, "id"));
  refresh();
}

// ---------- 曜日テンプレート ----------

export async function saveSlotAction(fd: FormData) {
  const id = str(fd, "id");
  const slotType = str(fd, "slotType") as SlotType;
  const input = {
    dayOfWeek: num(fd, "dayOfWeek"),
    startTime: str(fd, "startTime") || "09:00",
    endTime: str(fd, "endTime") || "10:00",
    slotType,
    lessonTypeId: str(fd, "lessonTypeId") || null,
    shiftLabel: str(fd, "shiftLabel") || null,
    requiredCount: Math.max(1, num(fd, "requiredCount", 1)),
  };
  if (slotType === "lesson" && !input.lessonTypeId) return;
  if (slotType === "shift" && !input.shiftLabel) return;
  if (id) repo.updateSlot(id, input);
  else repo.createSlot(input);
  refresh();
}

export async function deleteSlotAction(fd: FormData) {
  repo.deleteSlot(str(fd, "id"));
  refresh();
}

export async function copyDayTemplateAction(fd: FormData) {
  repo.copyDayTemplate(num(fd, "fromDay"), num(fd, "toDay"));
  refresh();
}

// ---------- 期間 ----------

export async function createPeriodAction(fd: FormData) {
  const startDate = str(fd, "startDate");
  const endDate = str(fd, "endDate");
  if (!startDate || !endDate || endDate < startDate) return;
  const name = str(fd, "name") || `${startDate} 〜 ${endDate}`;
  const id = repo.createPeriod({ name, startDate, endDate });
  refresh();
  redirect(`/periods/${id}`);
}

export async function setPhaseAction(fd: FormData) {
  repo.updatePeriodPhase(str(fd, "id"), str(fd, "phase") as Phase);
  refresh();
}

export async function deletePeriodAction(fd: FormData) {
  repo.deletePeriod(str(fd, "id"));
  refresh();
  redirect("/");
}

// ---------- 希望シフト ----------

export async function setAvailabilityAction(input: {
  staffId: string;
  periodId: string;
  date: string;
  status: AvailabilityStatus;
  availableFrom?: string | null;
  availableTo?: string | null;
}) {
  repo.setAvailability({
    staffId: input.staffId,
    periodId: input.periodId,
    date: input.date,
    status: input.status,
    availableFrom: input.availableFrom ?? "09:00",
    availableTo: input.availableTo ?? "17:00",
  });
  revalidatePath(`/periods/${input.periodId}`, "layout");
}

export async function clearAvailabilityAction(input: {
  staffId: string;
  periodId: string;
  date: string;
}) {
  repo.clearAvailability(input.staffId, input.periodId, input.date);
  revalidatePath(`/periods/${input.periodId}`, "layout");
}

export async function fillAvailabilityAction(fd: FormData) {
  const periodId = str(fd, "periodId");
  const staffId = str(fd, "staffId");
  const status = str(fd, "status") as AvailabilityStatus;
  const period = repo.getPeriod(periodId);
  if (!period || !staffId) return;
  repo.fillAvailability(staffId, periodId, dateRange(period.startDate, period.endDate), status);
  refresh();
}

// ---------- 割当 ----------

export async function toggleAssignmentAction(input: {
  periodId: string;
  date: string;
  slotId: string;
  staffId: string;
  assign: boolean;
}) {
  if (input.assign) {
    repo.addAssignment({
      periodId: input.periodId,
      date: input.date,
      slotId: input.slotId,
      staffId: input.staffId,
    });
  } else {
    repo.removeAssignmentAt(input.periodId, input.date, input.slotId, input.staffId);
  }
  revalidatePath(`/periods/${input.periodId}`, "layout");
}

export async function generateDraftAction(fd: FormData) {
  const periodId = str(fd, "periodId");
  const ctx = repo.loadScheduleContext(periodId);
  if (!ctx) return;
  const result = generateDraft(ctx, { resetDrafts: str(fd, "mode") !== "fill" });
  repo.replaceAssignments(periodId, result.assignments);
  refresh();
}

export async function clearAssignmentsAction(fd: FormData) {
  repo.clearAssignments(str(fd, "periodId"));
  refresh();
}

// ---------- 労働ルール ----------

export async function saveWorkRuleAction(fd: FormData) {
  const id = str(fd, "id");
  const kind = str(fd, "kind") as WorkRuleKind;
  const input = {
    kind,
    enabled: fd.get("enabled") != null,
    afterShiftLabel: str(fd, "afterShiftLabel") || null,
    forbiddenNextLabel: str(fd, "forbiddenNextLabel") || null,
    hours: fd.get("hours") ? num(fd, "hours") : null,
    days: fd.get("days") ? num(fd, "days") : null,
  };
  if (id) repo.updateWorkRule(id, input);
  else repo.createWorkRule(input);
  refresh();
}

export async function deleteWorkRuleAction(fd: FormData) {
  repo.deleteWorkRule(str(fd, "id"));
  refresh();
}
