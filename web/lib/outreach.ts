import { inqPool } from "./inquiries";

export type OutreachTarget = {
  id: string; name: string; district: string; neighborhood: string | null;
  address: string | null; phone: string | null; website: string | null;
  evidenceUrl: string; evidenceNote: string | null; priority: number;
  ownerConsults: boolean | null; monthlyInquiries5plus: boolean | null;
  singleLocation: boolean | null; status: string; nextAction: string;
  nextDue: string | null; note: string; contactedAt: string | null;
};

export const OUTREACH_STATUSES = ["확인 전", "통화 예정", "조건 충족", "제안 발송", "결제", "제외"] as const;

export async function listOutreach(): Promise<OutreachTarget[]> {
  try {
    const { rows } = await inqPool().query(`
      select id, name, district, neighborhood, address, phone, website,
             evidence_url, evidence_note, priority, owner_consults,
             monthly_inquiries_5plus, single_location, status, next_action,
             next_due::text, note, contacted_at::text
        from geo.outreach_targets
       order by case status when '결제' then 1 when '제안 발송' then 2
                            when '조건 충족' then 3 when '통화 예정' then 4
                            when '확인 전' then 5 else 6 end,
                priority, name`);
    return rows.map((r) => ({
      id: r.id, name: r.name, district: r.district, neighborhood: r.neighborhood,
      address: r.address, phone: r.phone, website: r.website,
      evidenceUrl: r.evidence_url, evidenceNote: r.evidence_note, priority: r.priority,
      ownerConsults: r.owner_consults, monthlyInquiries5plus: r.monthly_inquiries_5plus,
      singleLocation: r.single_location, status: r.status, nextAction: r.next_action,
      nextDue: r.next_due, note: r.note, contactedAt: r.contacted_at,
    }));
  } catch { return []; }
}
