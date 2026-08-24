import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  User, 
  Calendar, 
  HeartHandshake, 
  Award, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Building2,
  AlertTriangle,
  Send,
  Edit3,
  ShieldAlert,
  Utensils
} from 'lucide-react';
import { Label } from '@/components/ui/label';

// Helper para quincena y semana
function getQuincenaInfo(date = new Date()): { quincena: string; mes: string; diaMes: number } {
  const dia = date.getDate();
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  return {
    quincena: dia <= 15 ? '1Q' : '2Q',
    mes: meses[date.getMonth()],
    diaMes: dia
  };
}

function getMondayOfCurrentWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

const DIAS_MAP: { [key: number]: { key: string; label: string } } = {
  0: { key: 'domingo', label: 'Domingo' },
  1: { key: 'lunes', label: 'Lunes' },
  2: { key: 'martes', label: 'Martes' },
  3: { key: 'miercoles', label: 'Miércoles' },
  4: { key: 'jueves', label: 'Jueves' },
  5: { key: 'viernes', label: 'Viernes' },
  6: { key: 'sabado', label: 'Sábado' }
};

type Step = 
  | 'DNI'                     // Paso 1: Ingreso de DNI
  | 'VALIDAR_IDENTIDAD'       // Paso 2: ¿Sos [Nombre]?
  | 'HORAS_HOY'               // Paso 3: Horas de hoy + Obra + ¿Completó los otros días?
  | 'ASISTENTE_SEMANAL'       // Paso 4: Carga guiada día por día
  | 'RESUMEN_FINAL'           // Paso 5: Resumen y cálculo total
  | 'EXITO';                  // Paso 6: Confirmación

export default function CargarHorasPublico() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<Step>('DNI');
  
  const [dni, setDni] = useState(searchParams.get('dni') || '');
  const [nombre, setNombre] = useState(searchParams.get('nombre') || '');
  const [semanaInicio, setSemanaInicio] = useState<string>(getMondayOfCurrentWeek());
  
  // Obra seleccionada
  const [obraId, setObraId] = useState<string>('');
  const [obraNombre, setObraNombre] = useState<string>('');
  const [obrasList, setObrasList] = useState<{ id: string; name: string }[]>([]);

  // Días y horas de la semana
  const [horas, setHoras] = useState<{ [key: string]: number }>({
    lunes: 10,
    martes: 10,
    miercoles: 10,
    jueves: 9.5,
    viernes: 8,
    sabado: 6.5,
    domingo: 0
  });

  // Horas del día de hoy
  const todayIndex = new Date().getDay();
  const todayInfo = DIAS_MAP[todayIndex] || { key: 'lunes', label: 'Lunes' };
  const [horasHoy, setHorasHoy] = useState<number>(todayIndex === 6 ? 6.5 : todayIndex === 0 ? 0 : 10);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaEgreso, setHoraEgreso] = useState('18:00');
  const [almuerzo, setAlmuerzo] = useState(false);
  const [estadoHoy, setEstadoHoy] = useState<'PRESENTE' | 'AUSENTE' | 'LLEGADA TARDE' | 'SE RETIRO'>('PRESENTE');

  // Motivos de ausencia / novedades
  const [tipoLicencia, setTipoLicencia] = useState<string>('Ninguno');
  const [certificadoMedico, setCertificadoMedico] = useState(false);
  const [detallesAusencia, setDetallesAusencia] = useState('');
  
  // Reglas de bonos y anti-fraude horario
  const [horasObjetivo, setHorasObjetivo] = useState(44);
  const [porcentajeBono, setPorcentajeBono] = useState(10);
  const [horaInicioPermitida, setHoraInicioPermitida] = useState('06:30');
  const [horaFinPermitida, setHoraFinPermitida] = useState('19:30');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [empleadosList, setEmpleadosList] = useState<{ id: string; full_name: string; whatsapp?: string; obra_id?: string }[]>([]);

  // Verificación Anti-Fraude Horario
  const timeValidation = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [hMin, mMin] = horaInicioPermitida.split(':').map(Number);
    const [hMax, mMax] = horaFinPermitida.split(':').map(Number);
    
    const minLimit = hMin * 60 + mMin;
    const maxLimit = hMax * 60 + mMax;
    
    const isAllowed = currentMinutes >= minLimit && currentMinutes <= maxLimit;
    const isLate = currentMinutes > (8 * 60 + 15); // Después de las 08:15 hs

    return {
      isAllowed,
      isLate,
      currentHourFormatted: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    };
  }, [horaInicioPermitida, horaFinPermitida]);

  useEffect(() => {
    async function loadConfig() {
      try {
        // 1. Cargar reglas
        const { data: reglasData } = await supabase
          .from('reglas_horas_trabajadores')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (reglasData) {
          if (reglasData.horas_objetivo_semanal) setHorasObjetivo(Number(reglasData.horas_objetivo_semanal));
          if (reglasData.porcentaje_bono) setPorcentajeBono(Number(reglasData.porcentaje_bono));
          if (reglasData.hora_inicio_permitida) setHoraInicioPermitida(reglasData.hora_inicio_permitida);
          if (reglasData.hora_fin_permitida) setHoraFinPermitida(reglasData.hora_fin_permitida);
        }

        // 2. Cargar empleados
        const { data: empData } = await supabase
          .from('empleados')
          .select('id, full_name, whatsapp, obra_id')
          .eq('active', true)
          .order('full_name');

        if (empData) setEmpleadosList(empData);

        // 3. Cargar obras activas
        const { data: obrasData } = await supabase
          .from('obras')
          .select('id, name')
          .eq('active', true)
          .order('name');

        if (obrasData) setObrasList(obrasData);
      } catch (err) {
        console.error('Error loading config:', err);
      }
    }

    loadConfig();
  }, []);

  // Calcular horas netas a partir de entrada/salida
  const calcularHorasNetas = (inicio: string, egreso: string, conAlmuerzo: boolean) => {
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = egreso.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    let netHours = diff / 60;
    if (conAlmuerzo && netHours > 4) netHours = Math.max(0, netHours - 1);
    return Math.round(netHours * 10) / 10;
  };

  // PASO 1 -> PASO 2: Buscar nombre por DNI
  const handleDniSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim() || dni.trim().length < 6) {
      toast({
        variant: 'destructive',
        title: 'DNI requerido',
        description: 'Ingresá un número de documento válido.'
      });
      return;
    }

    let detectedName = nombre;
    let detectedObraId = obraId;

    if (empleadosList.length > 0) {
      const match = empleadosList.find(e => 
        (e.whatsapp && e.whatsapp.includes(dni.trim())) ||
        e.id === dni.trim()
      );
      if (match) {
        detectedName = match.full_name;
        if (match.obra_id) detectedObraId = match.obra_id;
      }
    }

    if (!detectedName) detectedName = 'Trabajador de PEIE';
    
    setNombre(detectedName);
    if (detectedObraId) {
      setObraId(detectedObraId);
      const obraMatch = obrasList.find(o => o.id === detectedObraId);
      if (obraMatch) setObraNombre(obraMatch.name);
    }

    setCurrentStep('VALIDAR_IDENTIDAD');
  };

  // PASO 2 -> PASO 3: Validación de identidad
  const handleConfirmIdentity = () => {
    setHoras(prev => ({
      ...prev,
      [todayInfo.key]: horasHoy
    }));
    setCurrentStep('HORAS_HOY');
  };

  // PASO 3 -> PASO 4 o PASO 5: Horas de hoy y decisión sobre días anteriores
  const handleTodaySubmit = (completadoAnteriores: boolean) => {
    const netas = calcularHorasNetas(horaInicio, horaEgreso, almuerzo);
    const updatedVal = estadoHoy === 'AUSENTE' ? 0 : netas;
    setHorasHoy(updatedVal);

    setHoras(prev => ({
      ...prev,
      [todayInfo.key]: updatedVal
    }));

    if (completadoAnteriores) {
      setCurrentStep('RESUMEN_FINAL');
    } else {
      setCurrentStep('ASISTENTE_SEMANAL');
    }
  };

  const handleHourChange = (diaKey: string, val: number) => {
    setHoras(prev => ({
      ...prev,
      [diaKey]: Math.max(0, Math.min(24, val))
    }));
  };

  const totalHoras = useMemo(() => {
    return Object.values(horas).reduce((acc, h) => acc + (Number(h) || 0), 0);
  }, [horas]);

  const calificaBono = totalHoras >= horasObjetivo;
  const quincenaInfo = getQuincenaInfo();

  // Guardar y Finalizar
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const fechaHoy = nowIso.split('T')[0];

      // 1. Guardar Novedad Diaria de Hoy
      const novedadPayload = {
        empleado_dni: dni.trim(),
        empleado_nombre: nombre.trim(),
        fecha: fechaHoy,
        mes: quincenaInfo.mes,
        quincena: quincenaInfo.quincena,
        obra_id: obraId || null,
        obra_nombre: obraNombre || 'Obra Asignada',
        hora_ingreso: horaInicio,
        hora_egreso: horaEgreso,
        almuerzo: almuerzo,
        horas_ausente: estadoHoy === 'AUSENTE' ? 8 : 0,
        horas_trabajadas: horasHoy,
        estado: estadoHoy,
        tipo_licencia: tipoLicencia,
        certificado_medico: certificadoMedico,
        observaciones: detallesAusencia.trim() || null,
        fuente: 'APP_WEB',
        updated_at: nowIso
      };

      await supabase.from('novedades_diarias').insert([novedadPayload]);

      // 2. Guardar Cómputo Semanal
      const horasPayload = {
        empleado_dni: dni.trim(),
        empleado_nombre: nombre.trim(),
        semana_inicio: semanaInicio,
        lunes: horas.lunes,
        martes: horas.martes,
        miercoles: horas.miercoles,
        jueves: horas.jueves,
        viernes: horas.viernes,
        sabado: horas.sabado,
        domingo: horas.domingo,
        total_horas: totalHoras,
        motivo_ausencia: tipoLicencia,
        detalles_ausencia: detallesAusencia.trim() || null,
        bono_alcanzado: calificaBono,
        porcentaje_bono: calificaBono ? porcentajeBono : 0,
        updated_at: nowIso
      };

      await supabase.from('registro_horas_semanales').upsert([horasPayload]);

      // Respaldo en localStorage
      try {
        const localKey = `peie_horas_${semanaInicio}`;
        const currentSaved = JSON.parse(localStorage.getItem(localKey) || '[]');
        const filtered = currentSaved.filter((item: any) => item.empleado_dni !== dni.trim());
        filtered.push({ ...horasPayload, id: `local-${Date.now()}` });
        localStorage.setItem(localKey, JSON.stringify(filtered));
      } catch (e) {
        console.error(e);
      }

      setCurrentStep('EXITO');
      toast({
        title: '¡Horas registradas correctamente!',
        description: `Se computaron ${totalHoras} hs para la ${quincenaInfo.quincena} de ${quincenaInfo.mes}.`
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al enviar',
        description: err.message || 'No se pudo guardar la información.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const diasSemana = [
    { key: 'lunes', label: 'Lunes' },
    { key: 'martes', label: 'Martes' },
    { key: 'miercoles', label: 'Miércoles' },
    { key: 'jueves', label: 'Jueves' },
    { key: 'viernes', label: 'Viernes' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' }
  ];

  return (
    <div className="min-h-screen bg-[#031530] flex flex-col justify-between py-6 px-3 sm:px-6">
      
      <div className="max-w-lg w-full mx-auto space-y-4">
        
        {/* Encabezado con Quincena */}
        <div className="text-center space-y-1 text-white pt-2">
          <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-peie-light border border-white/10 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Carga de Horas • {quincenaInfo.quincena} {quincenaInfo.mes}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Control de Asistencia y Jornada
          </h1>
        </div>

        {/* Banner Anti-Fraude Horario */}
        {!timeValidation.isAllowed && (
          <div className="bg-amber-500/20 border border-amber-400/40 text-amber-200 p-3.5 rounded-2xl flex items-start gap-3 backdrop-blur-md text-xs">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-white">Atención: Fuera de Horario Laboral de Obra</p>
              <p className="text-[11px] text-amber-200/90 leading-tight mt-0.5">
                Hora actual: <strong>{timeValidation.currentHourFormatted} hs</strong>. La ventana oficial es de <strong>{horaInicioPermitida} hs a {horaFinPermitida} hs</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Tarjeta Principal del Asistente */}
        <Card className="bg-white rounded-[28px] border-0 shadow-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            
            {/* =================================================================== */}
            {/* PASO 1: INGRESO DE DNI                                              */}
            {/* =================================================================== */}
            {currentStep === 'DNI' && (
              <form onSubmit={handleDniSubmit} className="space-y-5 animate-fadeIn">
                <div className="space-y-2 text-center">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <User className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">
                    Ingresá tu DNI para identificarte
                  </h2>
                  <p className="text-xs text-slate-500">
                    Buscamos tu legajo para registrar tu asistencia en la obra asignada.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="input-dni" className="text-xs font-bold text-slate-700">
                    Número de DNI (sin puntos)
                  </Label>
                  <Input
                    id="input-dni"
                    type="number"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="Ej: 38123456"
                    className="h-12 text-center text-lg font-black rounded-2xl border-slate-300 focus-visible:ring-[#031530]"
                    autoFocus
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!dni.trim()}
                  className="w-full bg-[#031530] hover:bg-[#082856] text-white font-bold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            )}

            {/* =================================================================== */}
            {/* PASO 2: VALIDACIÓN DE IDENTIDAD ("Sí, soy...")                     */}
            {/* =================================================================== */}
            {currentStep === 'VALIDAR_IDENTIDAD' && (
              <div className="space-y-6 text-center animate-fadeIn">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Paso 2 • Confirmación de Identidad
                  </span>
                  <h2 className="text-xl font-black text-slate-900">
                    ¿Sos {nombre}?
                  </h2>
                  <p className="text-xs text-slate-500">
                    DNI registrado: <strong className="font-mono">{dni}</strong>
                  </p>
                </div>

                {/* Selección de Obra */}
                <div className="text-left space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Obra en la que estás trabajando hoy:</span>
                  </Label>
                  <select
                    value={obraId}
                    onChange={(e) => {
                      setObraId(e.target.value);
                      const m = obrasList.find(o => o.id === e.target.value);
                      if (m) setObraNombre(m.name);
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="">Seleccionar Obra...</option>
                    {obrasList.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2.5 pt-1">
                  <Button
                    onClick={handleConfirmIdentity}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-4 rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>Sí, soy {nombre.split(' ')[0]}</span>
                  </Button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep('DNI')}
                    className="text-xs text-slate-400 hover:text-slate-700 font-semibold py-1 transition-colors"
                  >
                    No es mi nombre / Corregir DNI
                  </button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* PASO 3: HORAS DEL DÍA DE HOY + ENTRADA/SALIDA/ALMUERZO              */}
            {/* =================================================================== */}
            {currentStep === 'HORAS_HOY' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="space-y-1 text-center">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Clock className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">
                    Jornada de Hoy ({todayInfo.label})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Registrá tus horarios y estado de asistencia:
                  </p>
                </div>

                {/* Estado: Presente / Llegada tarde / Ausente */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'PRESENTE', label: '🟢 Presente' },
                    { id: 'LLEGADA TARDE', label: '🟡 Tarde' },
                    { id: 'AUSENTE', label: '🔴 Ausente' }
                  ].map(est => (
                    <button
                      key={est.id}
                      type="button"
                      onClick={() => setEstadoHoy(est.id as any)}
                      className={`py-2 px-1 rounded-xl text-xs font-black transition-all border ${
                        estadoHoy === est.id
                          ? 'bg-[#031530] text-white border-[#031530] shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {est.label}
                    </button>
                  ))}
                </div>

                {/* Si está presente o tarde: Horarios de entrada y egreso */}
                {estadoHoy !== 'AUSENTE' ? (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">Hora de Inicio</Label>
                        <Input
                          type="time"
                          value={horaInicio}
                          onChange={(e) => setHoraInicio(e.target.value)}
                          className="bg-white rounded-xl text-xs font-black text-center"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">Hora de Egreso</Label>
                        <Input
                          type="time"
                          value={horaEgreso}
                          onChange={(e) => setHoraEgreso(e.target.value)}
                          className="bg-white rounded-xl text-xs font-black text-center"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <div className="flex items-center gap-2">
                        <Utensils className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-bold text-slate-700">¿Tuviste 1h de almuerzo?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAlmuerzo(!almuerzo)}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-colors ${
                          almuerzo ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {almuerzo ? 'SÍ (-1h)' : 'NO'}
                      </button>
                    </div>

                    <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                      <span className="font-bold text-slate-500">Horas netas computadas hoy:</span>
                      <span className="font-black text-sm text-emerald-700">
                        {calcularHorasNetas(horaInicio, horaEgreso, almuerzo)} hs
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Si está ausente: Tipificación de Licencia */
                  <div className="space-y-3 bg-rose-50/50 p-4 rounded-2xl border border-rose-200">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-rose-900">Motivo / Tipo de Licencia:</Label>
                      <select
                        value={tipoLicencia}
                        onChange={(e) => setTipoLicencia(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-rose-200 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="Enfermedad Trabajador">Enfermedad del Trabajador (Reposo)</option>
                        <option value="Familiar Enfermo">Familiar Enfermo a cargo</option>
                        <option value="Fallecimiento">Fallecimiento / Duelo</option>
                        <option value="Llegada tarde">Llegada tarde justificada</option>
                        <option value="No justificado">Falta no justificada</option>
                        <option value="Otro">Otro motivo</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-bold text-rose-900">¿Presentás certificado médico?</span>
                      <button
                        type="button"
                        onClick={() => setCertificadoMedico(!certificadoMedico)}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-colors ${
                          certificadoMedico ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {certificadoMedico ? 'SÍ' : 'NO'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Pregunta sobre los días anteriores */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1 text-center">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      ¿Ya habías registrado los días anteriores de esta semana?
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <Button
                      type="button"
                      onClick={() => handleTodaySubmit(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 rounded-2xl shadow-sm flex items-center justify-between px-4"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Sí, ya cargué mis días anteriores</span>
                      </div>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleTodaySubmit(false)}
                      variant="outline"
                      className="w-full border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs py-3.5 rounded-2xl flex items-center justify-between px-4"
                    >
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>No, me faltó cargar los otros días (Completar)</span>
                      </div>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('VALIDAR_IDENTIDAD')}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver</span>
                  </button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* PASO 4: ASISTENTE SEMANAL GUIADO DÍA POR DÍA                        */}
            {/* =================================================================== */}
            {currentStep === 'ASISTENTE_SEMANAL' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="space-y-1 text-center">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Calendar className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">
                    Asistente Semanal de Horas
                  </h2>
                  <p className="text-xs text-slate-500">
                    Completá las horas trabajadas en cada jornada:
                  </p>
                </div>

                {/* Resumen flotante */}
                <div className="bg-[#031530] text-white p-3 rounded-2xl flex items-center justify-between text-xs font-black shadow-md">
                  <span>Total Acumulado:</span>
                  <span className="text-emerald-400 text-base">{totalHoras} hs</span>
                </div>

                {/* Lista interactiva de días */}
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {diasSemana.map((dia) => {
                    const currentVal = horas[dia.key] || 0;
                    return (
                      <div 
                        key={dia.key}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800">{dia.label}</span>
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                            {currentVal} hs
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                          {[0, 6.5, 8, 9.5, 10].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleHourChange(dia.key, preset)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                currentVal === preset
                                  ? 'bg-[#031530] text-white shadow-xs'
                                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                              }`}
                            >
                              {preset}h
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={() => setCurrentStep('HORAS_HOY')}
                    variant="outline"
                    className="rounded-xl text-xs font-bold flex-1"
                  >
                    Volver
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={() => setCurrentStep('RESUMEN_FINAL')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex-1 flex items-center justify-center gap-1.5"
                  >
                    <span>Ver Resumen</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* PASO 5: RESUMEN FINAL Y CONFIRMACIÓN                                */}
            {/* =================================================================== */}
            {currentStep === 'RESUMEN_FINAL' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="space-y-1 text-center">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Award className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">
                    Cómputo Total • {quincenaInfo.quincena} {quincenaInfo.mes}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {nombre} • DNI {dni} • {obraNombre || 'Obra Asignada'}
                  </p>
                </div>

                {/* Desglose de horas */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-7 gap-1 text-center border-b border-slate-200/80 pb-3">
                    {diasSemana.map((d) => (
                      <div key={d.key} className="space-y-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{d.label.slice(0, 3)}</span>
                        <span className="text-xs font-black text-slate-800 block">{horas[d.key]}h</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-1 text-xs">
                    <span className="font-bold text-slate-600">Total semanal computado:</span>
                    <span className="text-lg font-black text-slate-900">{totalHoras} hs</span>
                  </div>

                  {calificaBono ? (
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-3.5 rounded-xl flex items-center gap-3">
                      <Award className="w-7 h-7 shrink-0" />
                      <div>
                        <p className="text-xs font-black uppercase">¡Bono Semanal Alcanzado!</p>
                        <p className="text-[10px] text-emerald-100 font-medium">
                          Meta de {horasObjetivo} hs cumplida (+{porcentajeBono}% premio).
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-500">
                      Meta para bono semanal: <strong>{horasObjetivo} hs</strong>. (Cargaste {totalHoras} hs).
                    </div>
                  )}

                  {tipoLicencia !== 'Ninguno' && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                      <strong>Novedad registrada:</strong> {tipoLicencia} {certificadoMedico ? '(Con Certificado Médico)' : ''}
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting || totalHoras === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-4 rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <span>Guardando horas...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Confirmar e Ingresar Horas ({totalHoras} hs)</span>
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep('ASISTENTE_SEMANAL')}
                    className="w-full text-xs text-slate-400 hover:text-slate-700 font-semibold py-1.5 transition-colors"
                  >
                    Modificar algún día de la semana
                  </button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* PASO 6: PANTALLA DE ÉXITO                                           */}
            {/* =================================================================== */}
            {currentStep === 'EXITO' && (
              <div className="text-center space-y-6 animate-fadeIn py-2">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    Registro Confirmado
                  </span>
                  <h2 className="text-2xl font-black text-slate-900">
                    ¡Listo, {nombre.split(' ')[0]}!
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                    Tus <strong>{totalHoras} horas</strong> de la {quincenaInfo.quincena} de {quincenaInfo.mes} quedaron ingresadas en PEIE Tools.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setCurrentStep('DNI');
                    setDni('');
                    setNombre('');
                  }}
                  variant="outline"
                  className="w-full rounded-2xl text-xs font-bold text-slate-700 py-3"
                >
                  Registrar horas de otro operario
                </Button>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Pie */}
        <div className="text-center text-xs text-slate-400 pb-2">
          <p>© PEIE Tools • Control de Asistencia y Reconocimiento Laboral.</p>
        </div>

      </div>

    </div>
  );
}
