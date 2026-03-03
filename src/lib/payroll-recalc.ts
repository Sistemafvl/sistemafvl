import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabase-helpers";
import { OPERATIONAL_PISO_REASONS } from "@/lib/status-labels";
import { format } from "date-fns";

/**
 * Recalculates a saved payroll report's data using the corrected logic
 * (filtering operational piso, case-insensitive comparison, instance-based TBR count).
 * Updates the report_data in payroll_reports without changing the report ID or linked invoices.
 */
export async function recalcPayrollReport(reportId: string): Promise<{ success: boolean; error?: string }> {
  // 1. Load the existing report
  const { data: report, error: reportErr } = await supabase
    .from("payroll_reports" as any)
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (reportErr || !report) return { success: false, error: "Relatório não encontrado." };

  const rep = report as any;
  const unitId = rep.unit_id;
  const startDate = new Date(rep.period_start + "T00:00:00");
  const endDate = new Date(rep.period_end + "T23:59:59.999");

  // 2. Fetch all rides in the period
  const { data: rides } = await supabase.from("driver_rides").select("*").eq("unit_id", unitId)
    .gte("completed_at", startDate.toISOString()).lte("completed_at", endDate.toISOString());
  if (!rides?.length) return { success: false, error: "Nenhum carregamento no período." };

  const rideIds = rides.map(r => r.id);
  const driverIds = [...new Set(rides.map(r => r.driver_id))];

  // 3. Fetch TBRs, piso (with reason), PS, RTO
  const [tbrsData, allPisoRaw, allPs, allRto] = await Promise.all([
    fetchAllRows<{ ride_id: string; code: string }>((from, to) =>
      supabase.from("ride_tbrs").select("ride_id, code").in("ride_id", rideIds).range(from, to)),
    fetchAllRows<{ ride_id: string; tbr_code: string; reason: string | null }>((from, to) =>
      supabase.from("piso_entries").select("ride_id, tbr_code, reason").in("ride_id", rideIds).range(from, to)),
    fetchAllRows<{ ride_id: string; tbr_code: string }>((from, to) =>
      supabase.from("ps_entries").select("ride_id, tbr_code").in("ride_id", rideIds).range(from, to)),
    fetchAllRows<{ ride_id: string; tbr_code: string }>((from, to) =>
      supabase.from("rto_entries").select("ride_id, tbr_code").in("ride_id", rideIds).range(from, to)),
  ]);

  // Filter out operational piso reasons
  const allPiso = allPisoRaw.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));

  // 4. Fetch settings
  const { data: settings } = await supabase.from("unit_settings").select("tbr_value").eq("unit_id", unitId).maybeSingle();
  const defaultTbrVal = Number(settings?.tbr_value ?? 0);

  const { data: customValuesRes } = await supabase.from("driver_custom_values").select("driver_id, custom_tbr_value").eq("unit_id", unitId);
  const customValueMap = new Map<string, number>();
  (customValuesRes ?? []).forEach((cv: any) => customValueMap.set(cv.driver_id, Number(cv.custom_tbr_value)));

  const { data: minPkgRes } = await supabase.from("driver_minimum_packages" as any).select("driver_id, min_packages").eq("unit_id", unitId);
  const minPkgMap = new Map<string, number>();
  ((minPkgRes as any[]) ?? []).forEach((mp: any) => minPkgMap.set(mp.driver_id, Number(mp.min_packages)));

  const { data: bonusRes } = await supabase.from("driver_bonus").select("driver_id, amount")
    .eq("unit_id", unitId)
    .gte("period_start", format(startDate, "yyyy-MM-dd"))
    .lte("period_start", format(endDate, "yyyy-MM-dd"));
  const bonusByDriver = new Map<string, number>();
  (bonusRes ?? []).forEach((b: any) => bonusByDriver.set(b.driver_id, (bonusByDriver.get(b.driver_id) ?? 0) + Number(b.amount)));

  const { data: dnrData } = await supabase.from("dnr_entries").select("driver_id, dnr_value")
    .eq("unit_id", unitId).eq("status", "closed").eq("discounted", true)
    .or(`reported_in_payroll_id.eq.${reportId},reported_in_payroll_id.is.null`)
    .gte("closed_at", startDate.toISOString()).lte("closed_at", endDate.toISOString());
  const dnrByDriver = new Map<string, number>();
  (dnrData ?? []).forEach((d: any) => {
    if (d.driver_id) dnrByDriver.set(d.driver_id, (dnrByDriver.get(d.driver_id) ?? 0) + Number(d.dnr_value));
  });

  // 5. Get existing report_data to preserve driver info (pix, etc.)
  const oldData = rep.report_data as any[];
  const oldDriverMap = new Map<string, any>();
  oldData.forEach((d: any) => { if (d.driver?.id) oldDriverMap.set(d.driver.id, d); });

  // 6. Recalculate per driver
  const newData = driverIds.map(driverId => {
    const old = oldDriverMap.get(driverId);
    const driverRides = rides.filter(r => r.driver_id === driverId);
    const tbrVal = customValueMap.get(driverId) ?? defaultTbrVal;

    const dayMap = new Map<string, { login: string | null; rideIds: string[] }>();
    driverRides.forEach(r => {
      const dayKey = format(new Date(r.completed_at), "yyyy-MM-dd");
      const existing = dayMap.get(dayKey);
      if (existing) { existing.rideIds.push(r.id); if (r.login && !existing.login) existing.login = r.login; }
      else dayMap.set(dayKey, { login: r.login, rideIds: [r.id] });
    });

    const days = Array.from(dayMap.entries()).sort().map(([date, info]) => {
      const rTbrs = tbrsData.filter(t => info.rideIds.includes(t.ride_id));

      const returnCodesForDay = new Set<string>();
      [...allPiso, ...allPs, ...allRto].forEach((p: any) => {
        if (p.ride_id && info.rideIds.includes(p.ride_id) && p.tbr_code) {
          returnCodesForDay.add(p.tbr_code.toUpperCase());
        }
      });

      const sortedDayRides = driverRides
        .filter(r => info.rideIds.includes(r.id))
        .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());

      const netReturns = new Set<string>();
      returnCodesForDay.forEach(codeUpper => {
        let lastRideId: string | null = null;
        for (const ride of sortedDayRides) {
          if (rTbrs.some(t => t.ride_id === ride.id && t.code.toUpperCase() === codeUpper)) {
            lastRideId = ride.id;
          }
        }
        if (lastRideId) {
          const hasReturnInLast = [...allPiso, ...allPs, ...allRto].some(
            (p: any) => p.ride_id === lastRideId && p.tbr_code.toUpperCase() === codeUpper
          );
          if (hasReturnInLast) netReturns.add(codeUpper);
        }
      });

      let tbrCount = rTbrs.length;
      const returns = netReturns.size;
      const minPkg = minPkgMap.get(driverId) ?? 0;
      if (minPkg > 0 && tbrCount < minPkg) tbrCount = minPkg;
      const completed = tbrCount - returns;
      return { date, login: info.login, tbrCount, returns, completed, value: completed * tbrVal };
    });

    const totalTbrs = days.reduce((s, d) => s + d.tbrCount, 0);
    const totalReturns = days.reduce((s, d) => s + d.returns, 0);
    const totalCompleted = totalTbrs - totalReturns;
    const dnrDiscount = dnrByDriver.get(driverId) ?? 0;
    const bonusAmount = bonusByDriver.get(driverId) ?? 0;
    const loginsUsed = [...new Set(driverRides.map(r => r.login).filter(Boolean) as string[])];
    const bestDay = days.length ? days.reduce((a, b) => a.tbrCount > b.tbrCount ? a : b) : null;
    const worstDay = days.length ? days.reduce((a, b) => a.tbrCount < b.tbrCount ? a : b) : null;

    return {
      driver: old?.driver ?? { id: driverId, name: "—", cpf: "", car_plate: "", car_model: "", car_color: null, pixKey: null },
      days, totalTbrs, totalReturns, totalCompleted,
      tbrValueUsed: tbrVal, bonus: bonusAmount,
      totalValue: (totalCompleted * tbrVal) - dnrDiscount + bonusAmount,
      dnrDiscount, daysWorked: days.length, loginsUsed,
      bestDay: bestDay ? { date: bestDay.date, tbrs: bestDay.tbrCount } : null,
      worstDay: worstDay ? { date: worstDay.date, tbrs: worstDay.tbrCount } : null,
      avgDaily: days.length ? Math.round(totalTbrs / days.length) : 0,
    };
  }).sort((a, b) => b.totalTbrs - a.totalTbrs);

  // 7. Update the report
  const { error: updateErr } = await supabase
    .from("payroll_reports" as any)
    .update({ report_data: newData } as any)
    .eq("id", reportId);

  if (updateErr) return { success: false, error: updateErr.message };
  return { success: true };
}

/**
 * Recalculates ALL payroll reports for a unit.
 */
export async function recalcAllPayrollReports(unitId: string): Promise<{ total: number; fixed: number; errors: string[] }> {
  const { data: reports } = await supabase
    .from("payroll_reports" as any)
    .select("id")
    .eq("unit_id", unitId);

  const all = (reports as any[]) ?? [];
  let fixed = 0;
  const errors: string[] = [];

  for (const r of all) {
    const result = await recalcPayrollReport(r.id);
    if (result.success) fixed++;
    else if (result.error) errors.push(`${r.id}: ${result.error}`);
  }

  return { total: all.length, fixed, errors };
}
