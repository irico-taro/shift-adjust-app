"use client";

export function PrintButton({ label = "印刷 / PDF保存" }: { label?: string }) {
  return (
    <button className="btn btn-primary no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
