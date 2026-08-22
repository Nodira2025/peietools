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
  HelpCircle,
  AlertCircle,
  Send,
  Edit3
} from 'lucide-react';
import { Label } from '@/components/ui/label';

// Helper para obtener el lunes de la semana actual en formato YYYY-MM-DD
function getMondayOfCurrentWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// Helper para obtener el nombre del día de hoy en español
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
  | 'HORAS_HOY'               // Paso 3: Horas de hoy + ¿Completó los otros días?
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
  
  // Días y horas de la semana
  const [horas, setHoras] = useState<{ [key: string]: number }>({
    lunes: 8,
    martes: 8,
    miercoles: 8,
    jueves: 8,
    viernes: 8,
    sabado: 4,
    domingo: 0
  });

  // Horas del día de hoy
  const todayIndex = new Date().getDay();
  const todayInfo = DIAS_MAP[todayIndex] || { key: 'lunes', label: 'Lunes' };
  const [horasHoy, setHorasHoy] = useState<number>(todayIndex === 6 ? 4 : todayIndex === 0 ? 0 : 8);
  const [cargoDiasAnteriores, setCargoDiasAnteriores] = useState<boolean | null>(null);

  // Motivos de ausencia
  const [motivoAusencia, setMotivoAusencia] = useState<string>('Ninguno');
  const [detallesAusencia, setDetallesAusencia] = useState('');
  
  // Reglas de bonos
  const [horasObjetivo, setHorasObjetivo] = useState(44);
  const [porcentajeBono, setPorcentajeBono] = useState(10);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [empleadosList, setEmpleadosList] = useState<{ id: string; full_name: string; whatsapp?: string }[]>([]);

  useEffect(() => {
    async function loadConfig() {
      try {
        // Cargar reglas de bonos
        const { data: reglasData } = await supabase
          .from('reglas_horas_trabajadores')
          .select('horas_objetivo_semanal, porcentaje_bono')
          .limit(1)
          .maybeSingle();

        if (reglasData) {
          if (reglasData.horas_objetivo_semanal) setHorasObjetivo(Number(reglasData.horas_objetivo_semanal));
          if (reglasData.porcentaje_bono) setPorcentajeBono(Number(reglasData.porcentaje_bono));
        }

        // Cargar lista de empleados de Supabase
        const { data: empData } = await supabase
          .from('empleados')
          .select('id, full_name, whatsapp')
          .eq('active', true)
          .order('full_name');

        if (empData) setEmpleadosList(empData);
      } catch (err) {
        console.error('Error loading config:', err);
      }
    }

    loadConfig();
  }, []);

  // Si vino con DNI y Nombre por URL, sugerir avanzar
  useEffect(() => {
    if (searchParams.get('nombre')) {
      setNombre(searchParams.get('nombre') || '');
    }
  }, [searchParams]);

  // Cargar registro existente si el usuario ya tenía horas guardadas esta semana
  const buscarRegistroPrevio = async (dniSearch: string) => {
    try {
      const { data } = await supabase
        .from('registro_horas_semanales')
        .select('*')
        .eq('empleado_dni', dniSearch.trim())
        .eq('semana_inicio', semanaInicio)
        .maybeSingle();

      if (data) {
        setHoras({
          lunes: Number(data.lunes) || 0,
          martes: Number(data.martes) || 0,
          miercoles: Number(data.miercoles) || 0,
          jueves: Number(data.jueves) || 0,
          viernes: Number(data.viernes) || 0,
          sabado: Number(data.sabado) || 0,
          domingo: Number(data.domingo) || 0
        });
        if (data.motivo_ausencia) setMotivoAusencia(data.motivo_ausencia);
        if (data.detalles_ausencia) setDetallesAusencia(data.detalles_ausencia);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  // PASO 1 -> PASO 2: Buscar nombre por DNI y validar
  const handleDniSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim() || dni.trim().length < 6) {
      toast({
        variant: 'destructive',
        title: 'DNI inválido',
        description: 'Por favor ingresá un número de documento válido.'
      });
      return;
    }

    // Buscar si tenemos el nombre registrado
    let detectedName = nombre;
    if (!detectedName && empleadosList.length > 0) {
      const match = empleadosList.find(e => 
        (e.whatsapp && e.whatsapp.includes(dni.trim())) ||
        e.id === dni.trim()
      );
      if (match) detectedName = match.full_name;
    }

    if (!detectedName) {
      // Si no tenemos el nombre aún, pedimos que lo confirme o ingrese
      detectedName = 'Trabajador de PEIE';
    }

    setNombre(detectedName);
    buscarRegistroPrevio(dni.trim());
    setCurrentStep('VALIDAR_IDENTIDAD');
  };

  // PASO 2 -> PASO 3: Validación de identidad
  const handleConfirmIdentity = () => {
    // Actualizar horas de hoy con el valor actual
    setHoras(prev => ({
      ...prev,
      [todayInfo.key]: horasHoy
    }));
    setCurrentStep('HORAS_HOY');
  };

  // PASO 3 -> PASO 4 o PASO 5: Horas de hoy y decisión sobre días anteriores
  const handleTodaySubmit = (completadoAnteriores: boolean) => {
    setCargoDiasAnteriores(completadoAnteriores);
    
    // Actualizar el día de hoy en el objeto de horas
    const updatedHoras = {
      ...horas,
      [todayInfo.key]: horasHoy
    };
    setHoras(updatedHoras);

    if (completadoAnteriores) {
      // Ya cargó los días anteriores, va directo al resumen
      setCurrentStep('RESUMEN_FINAL');
    } else {
      // Le faltó cargar los otros días, va al asistente semanal guiado
      setCurrentStep('ASISTENTE_SEMANAL');
    }
  };

  // Cambiar horas de un día específico
  const handleHourChange = (diaKey: string, val: number) => {
    setHoras(prev => ({
      ...prev,
      [diaKey]: Math.max(0, Math.min(24, val))
    }));
  };

  // Total de horas calculado en tiempo real
  const totalHoras = useMemo(() => {
    return Object.values(horas).reduce((acc, h) => acc + (Number(h) || 0), 0);
  }, [horas]);

  const calificaBono = totalHoras >= horasObjetivo;

  // Confirmar y Guardar
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
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
        motivo_ausencia: motivoAusencia,
        detalles_ausencia: detallesAusencia.trim() || null,
        bono_alcanzado: calificaBono,
        porcentaje_bono: calificaBono ? porcentajeBono : 0,
        updated_at: new Date().toISOString()
      };

      // Guardar en Supabase
      const { error } = await supabase
        .from('registro_horas_semanales')
        .upsert([payload]);

      if (error) {
        console.warn('Fallback a guardado local:', error.message);
      }

      // Guardado local
      try {
        const localKey = `peie_horas_${semanaInicio}`;
        const currentSaved = JSON.parse(localStorage.getItem(localKey) || '[]');
        const filtered = currentSaved.filter((item: any) => item.empleado_dni !== dni.trim());
        filtered.push({ ...payload, id: `local-${Date.now()}` });
        localStorage.setItem(localKey, JSON.stringify(filtered));
      } catch (storageErr) {
        console.error(storageErr);
      }

      setCurrentStep('EXITO');
      toast({
        title: '¡Horas registradas con éxito!',
        description: `Se computaron ${totalHoras} horas en total.`
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al enviar',
        description: err.message || 'No se pudo guardar la información. Probá de nuevo.'
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
        
        {/* Encabezado */}
        <div className="text-center space-y-1 text-white pt-2">
          <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-peie-light border border-white/10 backdrop-blur-md">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Asistente de Cómputo de Horas</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Registro de Trabajo • PEIE
          </h1>
        </div>

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
                    Ingresá tu DNI para comenzar
                  </h2>
                  <p className="text-xs text-slate-500">
                    Vamos a identificar tu legajo para computar tus horas de esta semana.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="input-dni" className="text-xs font-bold text-slate-700">
                    Número de Documento (DNI)
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

                {/* Si no tiene DNI en el sistema, puede elegir su nombre */}
                {nombre && nombre !== 'Trabajador de PEIE' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 text-center">
                    Nombre detectado: <strong className="text-slate-900">{nombre}</strong>
                  </div>
                )}

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
                    DNI ingresado: <strong className="font-mono">{dni}</strong>
                  </p>
                </div>

                {/* Si el nombre era genérico o quiere editarlo */}
                {nombre === 'Trabajador de PEIE' && (
                  <div className="space-y-1 text-left bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <Label className="text-[11px] font-bold text-slate-700">Completá tu nombre y apellido:</Label>
                    <Input
                      value={nombre === 'Trabajador de PEIE' ? '' : nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Juan Gómez"
                      className="bg-white text-xs font-bold rounded-xl"
                    />
                  </div>
                )}

                <div className="space-y-2.5 pt-2">
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
            {/* PASO 3: HORAS DEL DÍA DE HOY + ¿COMPLETÓ LOS OTROS DÍAS?            */}
            {/* =================================================================== */}
            {currentStep === 'HORAS_HOY' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1 text-center">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Clock className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">
                    Horas de hoy ({todayInfo.label})
                  </h2>
                  <p className="text-xs text-slate-500">
                    ¿Cuántas horas trabajaste en la jornada de hoy?
                  </p>
                </div>

                {/* Selector rápido de horas de hoy */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">
                      Horas hoy ({todayInfo.label}):
                    </span>
                    <span className="text-sm font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                      {horasHoy} hs
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5">
                    {[0, 4, 8, 9, 10].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setHorasHoy(preset)}
                        className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all ${
                          horasHoy === preset
                            ? 'bg-[#031530] text-white shadow-sm scale-105'
                            : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {preset}h
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pregunta sobre los días anteriores */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1 text-center">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      ¿Ya habías registrado los días anteriores de esta semana?
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Seleccioná una opción para continuar:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <Button
                      type="button"
                      onClick={() => handleTodaySubmit(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 rounded-2xl shadow-sm flex items-center justify-between px-4 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Sí, ya cargué mis días anteriores</span>
                      </div>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleTodaySubmit(false)}
                      variant="outline"
                      className="w-full border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs py-3.5 rounded-2xl flex items-center justify-between px-4 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Edit3 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>No, me faltó cargar los otros días (Completar semana)</span>
                      </div>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-center pt-2">
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
                    Ingresá las horas que trabajaste cada día de esta semana:
                  </p>
                </div>

                {/* Resumen flotante de total */}
                <div className="bg-[#031530] text-white p-3 rounded-2xl flex items-center justify-between text-xs font-black shadow-md">
                  <span>Total Acumulado:</span>
                  <span className="text-emerald-400 text-base">{totalHoras} hs</span>
                </div>

                {/* Lista interactiva de días */}
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {diasSemana.map((dia) => {
                    const currentVal = horas[dia.key] || 0;
                    return (
                      <div 
                        key={dia.key}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800">
                            {dia.label}
                          </span>
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                            {currentVal} hs
                          </span>
                        </div>

                        {/* Presets de horas */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                          {[0, 4, 8, 9, 10].map((preset) => (
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

                {/* Motivos de ausencia si algún día fue 0 */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <Label className="text-[11px] font-bold text-slate-700">
                    ¿Tuviste algún día de inasistencia por enfermedad u otro motivo?
                  </Label>
                  <select
                    value={motivoAusencia}
                    onChange={(e) => setMotivoAusencia(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="Ninguno">No tuve ausencias / Cumplí mis jornadas normales</option>
                    <option value="Enfermedad / Salud">Estuve enfermo o en reposo médico</option>
                    <option value="Falta Justificada / Trámite">Trámite personal / Asuntos familiares</option>
                    <option value="Lluvia / Clima">Lluvia o cuestiones climáticas en obra</option>
                    <option value="Otro">Otro motivo</option>
                  </select>
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
            {/* PASO 5: RESUMEN FINAL Y CÁLCULO DE BONO                              */}
            {/* =================================================================== */}
            {currentStep === 'RESUMEN_FINAL' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="space-y-1 text-center">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Award className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">
                    Cómputo Total de la Semana
                  </h2>
                  <p className="text-xs text-slate-500">
                    {nombre} • DNI {dni}
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
                    <span className="font-bold text-slate-600">Total computado:</span>
                    <span className="text-lg font-black text-slate-900">{totalHoras} hs</span>
                  </div>

                  {calificaBono ? (
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-3.5 rounded-xl flex items-center gap-3">
                      <Award className="w-7 h-7 shrink-0" />
                      <div>
                        <p className="text-xs font-black uppercase">¡Alcanzaste el Bono Semanal!</p>
                        <p className="text-[10px] text-emerald-100 font-medium">
                          Superaste la meta de {horasObjetivo} hs semanales (+{porcentajeBono}% de premio).
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-500">
                      Meta para bono semanal: <strong>{horasObjetivo} hs</strong>. (Cargaste {totalHoras} hs).
                    </div>
                  )}

                  {motivoAusencia !== 'Ninguno' && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                      <strong>Motivo de ausencia declarado:</strong> {motivoAusencia}
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
                    Tus <strong>{totalHoras} horas</strong> quedaron ingresadas en el sistema de PEIE Tools.
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
          <p>© PEIE Tools • Creado para reconocer y cuidar a cada trabajador.</p>
        </div>

      </div>

    </div>
  );
}
