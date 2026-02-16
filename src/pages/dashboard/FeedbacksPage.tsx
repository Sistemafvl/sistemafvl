import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Star, Users, TrendingUp, Car } from "lucide-react";

interface DriverInfo {
  name: string;
  avatar_url: string | null;
  bio: string | null;
  car_model: string;
  car_color: string | null;
}

const FeedbacksPage = () => {
  const { unitSession } = useAuthStore();
  const unitId = unitSession?.id;

  const [reviews, setReviews] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<Map<string, DriverInfo>>(new Map());
  const [driverPerformance, setDriverPerformance] = useState<Map<string, { rides: number; tbrs: number }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!unitId) return;
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("unit_reviews")
        .select("*")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false });

      const revs = data ?? [];
      setReviews(revs);

      if (revs.length > 0) {
        const driverIds = [...new Set(revs.map((r: any) => r.driver_id))];
        const { data: driversData } = await supabase
          .from("drivers_public")
          .select("id, name, avatar_url, bio, car_model, car_color")
          .in("id", driverIds);

        setDrivers(
          new Map(
            (driversData ?? []).map((d) => [
              d.id,
              { name: d.name, avatar_url: d.avatar_url, bio: d.bio, car_model: d.car_model, car_color: d.car_color },
            ])
          )
        );

        // Fetch performance: rides count and tbrs count per driver
        const [ridesRes, tbrsRes] = await Promise.all([
          supabase
            .from("driver_rides")
            .select("driver_id")
            .in("driver_id", driverIds)
            .eq("unit_id", unitId),
          supabase
            .from("ride_tbrs")
            .select("ride_id")
            .in(
              "ride_id",
              (
                await supabase
                  .from("driver_rides")
                  .select("id")
                  .in("driver_id", driverIds)
                  .eq("unit_id", unitId)
              ).data?.map((r: any) => r.id) ?? []
            ),
        ]);

        // Count rides per driver
        const rideCountMap = new Map<string, number>();
        (ridesRes.data ?? []).forEach((r: any) => {
          rideCountMap.set(r.driver_id, (rideCountMap.get(r.driver_id) ?? 0) + 1);
        });

        // For TBRs we need ride->driver mapping
        const rideDriverMap = new Map<string, string>();
        const { data: rideDriverData } = await supabase
          .from("driver_rides")
          .select("id, driver_id")
          .in("driver_id", driverIds)
          .eq("unit_id", unitId);
        (rideDriverData ?? []).forEach((r: any) => rideDriverMap.set(r.id, r.driver_id));

        const tbrCountMap = new Map<string, number>();
        (tbrsRes.data ?? []).forEach((t: any) => {
          const dId = rideDriverMap.get(t.ride_id);
          if (dId) tbrCountMap.set(dId, (tbrCountMap.get(dId) ?? 0) + 1);
        });

        const perfMap = new Map<string, { rides: number; tbrs: number }>();
        driverIds.forEach((id) => {
          perfMap.set(id, { rides: rideCountMap.get(id) ?? 0, tbrs: tbrCountMap.get(id) ?? 0 });
        });
        setDriverPerformance(perfMap);
      }
      setLoading(false);
    };
    fetchData();
  }, [unitId]);

  const summary = useMemo(() => {
    if (reviews.length === 0) return null;
    const total = reviews.length;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / total;
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach((r: any) => dist[r.rating - 1]++);
    return { total, avg, dist };
  }, [reviews]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold italic flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        Feedbacks dos Motoristas
      </h1>

      {loading ? (
        <p className="text-center text-muted-foreground italic py-8">Carregando...</p>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="p-3 flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Média</p>
                    <p className="text-lg font-bold text-amber-500">{summary.avg.toFixed(1)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
                    <p className="text-lg font-bold text-primary">{summary.total}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Distribuição</p>
                  <div className="space-y-0.5">
                    {[5, 4, 3, 2, 1].map((s) => (
                      <div key={s} className="flex items-center gap-1 text-xs">
                        <span className="w-3 font-bold">{s}</span>
                        <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${summary.total > 0 ? (summary.dist[s - 1] / summary.total) * 100 : 0}%` }} />
                        </div>
                        <span className="w-4 text-right text-muted-foreground">{summary.dist[s - 1]}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Avaliações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-center text-muted-foreground italic py-8 text-sm">Nenhuma avaliação encontrada</p>
              ) : (
                reviews.map((rev: any) => {
                  const driver = drivers.get(rev.driver_id);
                  const perf = driverPerformance.get(rev.driver_id);
                  return (
                    <div key={rev.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          {driver?.avatar_url && <AvatarImage src={driver.avatar_url} />}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                            {(driver?.name ?? "M")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm truncate">{driver?.name ?? "Motorista"}</p>
                            <p className="text-xs text-muted-foreground shrink-0">
                              {new Date(rev.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div className="flex gap-0.5 mt-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i <= rev.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Driver details */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {driver?.car_model && (
                          <span className="flex items-center gap-1">
                            <Car className="h-3 w-3" />
                            {driver.car_model}{driver.car_color ? ` • ${driver.car_color}` : ""}
                          </span>
                        )}
                        {perf && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {perf.rides} corridas · {perf.tbrs} TBRs
                          </span>
                        )}
                      </div>

                      {driver?.bio && (
                        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">{driver.bio}</p>
                      )}

                      {rev.comment && <p className="text-xs text-muted-foreground italic">"{rev.comment}"</p>}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default FeedbacksPage;
