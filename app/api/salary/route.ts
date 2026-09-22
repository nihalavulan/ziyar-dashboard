import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Staff from "@/lib/models/Staff";
import SalaryEntry from "@/lib/models/SalaryEntry";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/salary?date=YYYY-MM-DD
 * Permanent staff rows (attendance defaults to their most recent prior day)
 * plus any part-time entries added for that day.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? "";
    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid ?date=YYYY-MM-DD is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const staff = await Staff.find().sort({ order: 1, name: 1 }).lean();
    const todayEntries = await SalaryEntry.find({ date }).lean();
    const priorEntries = await SalaryEntry.find({
      date: { $lt: date },
      staff: { $ne: null },
    })
      .sort({ date: 1 })
      .lean();

    // Latest prior attendance + salary per staff (later dates overwrite earlier).
    const lastPresent = new Map<string, boolean>();
    const lastSalary = new Map<string, number>();
    for (const e of priorEntries) {
      lastPresent.set(String(e.staff), e.present);
      lastSalary.set(String(e.staff), e.salary ?? 0);
    }

    const todayByStaff = new Map<string, any>();
    const partTime: any[] = [];
    for (const e of todayEntries) {
      if (e.isPartTime) partTime.push(e);
      else if (e.staff) todayByStaff.set(String(e.staff), e);
      // manual pending entries (staff null, not part-time) live only in Pending
    }

    const rows = staff.map((s: any) => {
      const sid = String(s._id);
      const t = todayByStaff.get(sid);
      if (t) {
        return {
          staffId: sid,
          name: s.name,
          section: s.section,
          salary: t.salary,
          present: t.present,
          pending: t.pending,
        };
      }
      return {
        staffId: sid,
        name: s.name,
        section: s.section,
        salary: lastSalary.has(sid) ? lastSalary.get(sid) : s.salary,
        present: lastPresent.has(sid) ? lastPresent.get(sid) : true,
        pending: false,
      };
    });

    const partTimeRows = partTime.map((e: any) => ({
      id: String(e._id),
      name: e.name,
      section: e.section,
      salary: e.salary,
      present: e.present,
      pending: e.pending,
    }));

    return NextResponse.json({ date, rows, partTime: partTimeRows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/salary
 * Body: { date, rows: [{staffId, present, pending}], partTime: [{name, section, salary, present, pending}] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const date = body.date ?? "";
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const partTime = Array.isArray(body.partTime) ? body.partTime : [];

    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid date (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const staff = await Staff.find().lean();
    const staffMap = new Map(staff.map((s: any) => [String(s._id), s]));

    // Permanent staff: upsert one entry per staff for the day (snapshot salary).
    const ops = rows
      .filter((r: any) => staffMap.has(String(r.staffId)))
      .map((r: any) => {
        const s: any = staffMap.get(String(r.staffId));
        const present = Boolean(r.present);
        return {
          updateOne: {
            filter: { staff: r.staffId, date },
            update: {
              $set: {
                staff: r.staffId,
                date,
                name: s.name,
                section: s.section,
                salary: Math.max(0, Number(r.salary ?? s.salary) || 0),
                present,
                pending: present ? Boolean(r.pending) : false,
                isPartTime: false,
              },
            },
            upsert: true,
          },
        };
      });
    if (ops.length > 0) await SalaryEntry.bulkWrite(ops);

    // Part-time: replace the day's part-time set with what was submitted.
    await SalaryEntry.deleteMany({ date, isPartTime: true });
    const ptDocs = partTime
      .filter((p: any) => (p.name ?? "").trim())
      .map((p: any) => ({
        staff: null,
        date,
        name: (p.name ?? "").trim(),
        section: (p.section ?? "").trim(),
        salary: Math.max(0, Number(p.salary) || 0),
        present: p.present === undefined ? true : Boolean(p.present),
        pending: Boolean(p.pending),
        isPartTime: true,
      }));
    if (ptDocs.length > 0) await SalaryEntry.insertMany(ptDocs);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
