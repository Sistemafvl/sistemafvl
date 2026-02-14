import { User } from "lucide-react";

const DriverProfile = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <User className="h-7 w-7 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Perfil</h1>
    </div>
    <p className="text-muted-foreground">
      Em breve você poderá fazer upload de foto de perfil e editar seus dados cadastrais.
    </p>
  </div>
);

export default DriverProfile;
