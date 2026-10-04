import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Staff from "@/lib/models/Staff";
import SalaryEntry from "@/lib/models/SalaryEntry";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/salary?date=YYYY-MM-DD
 * Each permanent-staff row carries:
 *   salary  = primary/fixed salary for the day (staff.salary, or saved snapshot)
 *   paid    = amount paid that day (defaults to the primary salary)
 *   present = attendance (defaults to the most recent prior day)
 * Pending for a day is derived on the client as salary - paid (when present).
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

    const lastPresent = new Map<string, boolean>();
    for (const e of priorEntries) lastPresent.set(String(e.staff), e.present);

    const todayByStaff = new Map<string, any>();
    const partTime: any[] = [];
    for (const e of todayEntries) {
      if (e.isPartTime) partTime.push(e);
      else if (e.staff) todayByStaff.set(String(e.staff), e);
      // manual pending entries live only in the Pending view
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
          paid: t.paid,
          present: t.present,
        };
      }
      const present = lastPresent.has(sid) ? lastPresent.get(sid) : true;
      return {
        staffId: sid,
        name: s.name,
        section: s.section,
        salary: s.salary,
        paid: s.salary, // default: pay the full primary salary
        present,
      };
    });

    const partTimeRows = partTime.map((e: any) => ({
      id: String(e._id),
      name: e.name,
      section: e.section,
      salary: e.salary,
      paid: e.paid,
      present: e.present,
    }));

    return NextResponse.json({ date, rows, partTime: partTimeRows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/salary
 * Saves the day AND any staff name/section/primary-salary edits.
 * Body: { date, rows: [{staffId, name, section, salary, paid, present}], partTime: [...] }
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

    const staffOps: any[] = [];
    const entryOps: any[] = [];

    for (const r of rows) {
      if (!r.staffId) continue;
      const name = (r.name ?? "").trim();
      const section = (r.section ?? "").trim();
      const salary = Math.max(0, Number(r.salary) || 0);
      const present = Boolean(r.present);
      const paid = present ? Math.max(0, Number(r.paid) || 0) : 0;

      // Persist staff edits (name / section / primary salary).
      staffOps.push({
        updateOne: {
          filter: { _id: r.staffId },
          update: { $set: { name, section, salary } },
        },
      });

      // Save the day's entry (snapshot salary + paid).
      entryOps.push({
        updateOne: {
          filter: { staff: r.staffId, date },
          update: {
            $set: {
              staff: r.staffId,
              date,
              name,
              section,
              salary,
              paid,
              present,
              isPartTime: false,
            },
          },
          upsert: true,
        },
      });
    }

    if (staffOps.length > 0) await Staff.bulkWrite(staffOps);
    if (entryOps.length > 0) await SalaryEntry.bulkWrite(entryOps);

    // Part-time: replace the day's set.
    await SalaryEntry.deleteMany({ date, isPartTime: true });
    const ptDocs = partTime
      .filter((p: any) => (p.name ?? "").trim())
      .map((p: any) => {
        const present = p.present === undefined ? true : Boolean(p.present);
        const salary = Math.max(0, Number(p.salary) || 0);
        return {
          staff: null,
          date,
          name: (p.name ?? "").trim(),
          section: (p.section ?? "").trim(),
          salary,
          paid: present ? Math.max(0, Number(p.paid ?? salary) || 0) : 0,
          present,
          isPartTime: true,
          manual: false,
        };
      });
    if (ptDocs.length > 0) await SalaryEntry.insertMany(ptDocs);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
