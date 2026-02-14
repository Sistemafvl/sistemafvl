import { Star } from "lucide-react";

const DriverReviews = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Star className="h-7 w-7 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Avaliar Unidades</h1>
    </div>
    <p className="text-muted-foreground">
      Em breve você poderá avaliar as unidades onde trabalhou.
    </p>
  </div>
);

export default DriverReviews;
