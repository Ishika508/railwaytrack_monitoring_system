"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrainFront } from "lucide-react";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/hooks";

export default function Home() {
  const mounted = useMounted();
  const router = useRouter();
  const operator = useStore((s) => s.operator);
  const hwDone = useStore((s) => s.hardwareDone);
  useEffect(() => {
    if (!mounted) return;
    router.replace(!operator ? "/setup" : !hwDone ? "/connect" : "/journeys");
  }, [mounted, operator, hwDone, router]);
  return <div className="grid h-screen place-items-center"><div className="animate-floaty text-primary"><TrainFront className="h-10 w-10" /></div></div>;
}
