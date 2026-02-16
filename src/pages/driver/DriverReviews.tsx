import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, MapPin, Send, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface UnitWithReview {
  unit_id: string;
  unit_name: string;
  rideCount: number;
  review?: { id: string; rating: number; comment: string | null };
}

const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((i) => (
      <button key={i} type="button" onClick={() => onChange(i)} className="focus:outline-none">
        <Star className={`h-7 w-7 transition-colors ${i <= value ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
      </button>
    ))}
  </div>
);

const DriverReviews = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.user_profile_id;

  const [unitsWithReviews, setUnitsWithReviews] = useState<UnitWithReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<UnitWithReview | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!driverId) return;
    setLoading(true);

    const { data: rides } = await supabase
      .from("driver_rides")
      .select("unit_id")
      .eq("driver_id", driverId);

    if (!rides || rides.length === 0) {
      setUnitsWithReviews([]);
      setLoading(false);
      return;
    }

    const unitCount = new Map<string, number>();
    rides.forEach((r) => unitCount.set(r.unit_id, (unitCount.get(r.unit_id) ?? 0) + 1));
    const unitIds = [...unitCount.keys()];

    const [unitsRes, reviewsRes] = await Promise.all([
      supabase.from("units").select("id, name").in("id", unitIds),
      supabase.from("unit_reviews").select("*").eq("driver_id", driverId).in("unit_id", unitIds),
    ]);

    const unitMap = new Map((unitsRes.data ?? []).map((u) => [u.id, u.name]));
    const reviewMap = new Map((reviewsRes.data ?? []).map((r: any) => [r.unit_id, { id: r.id, rating: r.rating, comment: r.comment }]));

    const result: UnitWithReview[] = unitIds.map((uid) => ({
      unit_id: uid,
      unit_name: unitMap.get(uid) ?? "—",
      rideCount: unitCount.get(uid) ?? 0,
      review: reviewMap.get(uid),
    }));

    result.sort((a, b) => b.rideCount - a.rideCount);
    setUnitsWithReviews(result);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [driverId]);

  const openModal = (unit: UnitWithReview) => {
    setSelected(unit);
    setRating(unit.review?.rating ?? 0);
    setComment(unit.review?.comment ?? "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selected || !driverId || rating === 0) return;
    setSaving(true);

    if (selected.review) {
      await supabase.from("unit_reviews").update({ rating, comment: comment || null }).eq("id", selected.review.id);
    } else {
      await supabase.from("unit_reviews").insert({ driver_id: driverId, unit_id: selected.unit_id, rating, comment: comment || null });
    }

    setSaving(false);
    setModalOpen(false);
    toast.success("Avaliação salva!");
    fetchData();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold italic flex items-center gap-2">
        <Star className="h-5 w-5 text-primary" />
        Avaliar Unidades
      </h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Unidades disponíveis: <span className="text-primary font-bold">{unitsWithReviews.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-center text-muted-foreground italic py-8 text-sm">Carregando...</p>
          ) : unitsWithReviews.length === 0 ? (
            <p className="text-center text-muted-foreground italic py-8 text-sm">
              Nenhuma corrida realizada ainda
            </p>
          ) : (
            unitsWithReviews.map((unit) => (
              <div key={unit.unit_id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    {unit.unit_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {unit.rideCount} corrida{unit.rideCount > 1 ? "s" : ""}
                  </p>
                  {unit.review && (
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={`h-3 w-3 ${i <= unit.review!.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={unit.review ? "outline" : "default"}
                  className="shrink-0 gap-1"
                  onClick={() => openModal(unit)}
                >
                  {unit.review ? <><Edit2 className="h-3 w-3" /> Editar</> : <><Star className="h-3 w-3" /> Avaliar</>}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <Star className="h-5 w-5 text-primary" /> Avaliar {selected?.unit_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <StarRating value={rating} onChange={setRating} />
            </div>
            <Textarea
              placeholder="Deixe um comentário (opcional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <Button className="w-full gap-2" onClick={handleSubmit} disabled={saving || rating === 0}>
              <Send className="h-4 w-4" />
              {saving ? "Salvando..." : "Enviar Avaliação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverReviews;
