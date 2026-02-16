import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Star, Users, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";

const FeedbacksPage = () => {
  const { unitSession } = useAuthStore();
  const unitId = unitSession?.id;

  const [reviews, setReviews] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 90), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (!unitId) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("unit_reviews")
        .select("*")
        .eq("unit_id", unitId)
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: false });

      const revs = data ?? [];
      setReviews(revs);

      if (revs.length > 0) {
        const driverIds = [...new Set(revs.map((r: any) => r.driver_id))];
        const { data: driversData } = await supabase.from("drivers").select("id, name").in("id", driverIds);
        setDrivers(new Map((driversData ?? []).map((d) => [d.id, d.name])));
      }
      setLoading(false);
    };
    fetch();
  }, [unitId, startDate, endDate]);

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

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">De</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[150px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Até</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[150px]" />
            </div>
          </div>
        </CardContent>
      </Card>

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
                <p className="text-center text-muted-foreground italic py-8 text-sm">Nenhuma avaliação no período</p>
              ) : (
                reviews.map((rev: any) => (
                  <div key={rev.id} className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{drivers.get(rev.driver_id) ?? "Motorista"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(rev.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i <= rev.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    {rev.comment && <p className="text-xs text-muted-foreground italic">{rev.comment}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default FeedbacksPage;
