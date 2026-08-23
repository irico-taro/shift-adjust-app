import { NextRequest } from "next/server";
import { loadScheduleContext } from "@/lib/repo";
import { buildLanes } from "@/lib/lanes";
import { evaluateSchedule, slotLabel } from "@/lib/rules";
import {
  DAY_NAMES_JA,
  dateRange,
  dayOfWeek,
  hoursFromMinutes,
  parseDate,
  slotDurationMinutes,
} from "@/lib/time";

export const dynamic = "force-dynamic";

type ExportType = "matrix" | "staff" | "detail";

const TITLES: Record<ExportType, string> = {
  matrix: "シフト表",
  staff: "スタッフ別",
  detail: "明細",
};

/** Excel がそのまま開けるよう、値は常に引用符で囲み、改行コードは CRLF にする。 */
function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

const shortDate = (date: string) =>
  `${parseDate(date).getUTCMonth() + 1}/${parseDate(date).getUTCDate()}(${DAY_NAMES_JA[dayOfWeek(date)]})`;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = loadScheduleContext(id);
  if (!ctx) return new Response("Not found", { status: 404 });

  const requested = request.nextUrl.searchParams.get("type");
  const type: ExportType =
    requested === "staff" || requested === "detail" ? requested : "matrix";

  const dates = dateRange(ctx.period.startDate, ctx.period.endDate);
  const staffById = new Map(ctx.staff.map((s) => [s.id, s]));
  const slotById = new Map(ctx.slots.map((s) => [s.id, s]));
  const rows: (string | number)[][] = [];

  if (type === "matrix") {
    // 日付 × 枠。店長が Excel 上で手直しする用途を想定。
    const lanes = buildLanes(ctx);
    rows.push([
      "日付",
      "曜日",
      ...lanes.map((l) => `${l.label} ${l.startTime}-${l.endTime}`),
    ]);
    for (const date of dates) {
      const dow = dayOfWeek(date);
      rows.push([
        date,
        DAY_NAMES_JA[dow],
        ...lanes.map((lane) => {
          const slot = lane.byDay.get(dow);
          if (!slot) return "-";
          return ctx.assignments
            .filter((a) => a.date === date && a.slotId === slot.id)
            .map((a) => staffById.get(a.staffId)?.name ?? "")
            .join(" / ");
        }),
      ]);
    }
  } else if (type === "staff") {
    // スタッフ × 日付。各自の勤務を横一列で確認する用途。
    const evaluation = evaluateSchedule(ctx);
    rows.push(["スタッフ", ...dates.map(shortDate), "コマ数", "合計時間"]);
    for (const staff of ctx.staff) {
      const load = evaluation.staffLoads[staff.id];
      rows.push([
        staff.name,
        ...dates.map((date) =>
          ctx.assignments
            .filter((a) => a.staffId === staff.id && a.date === date)
            .map((a) => {
              const slot = slotById.get(a.slotId);
              return slot ? `${slot.startTime} ${slotLabel(slot, ctx.lessonTypes)}` : "";
            })
            .sort()
            .join(" / "),
        ),
        load?.assignmentCount ?? 0,
        hoursFromMinutes(load?.totalMinutes ?? 0),
      ]);
    }
  } else {
    // 1行1割当。給与計算や集計に取り込む用途。
    rows.push(["日付", "曜日", "区分", "枠", "開始", "終了", "時間", "スタッフ", "状態"]);
    const sorted = [...ctx.assignments].sort(
      (a, b) => a.date.localeCompare(b.date) || a.slotId.localeCompare(b.slotId),
    );
    for (const a of sorted) {
      const slot = slotById.get(a.slotId);
      if (!slot) continue;
      rows.push([
        a.date,
        DAY_NAMES_JA[dayOfWeek(a.date)],
        slot.slotType === "lesson" ? "レッスン" : "業務",
        slotLabel(slot, ctx.lessonTypes),
        slot.startTime,
        slot.endTime,
        hoursFromMinutes(slotDurationMinutes(slot.startTime, slot.endTime)),
        staffById.get(a.staffId)?.name ?? "",
        a.status === "confirmed" ? "確定" : "仮",
      ]);
    }
  }

  // BOM を付けないと Excel が UTF-8 と判定せず日本語が文字化けする。
  const body = `﻿${toCsv(rows)}`;
  const filename = `${ctx.period.name}_${TITLES[type]}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
