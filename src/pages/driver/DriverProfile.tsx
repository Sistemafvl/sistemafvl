import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  User, Camera, Loader2, Save, KeyRound, Eye, EyeOff,
  Mail, Phone, MapPin, Car, Palette, FileText, CalendarDays, ShieldAlert,

} from "lucide-react";

const capitalize = (v: string) =>
  v.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const DriverProfile = () => {
  const { unitSession } = useAuthStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const driverId = unitSession?.user_profile_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: "", cpf: "", email: "", whatsapp: "", bio: "",
    car_plate: "", car_model: "", car_color: "",
    address: "", neighborhood: "", city: "", state: "", cep: "",
    avatar_url: "",
    emergency_contact_1: "", emergency_contact_2: "", birth_date: "",
  });

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const loadDriverProfile = async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      // 1. Try direct fetch from drivers table (primary)
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name, cpf, email, whatsapp, bio, car_plate, car_model, car_color, address, neighborhood, city, state, cep, avatar_url, emergency_contact_1, emergency_contact_2, birth_date")
        .eq("id", driverId)
        .maybeSingle();
      
      let profileData = data;

      // 2. Fallback to Edge Function if direct fetch is missing data (e.g. name or CPF)
      if (!profileData || !profileData.name || !profileData.cpf) {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke("get-driver-details", {
          body: { driver_id: driverId, self_access: true }
        });
        
        if (!edgeError && driverId && edgeData) {
          const edgeProfile = Array.isArray(edgeData) ? edgeData[0] : edgeData;
          if (edgeProfile) {
            profileData = { ...profileData, ...edgeProfile };
          }
        }
      }

      if (profileData) {
        setForm({
          name: profileData.name ?? "",
          cpf: maskCPF(profileData.cpf ?? ""),
          email: profileData.email ?? "",
          whatsapp: maskPhone(profileData.whatsapp ?? ""),
          bio: profileData.bio ?? "",
          car_plate: profileData.car_plate ?? "",
          car_model: profileData.car_model ?? "",
          car_color: profileData.car_color ?? "",
          address: profileData.address ?? "",
          neighborhood: profileData.neighborhood ?? "",
          city: profileData.city ?? "",
          state: profileData.state ?? "",
          cep: profileData.cep ?? "",
          avatar_url: profileData.avatar_url ?? "",
          emergency_contact_1: maskPhone(profileData.emergency_contact_1 ?? ""),
          emergency_contact_2: maskPhone(profileData.emergency_contact_2 ?? ""),
          birth_date: profileData.birth_date ?? "",
        });
      }
    } catch (err) {
      console.error("Error loading driver profile:", err);
      toast({ title: "Erro ao carregar perfil", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriverProfile();
  }, [driverId]);

  const handleSave = async () => {
    if (!driverId) return;
    if (!form.whatsapp.replace(/\D/g, "")) {
      toast({ title: "WhatsApp é obrigatório", variant: "destructive" }); return;
    }
    if (!form.emergency_contact_1.replace(/\D/g, "")) {
      toast({ title: "Contato de emergência 1 é obrigatório", variant: "destructive" }); return;
    }
    if (!form.emergency_contact_2.replace(/\D/g, "")) {
      toast({ title: "Contato de emergência 2 é obrigatório", variant: "destructive" }); return;
    }
    if (!form.birth_date) {
      toast({ title: "Data de nascimento é obrigatória", variant: "destructive" }); return;
    }
    
    setSaving(true);
    console.log("DEBUG - Starting RPC call for driver:", driverId);

    const { data: rpcResult, error } = await (supabase.rpc as any)("update_driver_profile", {
      p_driver_id: String(driverId),
      p_name: form.name.trim(),
      p_email: form.email.trim() || null,
      p_whatsapp: form.whatsapp.replace(/\D/g, "") || null,
      p_birth_date: form.birth_date || null,
      p_emergency_contact_1: form.emergency_contact_1.replace(/\D/g, "") || null,
      p_emergency_contact_2: form.emergency_contact_2.replace(/\D/g, "") || null,
      p_bio: form.bio.trim() || null,
      p_car_plate: form.car_plate.trim().toUpperCase(),
      p_car_model: form.car_model.trim(),
      p_car_color: form.car_color.trim() || null,
      p_address: form.address.trim() || null,
      p_neighborhood: form.neighborhood.trim() || null,
      p_city: form.city.trim() || null,
      p_state: form.state.trim() || null,
      p_cep: form.cep.trim() || null,
    });

    setSaving(false);

    if (error) {
      console.error("DEBUG - RPC Error:", error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      console.log("DEBUG - RPC Result:", rpcResult);
      toast({ title: "Perfil atualizado com sucesso!" });
      
      // Delay reload to ensure DB propagation
      setTimeout(() => {
        loadDriverProfile();
      }, 1500);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 4) {
      toast({ title: "A senha deve ter pelo menos 4 caracteres", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (!driverId) return;
    setSavingPassword(true);
    const { error } = await supabase.from("drivers")
      .update({ password: newPassword } as any)
      .eq("id", driverId);
    setSavingPassword(false);
    if (error) {
      toast({ title: "Erro ao alterar senha", variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !driverId) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagem deve ter no máximo 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${driverId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("driver-avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setUploading(false);
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage
      .from("driver-avatars")
      .getPublicUrl(path);

    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();

    await supabase.from("drivers")
      .update({ avatar_url: avatarUrl } as any)
      .eq("id", driverId);

    setForm((prev) => ({ ...prev, avatar_url: avatarUrl }));
    setUploading(false);
    toast({ title: "Foto atualizada!" });
  };

  const initials = form.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold italic flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        Perfil
      </h1>

      {/* Avatar */}
      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={form.avatar_url} alt={form.name} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {initials || <User className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <p className="font-bold italic text-lg">{form.name || unitSession?.user_name || "—"}</p>
        </CardContent>
      </Card>

      {/* Bio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold italic flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Sobre mim
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Fale um pouco sobre você..."
            className="min-h-[80px] resize-none"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">{form.bio.length}/500</p>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold italic flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome</Label>
              <Input value={form.name} onChange={(e) => set("name", capitalize(e.target.value))} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">CPF</Label>
              <Input value={form.cpf} onChange={(e) => set("cpf", maskCPF(e.target.value))} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1"><Mail className="h-3 w-3" /> E-mail</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Phone className="h-3 w-3" /> WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input value={form.whatsapp} onChange={(e) => set("whatsapp", maskPhone(e.target.value))} className="h-10" placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Data de Nascimento <span className="text-destructive">*</span>
              </Label>
              <Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} className="h-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold italic flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" /> Contatos de Emergência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Phone className="h-3 w-3" /> Contato 1 <span className="text-destructive">*</span>
              </Label>
              <Input value={form.emergency_contact_1} onChange={(e) => set("emergency_contact_1", maskPhone(e.target.value))} className="h-10" placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Phone className="h-3 w-3" /> Contato 2 <span className="text-destructive">*</span>
              </Label>
              <Input value={form.emergency_contact_2} onChange={(e) => set("emergency_contact_2", maskPhone(e.target.value))} className="h-10" placeholder="(00) 00000-0000" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold italic flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" /> Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Placa</Label>
              <Input value={form.car_plate} onChange={(e) => set("car_plate", e.target.value.toUpperCase())} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Modelo</Label>
              <Input value={form.car_model} onChange={(e) => set("car_model", capitalize(e.target.value))} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1"><Palette className="h-3 w-3" /> Cor</Label>
              <Input value={form.car_color} onChange={(e) => set("car_color", capitalize(e.target.value))} className="h-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold italic flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">CEP</Label>
              <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Endereço</Label>
              <Input value={form.address} onChange={(e) => set("address", capitalize(e.target.value))} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Bairro</Label>
              <Input value={form.neighborhood} onChange={(e) => set("neighborhood", capitalize(e.target.value))} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Cidade</Label>
              <Input value={form.city} onChange={(e) => set("city", capitalize(e.target.value))} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Estado</Label>
              <Input value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} className="h-10" maxLength={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full font-bold italic h-12" disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        SALVAR DADOS
      </Button>

      <Separator />

      {/* Change Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold italic flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Nova senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Confirmar nova senha</Label>
            <Input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10"
              placeholder="••••••••"
            />
          </div>
          <Button
            onClick={handlePasswordChange}
            variant="outline"
            className="w-full font-bold italic"
            disabled={savingPassword || !newPassword}
          >
            {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            ALTERAR SENHA
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverProfile;
