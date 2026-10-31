"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Building2, Clock, Mail, Phone, ShieldCheck, User, UserCog } from "lucide-react";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/hooks";
import type { Operator } from "@/lib/types";
import { AuthHero, AuthTop } from "@/components/AuthHero";
import { Stepper } from "@/components/Stepper";

const ROLES = ["Track Inspector", "Loco Pilot", "Maintenance Engineer", "Control Room Operator", "Section Engineer"];
const SHIFTS = ["Morning (06-14)", "Evening (14-22)", "Night (22-06)"];

export default function Setup() {
  const mounted = useMounted();
  const router = useRouter();
  const saved = useStore((s) => s.operator);
  const setOperator = useStore((s) => s.setOperator);
  const [f, setF] = useState<Operator>({ name: "", empId: "", role: ROLES[0], division: "", shift: SHIFTS[0], phone: "", email: "" });
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (saved) setF(saved); }, [saved]);
  if (!mounted) return null;

  const set = (k: keyof Operator, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = "Enter the operator's full name";
    if (!f.empId.trim()) er.empId = "Employee ID is required";
    if (!f.division.trim()) er.division = "Division / zone is required";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Enter a valid email";
    if (!ack) er.ack = "Please confirm the safety acknowledgement";
    setErr(er);
    if (Object.keys(er).length) return;
    setOperator({ ...f, name: f.name.trim() });
    router.push("/connect");
  };

  const Field = ({ k, label, icon: Icon, ph, type = "text" }: { k: keyof Operator; label: string; icon: React.ElementType; ph: string; type?: string }) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input id={k} type={type} className="input pl-10" placeholder={ph} value={f[k]} onChange={(e) => set(k, e.target.value)} />
      </div>
      {err[k] && <p className="mt-1.5 text-xs font-medium text-bad">{err[k]}</p>}
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <AuthHero />
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <AuthTop />
        <div className="m-auto w-full max-w-lg animate-fade-up">
          <Stepper step={1} />
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight">Operator information</h1>
          <p className="mt-2 text-sm text-muted">Tell us who is operating this inspection session. Details are stored on this device and attached to every report.</p>
          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              {Field({ k: "name", label: "Full name", ph: "e.g. Anita Deshmukh", icon: User })}
              {Field({ k: "empId", label: "Employee ID", ph: "EMP-20417", icon: BadgeCheck })}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="role">Role</label>
                <div className="relative"><UserCog className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <select id="role" className="input pl-10" value={f.role} onChange={(e) => set("role", e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
              </div>
              <div>
                <label className="label" htmlFor="shift">Shift</label>
                <div className="relative"><Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <select id="shift" className="input pl-10" value={f.shift} onChange={(e) => set("shift", e.target.value)}>{SHIFTS.map((r) => <option key={r}>{r}</option>)}</select></div>
              </div>
            </div>
            {Field({ k: "division", label: "Division / zone", ph: "Nagpur Division, Central Railway", icon: Building2 })}
            <div className="grid gap-5 sm:grid-cols-2">
              {Field({ k: "phone", label: "Phone (optional)", ph: "+91 98765 43210", type: "tel", icon: Phone })}
              {Field({ k: "email", label: "Email (optional)", ph: "name@railways.in", type: "email", icon: Mail })}
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface2/60 p-4">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]" />
              <span className="text-sm text-muted"><span className="flex items-center gap-1.5 font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-ok" />Safety acknowledgement</span>
                I confirm that automated alerts assist, and do not replace, standard track inspection and safety procedures.</span>
            </label>
            {err.ack && <p className="-mt-3 text-xs font-medium text-bad">{err.ack}</p>}
            <button className="btn-primary w-full py-3.5 text-[15px]" type="submit">Continue to hardware<ArrowRight className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
