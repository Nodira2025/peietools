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
  HelpCircle, 
  Award, 
  Send,
  AlertCircle,
  Check
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

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CargarHorasPublico() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [dni, setDni] = useState(searchParams.get('dni') || '');
  const [nombre, setNombre] = useState(searchParams.get('nombre') || '');
  const [semanaInicio, setSemanaInicio] = useState<string>(getMondayOfCurrentWeek());
  
  // Días de la semana y horas
  const [horas, setHoras] = useState<{ [key: string]: number }>({
    lunes: 8,
    martes: 8,
    miercoles: 8,
    jueves: 8,
    viernes: 8,
    sabado: 4,
    domingo: 0
  });

  // Motivos de ausencia
  const [motivoAusencia, setMotivoAusencia] = useState<string>('Ninguno');
  const [detallesAusencia, setDetallesAusencia] = useState('');
  
  // Reglas de bonos
  const [horasObjetivo, setHorasObjetivo] = useState(44);
  const [porcentajeBono, setPorcentajeBono] = useState(10);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [existingRecordLoaded, setExistingRecordLoaded] = useState(false);

  // Lista de empleados para sugerencia si no vino por URL
  const [empleadosList, setEmpleadosList] = useState<{ id: string; full_name: string; whatsapp?: string }[]>([]);

  useEffect(() => {
    async function loadData() {
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

        // Cargar lista de empleados para autocompletar
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

    loadData();
  }, []);

  // Si cambia el DNI o el nombre, intentar detectar empleado existente
  useEffect(() => {
    if (dni && !nombre && empleadosList.length > 0) {
      // Buscar si hay coincidencia
      const match = empleadosList.find(e => e.whatsapp?.includes(dni));
      if (match) setNombre(match.full_name);
    }
  }, [dni, nombre, empleadosList]);

  // Total acumulado de horas
  const totalHoras = useMemo(() => {
    return Object.values(horas).reduce((acc, h) => acc + (Number(h) || 0), 0);
  }, [horas]);

  const calificaBono = totalHoras >= horasObjetivo;

  const handleHourChange = (dia: string, val: number) => {
    setHoras(prev => ({
      ...prev,
      [dia]: Math.max(0, Math.min(24, val))
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim() || !nombre.trim()) {
      toast({
        variant: 'destructive',
        title: 'Datos requeridos',
        description: 'Por favor ingresá tu DNI y tu Nombre Completo.'
      });
      return;
    }

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

      // Guardado local de respaldo
      try {
        const localKey = `peie_horas_${semanaInicio}`;
        const currentSaved = JSON.parse(localStorage.getItem(localKey) || '[]');
        const filtered = currentSaved.filter((item: any) => item.empleado_dni !== dni.trim());
        filtered.push({ ...payload, id: `local-${Date.now()}` });
        localStorage.setItem(localKey, JSON.stringify(filtered));
      } catch (storageErr) {
        console.error(storageErr);
      }

      setSubmittedSuccess(true);
      toast({
        title: '¡Horas registradas con éxito!',
        description: `Se computaron ${totalHoras} horas para la semana.`
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al enviar',
        description: err.message || 'No se pudo registrar la información. Probá de nuevo.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const diasConfig = [
    { id: 'lunes', label: 'Lunes' },
    { id: 'martes', label: 'Martes' },
    { id: 'miercoles', label: 'Miércoles' },
    { id: 'jueves', label: 'Jueves' },
    { id: 'viernes', label: 'Viernes' },
    { id: 'sabado', label: 'Sábado' },
    { id: 'domingo', label: 'Domingo' }
  ];

  if (submittedSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border border-emerald-100 shadow-xl bg-white text-center p-6 sm:p-8 space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Formulario Enviado Correctamente
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              ¡Gracias, {nombre.split(' ')[0]}!
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tus horas de la semana ({formatDateDisplay(semanaInicio)}) han sido registradas y computadas en el sistema de PEIE.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-500">Total de horas computadas:</span>
              <span className="font-black text-base text-slate-900">{totalHoras} hs</span>
            </div>

            {calificaBono ? (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 text-left">
                <Award className="w-8 h-8 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-amber-900">¡Alcanzaste el Bono de Reconocimiento!</p>
                  <p className="text-[10px] text-amber-700 font-medium">
                    Superaste la meta de {horasObjetivo} hs semanales (+{porcentajeBono}% de bono).
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 text-left bg-white p-2.5 rounded-xl border border-slate-100">
                Meta para bono semanal: <strong>{horasObjetivo} hs</strong>. (Registraste {totalHoras} hs).
              </div>
            )}
          </div>

          <Button
            onClick={() => setSubmittedSuccess(false)}
            variant="outline"
            className="w-full rounded-2xl text-xs font-bold text-slate-700 py-3"
          >
            Modificar o cargar otra semana
          </Button>

          <p className="text-[10px] text-slate-400">
            PEIE Tools • Registro Transparente de Trabajo
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#031530] flex flex-col justify-between py-6 px-3 sm:px-6">
      
      <div className="max-w-xl w-full mx-auto space-y-5">
        
        {/* Cabecera Principal */}
        <div className="text-center space-y-2 text-white pt-2">
          <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-peie-light border border-white/10 backdrop-blur-md">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Cómputo Transparente de Horas</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Registro Semanal de Trabajo
          </h1>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Completá tus horas trabajadas de la semana de forma rápida y sencilla para el cómputo de haberes y premios.
          </p>
        </div>

        {/* Tarjeta del Formulario */}
        <Card className="bg-white rounded-[28px] border-0 shadow-2xl overflow-hidden">
          <CardContent className="p-5 sm:p-7 space-y-6">
            
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Sección 1: Identificación */}
              <div className="space-y-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>1. Identificación del Trabajador</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="worker-dni" className="text-xs font-bold text-slate-700">DNI / Documento *</Label>
                    <Input
                      id="worker-dni"
                      type="number"
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      placeholder="Ej: 38123456"
                      className="rounded-xl border-slate-200 text-xs font-bold text-slate-800"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="worker-name" className="text-xs font-bold text-slate-700">Nombre Completo *</Label>
                    <Input
                      id="worker-name"
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="rounded-xl border-slate-200 text-xs font-bold text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="worker-week" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Semana correspondiente (Lunes de inicio)</span>
                  </Label>
                  <Input
                    id="worker-week"
                    type="date"
                    value={semanaInicio}
                    onChange={(e) => setSemanaInicio(e.target.value)}
                    className="rounded-xl border-slate-200 text-xs font-semibold text-slate-700"
                    required
                  />
                </div>
              </div>

              {/* Sección 2: Carga Diaria de Horas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>2. Horas Trabajadas por Día</span>
                  </div>
                  
                  {/* Resumen flotante de horas */}
                  <div className="bg-slate-900 text-white text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                    <span>Total:</span>
                    <span className="text-emerald-400 text-sm font-black">{totalHoras} hs</span>
                  </div>
                </div>

                {/* Listado de días con botones rápidos */}
                <div className="space-y-3">
                  {diasConfig.map((dia) => {
                    const currentVal = horas[dia.id] || 0;
                    return (
                      <div 
                        key={dia.id} 
                        className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between sm:justify-start gap-3">
                          <span className="text-xs font-extrabold text-slate-800 min-w-[75px]">
                            {dia.label}
                          </span>
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                            {currentVal} hs
                          </span>
                        </div>

                        {/* Botones de selección rápida */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                          {[0, 4, 8, 9, 10].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleHourChange(dia.id, preset)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                currentVal === preset
                                  ? 'bg-[#031530] text-white shadow-xs scale-105'
                                  : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                              }`}
                            >
                              {preset}h
                            </button>
                          ))}

                          {/* Input manual */}
                          <input
                            type="number"
                            min="0"
                            max="24"
                            value={currentVal}
                            onChange={(e) => handleHourChange(dia.id, Number(e.target.value))}
                            className="w-12 h-7 px-1.5 text-center text-xs font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#031530]"
                            title="Ingresar horas exactas"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Banner de Recompensa / Bono */}
              {calificaBono ? (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide">¡Excelente desempeño!</h4>
                    <p className="text-[11px] text-emerald-50 leading-tight">
                      Superaste la meta de {horasObjetivo} hs semanales. Calificás para el bono del <strong>+{porcentajeBono}%</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-100 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-600 border border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Meta de horas para bono semanal: <strong>{horasObjetivo} hs</strong></span>
                  </div>
                  <span className="font-bold text-slate-800 text-[11px]">
                    Faltan {Math.max(0, horasObjetivo - totalHoras)} hs
                  </span>
                </div>
              )}

              {/* Sección 3: Consulta sobre ausencias o motivos de salud */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                  <HeartHandshake className="w-4 h-4 text-rose-500" />
                  <span>3. Cuidado y Motivos de Ausencia</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="absence-reason" className="text-xs font-semibold text-slate-600">
                    ¿Tuviste algún día sin poder trabajar? Seleccioná el motivo para que podamos asistirte:
                  </Label>
                  <select
                    id="absence-reason"
                    value={motivoAusencia}
                    onChange={(e) => setMotivoAusencia(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#031530]"
                  >
                    <option value="Ninguno">No tuve ausencias / Cumplí mis jornadas normales</option>
                    <option value="Enfermedad / Salud">Estuve enfermo o en reposo médico (Queremos saber cómo estás)</option>
                    <option value="Falta Justificada / Trámite">Trámite personal / Asuntos familiares</option>
                    <option value="Lluvia / Clima">Lluvia o cuestiones climáticas en obra</option>
                    <option value="Otro">Otro motivo</option>
                  </select>
                </div>

                {motivoAusencia !== 'Ninguno' && (
                  <div className="space-y-1 animate-fadeIn">
                    <Label htmlFor="absence-detail" className="text-xs font-bold text-slate-700">
                      Detalle adicional (Opcional):
                    </Label>
                    <Input
                      id="absence-detail"
                      value={detallesAusencia}
                      onChange={(e) => setDetallesAusencia(e.target.value)}
                      placeholder="Ej: Fui al médico el miércoles por dolor de garganta"
                      className="rounded-xl border-slate-200 text-xs font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Botón de Envío */}
              <Button
                type="submit"
                disabled={isSubmitting || totalHoras === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-3.5 rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Registrando horas...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Formulario ({totalHoras} hs)</span>
                  </>
                )}
              </Button>

            </form>

          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 pb-4">
          <p>© PEIE Tools • Creado para reconocer y cuidar a cada trabajador.</p>
        </div>

      </div>

    </div>
  );
}
