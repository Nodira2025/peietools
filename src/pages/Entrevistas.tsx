import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Candidato, CandidatoStatus } from '../types/entrevistas';
import { cvParserService } from '../services/entrevistas/cvParserService';
import { calculateHaversineDistance } from '../services/geo/haversine';
import { buildWhatsAppLink } from '../lib/whatsapp';
import {
  Users,
  Search,
  Filter,
  MapPin,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  Star,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  Share2,
  ExternalLink,
  MessageCircle,
  Building,
  Sparkles,
  Sliders,
  Award,
  ChevronRight,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<CandidatoStatus, { label: string; bg: string; text: string; border: string }> = {
  'Nuevo': { label: 'Nuevo', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'A Contactar': { label: 'A Contactar', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Entrevista Programada': { label: 'Entrevista Agendada', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Aprobado': { label: 'Aprobado', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Contratado': { label: 'Contratado (En Nómina)', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  'Descartado': { label: 'Descartado', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' }
};

export default function Entrevistas() {
  const { toast } = useToast();

  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [obras, setObras] = useState<{ id: string; name: string; latitude?: number | null; longitude?: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [selectedTargetObraId, setSelectedTargetObraId] = useState<string>('any');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(15);
  const [enableDistanceFilter, setEnableDistanceFilter] = useState(false);
  const [minAge, setMinAge] = useState<string>('');
  const [maxAge, setMaxAge] = useState<string>('');

  // Modals state
  const [selectedCandidato, setSelectedCandidato] = useState<Candidato | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const [hireObraId, setHireObraId] = useState<string>('none');
  const [actionLoading, setActionLoading] = useState(false);

  // Edit fields inside detail modal
  const [editStatus, setEditStatus] = useState<CandidatoStatus>('Nuevo');
  const [editInterviewDate, setEditInterviewDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRating, setEditRating] = useState<number>(0);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [candData, obrasRes] = await Promise.all([
        cvParserService.getCandidatos(),
        supabase.from('obras').select('id, name, latitude, longitude').eq('active', true).order('name')
      ]);

      setCandidatos(candData);
      setObras(obrasRes.data || []);
      if ((obrasRes.data || []).length > 0 && selectedTargetObraId === 'any') {
        setSelectedTargetObraId(obrasRes.data![0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const targetObra = useMemo(() => {
    return obras.find(o => o.id === selectedTargetObraId) || null;
  }, [obras, selectedTargetObraId]);

  // Candidates with computed distance to currently selected target obra
  const candidatesWithProximity = useMemo(() => {
    return candidatos.map(cand => {
      let distToTarget: number | null = null;
      if (targetObra && typeof targetObra.latitude === 'number' && typeof targetObra.longitude === 'number' && typeof cand.latitude === 'number' && typeof cand.longitude === 'number') {
        const d = calculateHaversineDistance(
          { latitude: cand.latitude, longitude: cand.longitude },
          { latitude: targetObra.latitude, longitude: targetObra.longitude }
        );
        distToTarget = Math.round(d * 10) / 10;
      }
      return {
        ...cand,
        distToTarget
      };
    });
  }, [candidatos, targetObra]);

  // Filtered candidates
  const filteredCandidatos = useMemo(() => {
    return candidatesWithProximity.filter(cand => {
      // Search
      const text = `${cand.full_name} ${cand.specialty_title} ${cand.phone} ${cand.address || ''} ${cand.locality || ''} ${cand.cv_text_summary || ''}`.toLowerCase();
      if (searchTerm.trim() && !text.includes(searchTerm.toLowerCase())) return false;

      // Status
      if (statusFilter !== 'all' && cand.status !== statusFilter) return false;

      // Specialty
      if (specialtyFilter !== 'all' && !cand.specialty_title.toLowerCase().includes(specialtyFilter.toLowerCase())) return false;

      // Age range
      if (minAge && cand.age && cand.age < Number(minAge)) return false;
      if (maxAge && cand.age && cand.age > Number(maxAge)) return false;

      // Distance filter
      if (enableDistanceFilter && cand.distToTarget !== null) {
        if (cand.distToTarget > maxDistanceKm) return false;
      }

      return true;
    });
  }, [candidatesWithProximity, searchTerm, statusFilter, specialtyFilter, minAge, maxAge, enableDistanceFilter, maxDistanceKm]);

  // KPIs
  const kpis = useMemo(() => {
    const total = candidatos.length;
    const nuevos = candidatos.filter(c => c.status === 'Nuevo').length;
    const agendados = candidatos.filter(c => c.status === 'Entrevista Programada').length;
    const contratados = candidatos.filter(c => c.status === 'Contratado').length;
    return { total, nuevos, agendados, contratados };
  }, [candidatos]);

  // Unique specialties for filter dropdown
  const specialtiesList = useMemo(() => {
    const set = new Set(candidatos.map(c => c.specialty_title).filter(Boolean));
    return Array.from(set);
  }, [candidatos]);

  const handleOpenDetail = (cand: Candidato) => {
    setSelectedCandidato(cand);
    setEditStatus(cand.status);
    setEditInterviewDate(cand.interview_date ? cand.interview_date.split('T')[0] : '');
    setEditNotes(cand.interview_notes || '');
    setEditRating(cand.rating || 0);
    setIsDetailModalOpen(true);
  };

  const handleSaveDetail = async () => {
    if (!selectedCandidato) return;
    setActionLoading(true);
    try {
      await cvParserService.updateCandidato(selectedCandidato.id, {
        status: editStatus,
        interview_date: editInterviewDate || null,
        interview_notes: editNotes.trim() || null,
        rating: editRating
      });
      toast({ title: 'Candidato Actualizado', description: 'Se guardaron los cambios del proceso.' });
      setIsDetailModalOpen(false);
      fetchAll();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenHire = (cand: Candidato) => {
    setSelectedCandidato(cand);
    setHireObraId(selectedTargetObraId !== 'any' ? selectedTargetObraId : 'none');
    setIsHireModalOpen(true);
  };

  const handleConfirmHire = async () => {
    if (!selectedCandidato) return;
    setActionLoading(true);
    try {
      const targetId = hireObraId === 'none' ? null : hireObraId;
      await cvParserService.hireCandidato(selectedCandidato, targetId);
      toast({
        title: '¡Candidato Contratado!',
        description: `${selectedCandidato.full_name} fue incorporado a la nómina de trabajadores.`
      });
      setIsHireModalOpen(false);
      setIsDetailModalOpen(false);
      fetchAll();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al Contratar', description: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  const copyPublicLink = () => {
    const url = `${window.location.origin}/postulacion`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Enlace Copiado',
      description: 'Compartí este enlace con los postulantes para que carguen su CV.'
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#031530] to-[#042454] rounded-3xl p-5 sm:p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-blue-400/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-400" />
              Recursos Humanos & Selección
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Entrevistas & Banco de Currículums
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Filtrá candidatos con extracción asistida por IA, ordenamiento por cercanía a obras en Tucumán y citación directa por WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={copyPublicLink}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-2xl text-xs font-semibold h-10 shadow-sm flex items-center gap-1.5"
          >
            <Share2 className="w-4 h-4" />
            Copiar Link de Postulación
          </Button>

          <a
            href="/postulacion"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-2 text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir Formulario
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Postulantes</span>
          <span className="text-3xl font-black text-slate-900 mt-1">{kpis.total}</span>
          <span className="text-xs text-slate-400 mt-1">en base de datos</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Nuevos Sin Revisar</span>
          <span className="text-3xl font-black text-blue-600 mt-1">{kpis.nuevos}</span>
          <span className="text-xs text-slate-400 mt-1">pendientes de contacto</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Entrevistas Agendadas</span>
          <span className="text-3xl font-black text-purple-600 mt-1">{kpis.agendados}</span>
          <span className="text-xs text-slate-400 mt-1">en proceso activo</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Contratados</span>
          <span className="text-3xl font-black text-emerald-600 mt-1">{kpis.contratados}</span>
          <span className="text-xs text-slate-400 mt-1">incorporados a obra</span>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, especialidad, teléfono, barrio o habilidad técnica..."
              className="pl-9 rounded-2xl border-slate-200 text-xs sm:text-sm"
            />
          </div>

          {/* Specialty Dropdown */}
          <div className="w-full md:w-56">
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="rounded-2xl border-slate-200 text-xs font-semibold">
                <SelectValue placeholder="Oficio / Especialidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los oficios</SelectItem>
                {specialtiesList.map((spec, i) => (
                  <SelectItem key={i} value={spec} className="text-xs">
                    {spec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Dropdown */}
          <div className="w-full md:w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-2xl border-slate-200 text-xs font-semibold">
                <SelectValue placeholder="Estado de selección" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.keys(STATUS_CONFIG).map((st) => (
                  <SelectItem key={st} value={st} className="text-xs">
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Proximity & Distance Slider Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-50/70 p-3.5 rounded-2xl">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Distancia a Obra:</span>
              <Select value={selectedTargetObraId} onValueChange={setSelectedTargetObraId}>
                <SelectTrigger className="rounded-xl border-slate-200 text-xs font-semibold bg-white w-48 sm:w-56">
                  <SelectValue placeholder="Seleccionar obra..." />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={enableDistanceFilter}
                onChange={(e) => setEnableDistanceFilter(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Filtrar por radio máximo</span>
            </label>

            {enableDistanceFilter && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="2"
                  max="35"
                  step="1"
                  value={maxDistanceKm}
                  onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
                  className="w-28 sm:w-36 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-xs font-black text-blue-700 min-w-[50px]">
                  &lt; {maxDistanceKm} km
                </span>
              </div>
            )}

            {/* Age Range Inputs */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Edad:</span>
              <Input
                type="number"
                placeholder="Mín"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                className="w-14 h-8 text-xs rounded-lg border-slate-200 p-1 text-center"
              />
              <span>-</span>
              <Input
                type="number"
                placeholder="Máx"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                className="w-14 h-8 text-xs rounded-lg border-slate-200 p-1 text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Cards Grid */}
      {filteredCandidatos.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200/80 shadow-sm">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No hay postulantes con los filtros seleccionados</h3>
          <p className="text-xs text-slate-400 mt-1">
            Probá ampliando el radio de distancia o limpiando los criterios de búsqueda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidatos.map((cand) => {
            const statusStyle = STATUS_CONFIG[cand.status] || STATUS_CONFIG['Nuevo'];
            const waInviteMsg = `Hola ${cand.full_name}, nos comunicamos desde Recursos Humanos de PEIE respecto a tu postulación como ${cand.specialty_title}. Quisiéramos coordinar una entrevista de trabajo. ¿Tenés disponibilidad?`;
            const waLink = cand.phone ? buildWhatsAppLink(cand.phone, waInviteMsg) : null;

            return (
              <div
                key={cand.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header: Avatar, Name, Specialty */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50 flex items-center justify-center shrink-0 shadow-sm">
                        {cand.photo_url ? (
                          <img src={cand.photo_url} alt={cand.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-lg flex items-center justify-center">
                            {cand.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate">
                          {cand.full_name}
                        </h4>
                        <span className="text-xs font-semibold text-blue-700 block truncate mt-0.5">
                          {cand.specialty_title}
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          {cand.age && <span>{cand.age} años</span>}
                          {cand.years_experience !== undefined && (
                            <>
                              <span>•</span>
                              <span>{cand.years_experience} años exp.</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Badge className={`${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border text-[10px] font-bold shrink-0`}>
                      {statusStyle.label}
                    </Badge>
                  </div>

                  {/* Proximity Pill to Selected Worksite */}
                  <div className="mt-3.5 bg-blue-50/60 p-2.5 rounded-2xl border border-blue-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-blue-900 font-semibold truncate">
                      <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">
                        {targetObra?.name || 'Obra cercana'}
                      </span>
                    </div>

                    <span className="font-black text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200 text-[11px] shrink-0">
                      {cand.distToTarget !== null ? `${cand.distToTarget} km` : (cand.nearest_obra_distance_km ? `${cand.nearest_obra_distance_km} km` : 'Tucumán')}
                    </span>
                  </div>

                  {/* Residence & Summary */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate">
                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                      <span className="truncate">{cand.address || cand.locality || 'Tucumán'}</span>
                    </div>

                    {cand.cv_text_summary && (
                      <p className="text-slate-600 text-xs line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-100 italic">
                        &quot;{cand.cv_text_summary}&quot;
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 px-3 text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                      title="Contactar para entrevista"
                    >
                      <MessageCircle className="w-4 h-4 fill-white" />
                      Citar WhatsApp
                    </a>
                  ) : (
                    <Button variant="outline" disabled className="flex-1 text-xs text-slate-400 rounded-xl">
                      Sin Teléfono
                    </Button>
                  )}

                  {cand.status !== 'Contratado' && (
                    <Button
                      onClick={() => handleOpenHire(cand)}
                      className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold px-3 shadow-sm flex items-center gap-1"
                      title="Contratar e incorporar a nómina"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Contratar
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => handleOpenDetail(cand)}
                    className="rounded-xl text-xs text-slate-600 px-3"
                  >
                    Ver Ficha
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detalle / Seguimiento de Candidato */}
      {selectedCandidato && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-lg w-full rounded-3xl p-6 bg-white border border-slate-200">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50 flex items-center justify-center shrink-0">
                  {selectedCandidato.photo_url ? (
                    <img src={selectedCandidato.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-slate-900">
                    {selectedCandidato.full_name}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-blue-600">
                    {selectedCandidato.specialty_title} • {selectedCandidato.age || 'S/E'} años
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="font-semibold text-slate-400 block text-[10px]">TELÉFONO:</span>
                  <span className="font-bold text-slate-800">{selectedCandidato.phone}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block text-[10px]">DNI:</span>
                  <span className="font-bold text-slate-800">{selectedCandidato.dni || 'No registrado'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block text-[10px]">DOMICILIO:</span>
                  <span className="font-bold text-slate-800">{selectedCandidato.address || selectedCandidato.locality || 'Tucumán'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block text-[10px]">ESTUDIOS:</span>
                  <span className="font-bold text-slate-800">{selectedCandidato.education_level || 'Técnico'}</span>
                </div>
              </div>

              {/* AI Summary */}
              {selectedCandidato.cv_text_summary && (
                <div className="space-y-1">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Resumen Profesional (Extraído por IA):
                  </span>
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-slate-700 italic">
                    {selectedCandidato.cv_text_summary}
                  </div>
                </div>
              )}

              {/* Status & Process Management */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Estado en Selección</Label>
                  <Select value={editStatus} onValueChange={(val: CandidatoStatus) => setEditStatus(val)}>
                    <SelectTrigger className="rounded-xl border-slate-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STATUS_CONFIG).map((st) => (
                        <SelectItem key={st} value={st} className="text-xs">
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Fecha de Entrevista</Label>
                  <Input
                    type="date"
                    value={editInterviewDate}
                    onChange={(e) => setEditInterviewDate(e.target.value)}
                    className="rounded-xl border-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Notas de Entrevista / Evaluación Técnica</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Anotaciones sobre disponibilidad, aptitudes técnicas, expectativas salariales..."
                  rows={2}
                  className="rounded-xl border-slate-200 text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setIsDetailModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cerrar
              </Button>
              <Button
                onClick={handleSaveDetail}
                disabled={actionLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                {actionLoading ? 'Guardando...' : 'Guardar Proceso'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Contratar -> Asignar a Empleados */}
      {selectedCandidato && (
        <Dialog open={isHireModalOpen} onOpenChange={setIsHireModalOpen}>
          <DialogContent className="max-w-md w-full rounded-3xl p-6 bg-white border border-slate-200">
            <DialogHeader>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-1">
                <UserCheck className="w-6 h-6" />
              </div>
              <DialogTitle className="text-lg font-black text-slate-900">
                Confirmar Contratación
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Al confirmar, <span className="font-bold text-slate-800">{selectedCandidato.full_name}</span> se transferirá automáticamente a la nómina de personal de PEIE.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Asignar a Frente de Obra</Label>
                <Select value={hireObraId} onValueChange={setHireObraId}>
                  <SelectTrigger className="rounded-xl border-slate-200 text-xs font-semibold">
                    <SelectValue placeholder="Seleccionar obra de destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Dejar como "Libre" (Sin obra asignada)</SelectItem>
                    {obras.map((o) => (
                      <SelectItem key={o.id} value={o.id} className="text-xs">
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-100 text-teal-800 text-[11px] space-y-1">
                <span className="font-bold block">Se transferirán los siguientes datos:</span>
                <div>• Nombre: {selectedCandidato.full_name}</div>
                <div>• Puesto / Especialidad: {selectedCandidato.specialty_title}</div>
                <div>• Teléfono WhatsApp: {selectedCandidato.phone}</div>
                <div>• Foto de perfil comprimida</div>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setIsHireModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmHire}
                disabled={actionLoading}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                {actionLoading ? 'Procesando...' : 'Confirmar e Incorporar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
