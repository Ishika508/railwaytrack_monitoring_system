import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Operator", "Hardware", "Launch"];
  return (
    <div className="flex items-center gap-3">
      {items.map((l, i) => {
        const n = i + 1, done = n < step, on = n === step;
        return (
          <div key={l} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={cn("grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition", done ? "bg-ok text-white" : on ? "bg-primary text-white dark:text-[#0b1020]" : "bg-surface2 text-muted")}>{done ? <Check className="h-4 w-4" /> : n}</span>
              <span className={cn("text-sm font-semibold", on ? "text-ink" : "text-muted")}>{l}</span>
            </div>
            {i < 2 && <span className="h-px w-8 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
