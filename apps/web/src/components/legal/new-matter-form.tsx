"use client";

import { ArrowLeft, Briefcase, CircleNotch, Robot } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createMatterManual } from "@/app/(app)/legal/matters/new/actions";
import { LegalAgentChat } from "@/components/agent/legal-agent-chat";
import { MATTER_TYPE_LABEL } from "@/components/legal/matter-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function NewMatterForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("other");
  const [contractorName, setContractorName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    const res = await createMatterManual({ title: title.trim(), type, contractorName: contractorName.trim() });
    setSaving(false);
    if (res) router.push(`/legal/matters/${res.id}`);
    else setError("Ish yaratilmadi — qaytadan urinib ko'ring.");
  }

  return (
    <div className="w-full space-y-5">
      <div>
        <Link href="/legal/matters" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Ishlar
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Yangi ish</h1>
        <p className="mt-1 text-sm text-muted-foreground">Qo'lda yarating yoki AI'ga topshiring — u avtomatik ish ochib, tegishli ma'lumotni yig'adi.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase weight="fill" className="size-4 text-primary" /> Qo'lda yaratish
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label required>Sarlavha</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: ABC MCHJ bilan qarzdorlikni undirish" required />
              </div>
              <div className="space-y-1.5">
                <Label>Turi</Label>
                <Select value={type} onChange={(e) => setType(e.target.value)}>
                  {Object.entries(MATTER_TYPE_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kontragent (ixtiyoriy)</Label>
                <Input value={contractorName} onChange={(e) => setContractorName(e.target.value)} placeholder="Kontragent nomi" />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={saving || !title.trim()} className="w-full">
                {saving ? <CircleNotch className="animate-spin" /> : <Briefcase weight="fill" />}
                Ish yaratish
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Robot weight="fill" className="size-4 text-primary" /> AI'ga topshiring
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <LegalAgentChat />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
