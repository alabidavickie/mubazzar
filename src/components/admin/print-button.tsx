"use client";

import { Icon } from "@/components/icons/icon";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark print:hidden"
    >
      <Icon name="print" /> Print
    </button>
  );
}
