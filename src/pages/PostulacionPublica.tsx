import React, { useState, useRef } from 'react';
import { cvParserService } from '../services/entrevistas/cvParserService';
import { compressImage } from '../lib/imageUtils';
import type { Candidato } from '../types/entrevistas';
import {
  FileText,
  UploadCloud,
  Sparkles,
  Camera,
  CheckCircle2,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  GraduationCap,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const SPECIALTY_OPTIONS = [
  'Oficial Electricista',
  'Medio Oficial Electricista',
  'Ayudante Electricista',
  'Técnico Electromecánico',
  'Oficial Montador de Bandejas',
  'Tablerista / Automatización',
  'Capataz de Obra Eléctrica',
  'Chofer / Logística de Obras',
  'Otro Oficio / Administrativo'
];

const LOCALITIES_TUCUMAN = [
  'San Miguel de Tucumán',
  'Yerba Buena',
  'Tafí Viejo',
  'Banda del Río Salí',
  'Alderetes',
  'Las Talitas',
  'San Pablo',
  'Lules',
  'Famaillá',
  'Monteros',
  'Concepción',
  'Otra Localidad'
];

export default function PostulacionPublica() {
  const { toast } = useToast();
  const fileCvRef = useRef<HTMLInputElement>(null);
  const filePhotoRef = useRef<HTMLInputElement>(null);

  // Parsing state
  const [parsingCv, setParsingCv] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [aiAnalysisSummary, setAiAnalysisSummary] = useState<string | null>(null);

  // Photo state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [compressingPhoto, setCompressingPhoto] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState('San Miguel de Tucumán');
  const [birthDate, setBirthDate] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [specialty, setSpecialty] = useState('Oficial Electricista');
  const [yearsExp, setYearsExp] = useState<number | ''>(2);
  const [educationLevel, setEducationLevel] = useState('Secundario Técnico');
  const [summary, setSummary] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCvFile(file);
    setCvFileName(file.name);
    setParsingCv(true);

    try {
      toast({
        title: 'Analizando CV con IA...',
        description: 'Extrayendo datos de experiencia, contacto y especialidad técnica.'
      });

      const parsed = await cvParserService.parseCvWithAI(file);

      if (parsed.full_name) setFullName(parsed.full_name);
      if (parsed.dni) setDni(parsed.dni);
      if (parsed.phone) setPhone(parsed.phone);
      if (parsed.email) setEmail(parsed.email);
      if (parsed.address) setAddress(parsed.address);
      if (parsed.locality) setLocality(parsed.locality);
      if (parsed.birth_date) setBirthDate(parsed.birth_date);
      if (parsed.age) setAge(parsed.age);
      if (parsed.specialty_title) setSpecialty(parsed.specialty_title);
      if (parsed.years_experience !== undefined) setYearsExp(parsed.years_experience);
      if (parsed.education_level) setEducationLevel(parsed.education_level);
      if (parsed.summary) {
        setSummary(parsed.summary);
        setAiAnalysisSummary(parsed.summary);
      }

      toast({
        title: '¡CV Procesado!',
        description: 'Completamos los campos del formulario automáticamente.'
      });
    } catch (err: any) {
      console.error('Error parsing CV:', err);
      toast({
        variant: 'destructive',
        title: 'Aviso',
        description: 'Podés completar tus datos manualmente en los campos a continuación.'
      });
    } finally {
      setParsingCv(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressingPhoto(true);
    try {
      const compressed = await compressImage(file, 800, 0.65);
      setPhotoUrl(compressed);
      toast({
        title: 'Foto Optimizada',
        description: 'Tu foto de perfil se comprimió correctamente.'
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error de Foto',
        description: 'No se pudo procesar la imagen.'
      });
    } finally {
      setCompressingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !specialty.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos requeridos',
        description: 'Por favor completá tu nombre, teléfono y especialidad.'
      });
      return;
    }

    setSubmitting(true);
    try {
      await cvParserService.submitCandidato({
        full_name: fullName.trim(),
        dni: dni.trim() || null,
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        locality: locality.trim() || null,
        birth_date: birthDate || null,
        age: age ? Number(age) : null,
        specialty_title: specialty,
        years_experience: yearsExp ? Number(yearsExp) : 0,
        education_level: educationLevel,
        cv_filename: cvFileName,
        cv_text_summary: summary.trim() || null,
        photo_url: photoUrl,
        status: 'Nuevo'
      });

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al enviar',
        description: 'Ocurrió un inconveniente al registrar la postulación.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black text-slate-900">¡Postulación Recibida!</h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Gracias por postularte, <span className="font-bold text-slate-900">{fullName}</span>. El equipo de Recursos Humanos de PEIE revisará tu perfil para nuestras obras en Tucumán.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Puesto:</span>
              <span className="font-bold text-slate-900">{specialty}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Contacto:</span>
              <span className="font-bold text-slate-900">{phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Localidad:</span>
              <span className="font-bold text-slate-900">{locality}</span>
            </div>
          </div>

          <Button
            onClick={() => {
              setSubmitted(false);
              setFullName('');
              setPhone('');
              setCvFileName(null);
              setPhotoUrl(null);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3 font-bold text-sm shadow-md"
          >
            Cargar otra postulación
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Branding */}
        <div className="bg-gradient-to-r from-[#031530] to-[#042454] rounded-3xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left space-y-1">
            <span className="bg-sky-400/20 text-sky-300 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-sky-400/20">
              Obras e Instalaciones Eléctricas
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
              Sumate al Equipo PEIE
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md">
              Buscamos oficiales electricistas, montadores y técnicos para nuestros frentes de obra en Tucumán.
            </p>
          </div>

          <img
            src="/logo-peie.png"
            alt="PEIE"
            className="h-10 w-auto object-contain brightness-0 invert shrink-0"
          />
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          
          {/* STEP 1: Upload CV with AI parsing */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 p-5 rounded-2xl border border-blue-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Cargá tu Currículum Vitae (CV)
                </h3>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                Lectura Automática
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Subí tu archivo en <strong className="text-slate-800">PDF, Word o Foto</strong>. Nuestra IA extraerá automáticamente tus datos para que no tengas que escribirlos uno a uno.
            </p>

            <input
              ref={fileCvRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              className="hidden"
              onChange={handleCvUpload}
            />

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <Button
                type="button"
                onClick={() => fileCvRef.current?.click()}
                disabled={parsingCv}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                {parsingCv ? 'Escaneando con IA...' : 'Seleccionar Archivo de CV'}
              </Button>

              {cvFileName && (
                <span className="text-xs font-semibold text-slate-700 truncate flex items-center gap-1">
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  {cvFileName}
                </span>
              )}
            </div>

            {aiAnalysisSummary && (
              <div className="bg-white/80 p-3 rounded-xl border border-blue-200/70 text-xs text-slate-700">
                <span className="font-bold text-blue-900 block mb-0.5">Resumen detectado:</span>
                {aiAnalysisSummary}
              </div>
            )}
          </div>

          {/* STEP 2: Photo Upload */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-200 bg-white flex items-center justify-center shrink-0 shadow-inner">
                {photoUrl ? (
                  <img src={photoUrl} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <button
                type="button"
                onClick={() => filePhotoRef.current?.click()}
                disabled={compressingPhoto}
                className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full shadow-md hover:bg-blue-700"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={filePhotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            <div className="text-center sm:text-left space-y-0.5">
              <button
                type="button"
                onClick={() => filePhotoRef.current?.click()}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                {photoUrl ? 'Cambiar foto de perfil' : 'Subir foto de rostro (Opcional)'}
              </button>
              <p className="text-[11px] text-slate-500">
                Se optimiza automáticamente en el navegador para agilizar la revisión.
              </p>
            </div>
          </div>

          {/* STEP 3: Form Fields */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
              Datos Personales y de Contacto
            </h4>

            {/* Nombre Completo & DNI */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Nombre y Apellido *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Juan Carlos Pérez"
                  required
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">DNI (Sin puntos)</Label>
                <Input
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="Ej: 38123456"
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Celular WhatsApp & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  Celular / WhatsApp *
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 9 381 555-1234"
                  required
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Correo Electrónico
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@email.com"
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Localidad y Domicilio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Localidad (Tucumán) *</Label>
                <Select value={locality} onValueChange={setLocality}>
                  <SelectTrigger className="rounded-xl border-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALITIES_TUCUMAN.map((loc, i) => (
                      <SelectItem key={i} value={loc} className="text-xs">
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  Dirección / Barrio
                </Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej: Av. Mate de Luna 2400"
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Fecha Nacimiento / Edad */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Fecha de Nacimiento</Label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    if (e.target.value) {
                      const birthYear = new Date(e.target.value).getFullYear();
                      const currentYear = new Date().getFullYear();
                      setAge(currentYear - birthYear);
                    }
                  }}
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Edad (Años)</Label>
                <Input
                  type="number"
                  min="18"
                  max="70"
                  value={age}
                  onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ej: 28"
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Perfil Técnico */}
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1 pt-3">
              Experiencia Técnica y Oficio
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  Especialidad Principal *
                </Label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger className="rounded-xl border-slate-200 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTY_OPTIONS.map((spec, i) => (
                      <SelectItem key={i} value={spec} className="text-xs font-medium">
                        {spec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  Años en Obra
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="45"
                  value={yearsExp}
                  onChange={(e) => setYearsExp(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ej: 3"
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Nivel Educativo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                Máximo Nivel de Estudios
              </Label>
              <Input
                value={educationLevel}
                onChange={(e) => setEducationLevel(e.target.value)}
                placeholder="Ej: Secundario Técnico / Curso Electricista Matriculado"
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>

            {/* Resumen o Comentarios */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Experiencia en obras eléctricas / Comentarios adicionales
              </Label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Describí brevemente qué tareas realizaste (tableros, canalizaciones, cableado, herramientas que dominás)..."
                rows={3}
                className="rounded-xl border-slate-200 text-xs resize-none"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting || parsingCv}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3.5 font-bold text-sm shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? 'Enviando postulación...' : 'Enviar Postulación a PEIE'}
            <ArrowRight className="w-4 h-4" />
          </Button>

          <p className="text-[11px] text-center text-slate-400">
            Tus datos serán tratados de forma confidencial exclusivamente para la selección de personal de PEIE.
          </p>
        </form>
      </div>
    </div>
  );
}
