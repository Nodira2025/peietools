import { useState } from 'react';
import { Camera, MapPin, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { readPersonalLocation, registerPersonalLocation } from '../lib/personalLocation';
import { Button } from '@/components/ui/button';

async function preparePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Elegí una foto JPG, PNG o WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('La foto debe pesar menos de 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 384;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la foto.');
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 384, 384);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally { bitmap.close(); }
}

export default function Perfil() {
  const { profile, user } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const location = readPersonalLocation();
  const photo = preview || profile?.photo_url;
  async function savePhoto() {
    if (!preview || !user) return;
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.from('profiles').update({ photo_url: preview }).eq('id', user.id).select('*').single();
      if (error || !data) throw new Error('No se pudo guardar la foto. Volvé a intentar.');
      useAuthStore.setState({ profile: data });
      setPreview(null); setMessage('Tu foto se actualizó correctamente.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  return <section className="max-w-lg mx-auto bg-white rounded-3xl p-6 space-y-6 shadow-sm">
    <div><h1 className="text-2xl font-bold">Mi perfil</h1><p className="text-slate-500">Tu espacio en PEIE</p></div>
    <div className="flex flex-col items-center gap-4">
      <div className="w-40 h-40 rounded-full overflow-hidden bg-blue-50 flex items-center justify-center border-4 border-white shadow-lg">{photo ? <img src={photo} alt="Tu foto de perfil" className="w-full h-full object-cover" /> : <UserRound size={72} className="text-blue-700" />}</div>
      <label className={`inline-flex gap-2 items-center cursor-pointer text-blue-800 font-semibold p-3 rounded-xl bg-blue-50 ${busy ? 'pointer-events-none opacity-50' : ''}`}><Camera size={20} /> Reemplazar foto<input aria-label="Seleccionar foto de perfil" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setBusy(true); setMessage(''); try { setPreview(await preparePhoto(file)); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo leer la foto.'); } finally { setBusy(false); } }} /></label>
      {preview && <div className="flex gap-3"><Button disabled={busy} onClick={savePhoto}>{busy ? 'Guardando…' : 'Guardar foto'}</Button><Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>Cancelar</Button></div>}
      <p className="text-xs text-slate-500 text-center">JPG, PNG o WebP · Hasta 10 MB.<br />La nueva foto reemplaza a la anterior.</p>
    </div>
    <dl className="space-y-3"><div><dt className="text-sm text-slate-500">Nombre</dt><dd className="font-semibold">{profile?.full_name}</dd></div><div><dt className="text-sm text-slate-500">Usuario</dt><dd>{profile?.username || user?.email}</dd></div></dl>
    <div className="border-t pt-5 space-y-3"><h2 className="font-semibold flex gap-2"><MapPin size={20} /> Tu ubicación</h2><p className="text-sm text-slate-600">Registrá tu ubicación para consultar el clima de tu zona. Se guarda en tu cuenta cuando lo solicitás; no hacemos seguimiento continuo.</p>{location && <p className="text-xs text-slate-500">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)} · Precisión: {Math.round(location.accuracy)} m<br />Registrada: {new Date(location.capturedAt).toLocaleString('es-AR')}</p>}<Button disabled={busy} onClick={async () => { setBusy(true); setMessage(''); try { await registerPersonalLocation(); setMessage('Ubicación actualizada.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo obtener la ubicación.'); } finally { setBusy(false); } }}>{busy ? 'Procesando…' : location ? 'Actualizar ubicación GPS' : 'Registrar ubicación GPS'}</Button></div>
    <p role="status" className="text-sm text-blue-900">{message}</p>
  </section>;
}
