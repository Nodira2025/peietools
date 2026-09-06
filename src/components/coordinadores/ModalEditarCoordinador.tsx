import React, { useState, useEffect, useRef } from 'react';
import type { CoordinadorProfile } from '../../types/coordinadores';
import { compressImage } from '../../lib/imageUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, 
  MapPin, 
  Phone, 
  User, 
  Building, 
  Check, 
  UploadCloud,
  FileImage,
  Sparkles
} from 'lucide-react';

interface ModalEditarCoordinadorProps {
  isOpen: boolean;
  onClose: () => void;
  coordinador: CoordinadorProfile | null;
  obras: { id: string; name: string }[];
  onSave: (id: string, updates: Partial<CoordinadorProfile>) => Promise<void>;
}

export default function ModalEditarCoordinador({
  isOpen,
  onClose,
  coordinador,
  obras,
  onSave
}: ModalEditarCoordinadorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [obraId, setObraId] = useState<string>('none');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [compressing, setCompressing] = useState(false);
  const [compressedStats, setCompressedStats] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (coordinador) {
      setFullName(coordinador.full_name || '');
      setWhatsapp(coordinador.whatsapp || '');
      setPhone(coordinador.phone || coordinador.whatsapp || '');
      setAddress(coordinador.address || '');
      setObraId(coordinador.obra_id || 'none');
      setPhotoUrl(coordinador.photo_url || null);
      setCompressedStats(null);
    }
  }, [coordinador, isOpen]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size before compression
    const originalKb = Math.round(file.size / 1024);
    setCompressing(true);

    try {
      // Compress using Canvas at 800px max width and 0.65 JPEG quality
      const compressedDataUrl = await compressImage(file, 800, 0.65);
      
      // Calculate approximate size of compressed base64
      const compressedKb = Math.round((compressedDataUrl.length * 3) / 4 / 1024);

      setPhotoUrl(compressedDataUrl);
      setCompressedStats(`Original: ${originalKb} KB → Comprimida: ${compressedKb} KB (-${Math.round(((originalKb - compressedKb) / originalKb) * 100)}%)`);

      toast({
        title: 'Foto Comprimida con Éxito',
        description: `Optimizada en el navegador a ${compressedKb} KB para carga ultrarrápida.`,
      });
    } catch (err: any) {
      console.error('Error compressing photo:', err);
      toast({
        variant: 'destructive',
        title: 'Error de Compresión',
        description: 'No se pudo procesar la imagen seleccionada.'
      });
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coordinador) return;

    setSaving(true);
    try {
      const updates: Partial<CoordinadorProfile> = {
        full_name: fullName.trim(),
        whatsapp: whatsapp.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        obra_id: obraId === 'none' ? null : obraId,
        photo_url: photoUrl
      };

      await onSave(coordinador.id, updates);
      toast({
        title: 'Ficha Actualizada',
        description: `Datos y foto de ${fullName} guardados correctamente.`,
      });
      onClose();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: err.message || 'No se pudieron guardar los cambios.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full rounded-2xl p-6 bg-white border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Ficha de Personal Administrativo / Coordinador
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Actualizá los datos de contacto, domicilio y foto de perfil comprimida.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Photo Upload & Compression Banner */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-500/40 bg-white shadow-inner flex items-center justify-center">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-slate-400" />
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-full shadow-md transition-transform active:scale-95"
                title="Cambiar Foto"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 mx-auto"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                {compressing ? 'Comprimiendo imagen...' : 'Subir o tomar foto'}
              </button>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Se comprime automáticamente en el navegador a 800px (JPEG 65%)
              </p>
              {compressedStats && (
                <div className="mt-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full border border-emerald-200 flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  {compressedStats}
                </div>
              )}
            </div>
          </div>

          {/* Nombre Completo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Nombre Completo
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Federico Grande"
              required
              className="rounded-xl border-slate-200 text-xs"
            />
          </div>

          {/* Contacto: WhatsApp y Teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                WhatsApp
              </Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+54 9 381 123-4567"
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Teléfono Alternativo
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono directo o fijo"
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>
          </div>

          {/* Domicilio */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              Domicilio Real / Ciudad
            </Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Av. Aconquija 1200, Yerba Buena, Tucumán"
              className="rounded-xl border-slate-200 text-xs"
            />
          </div>

          {/* Obra Principal Asignada */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-blue-600" />
              Obra Asignada
            </Label>
            <Select value={obraId} onValueChange={(val) => setObraId(val)}>
              <SelectTrigger className="rounded-xl border-slate-200 text-xs">
                <SelectValue placeholder="Seleccionar obra..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin obra específica / Supervisión General</SelectItem>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || compressing}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Ficha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
