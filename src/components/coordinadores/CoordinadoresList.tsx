import React, { useState, useMemo } from 'react';
import type { CoordinadorProfile } from '../../types/coordinadores';
import { buildWhatsAppLink } from '../../lib/whatsapp';
import { 
  User, 
  Phone, 
  MapPin, 
  Building, 
  MessageCircle, 
  Search, 
  Edit2, 
  ShieldCheck,
  Shield,
  Truck,
  ExternalLink,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CoordinadoresListProps {
  coordinadores: CoordinadorProfile[];
  onEdit: (coordinador: CoordinadorProfile) => void;
  onSelectObraGantt?: (obraId: string) => void;
}

export default function CoordinadoresList({
  coordinadores,
  onEdit,
  onSelectObraGantt
}: CoordinadoresListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return coordinadores.filter(c => {
      const matchSearch = 
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.username && c.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.obra_name && c.obra_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchRole = roleFilter === 'all' || c.role.toLowerCase() === roleFilter.toLowerCase();

      return matchSearch && matchRole;
    });
  }, [coordinadores, searchTerm, roleFilter]);

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return (
          <Badge className="bg-purple-500/15 text-purple-700 border-purple-200 text-[11px] font-bold">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Administrador
          </Badge>
        );
      case 'logistica':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 border-amber-200 text-[11px] font-bold">
            <Truck className="w-3 h-3 mr-1" />
            Logística
          </Badge>
        );
      case 'encargado':
      case 'solicitante':
      case 'coordinador':
      default:
        return (
          <Badge className="bg-blue-500/15 text-blue-700 border-blue-200 text-[11px] font-bold">
            <Shield className="w-3 h-3 mr-1" />
            Coordinador de Obra
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, obra, teléfono o domicilio..."
            className="pl-9 rounded-xl border-slate-200 text-xs sm:text-sm bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            variant={roleFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('all')}
            className="rounded-xl text-xs h-8"
          >
            Todos ({coordinadores.length})
          </Button>
          <Button
            variant={roleFilter === 'admin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('admin')}
            className="rounded-xl text-xs h-8"
          >
            Admins
          </Button>
          <Button
            variant={roleFilter === 'solicitante' || roleFilter === 'encargado' || roleFilter === 'coordinador' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter(roleFilter === 'coordinador' ? 'all' : 'coordinador')}
            className="rounded-xl text-xs h-8"
          >
            Coordinadores
          </Button>
        </div>
      </div>

      {/* Grid of Coordinator Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-700">No se encontraron miembros del equipo.</p>
          <p className="text-xs text-slate-400 mt-1">Probá con otro término de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((coord) => {
            const rawPhone = coord.whatsapp || coord.phone;
            const waLink = rawPhone ? buildWhatsAppLink(rawPhone, `Hola ${coord.full_name}, te contacto desde PEIE Tools.`) : null;

            return (
              <div
                key={coord.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Row: Avatar, Name, Role */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center shrink-0">
                        {coord.photo_url ? (
                          <img
                            src={coord.photo_url}
                            alt={coord.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-lg flex items-center justify-center">
                            {coord.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate">
                          {coord.full_name}
                        </h4>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {getRoleBadge(coord.role)}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(coord)}
                      className="w-8 h-8 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0"
                      title="Editar Ficha"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Details List: Address, Worksite, Contact */}
                  <div className="mt-4 space-y-2 text-xs">
                    {/* Domicilio */}
                    <div className="flex items-start gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-700 block text-[11px]">Domicilio Particular:</span>
                        <span className="text-slate-600 truncate block">
                          {coord.address || <span className="text-slate-400 italic">No registrado</span>}
                        </span>
                      </div>
                    </div>

                    {/* Obra Asignada */}
                    <div className="flex items-start gap-2 text-slate-600 px-1">
                      <Building className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-700 block text-[11px]">Frente / Obra a Cargo:</span>
                        {coord.obra_name ? (
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 truncate">
                              {coord.obra_name}
                            </span>
                            {coord.obra_id && onSelectObraGantt && (
                              <button
                                type="button"
                                onClick={() => onSelectObraGantt(coord.obra_id!)}
                                className="text-[10px] text-blue-600 hover:underline font-semibold flex items-center gap-0.5 shrink-0"
                              >
                                Ver Gantt <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Supervisión general / Sin obra fija</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: WhatsApp & Call */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 px-3 text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 fill-white" />
                      WhatsApp
                    </a>
                  ) : (
                    <Button
                      variant="outline"
                      disabled
                      className="flex-1 rounded-xl py-2 px-3 text-xs text-slate-400"
                    >
                      Sin WhatsApp
                    </Button>
                  )}

                  {coord.phone && (
                    <a
                      href={`tel:${coord.phone.replace(/[^0-9+]/g, '')}`}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl transition-colors shrink-0"
                      title="Llamar"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(coord)}
                    className="rounded-xl text-xs px-2.5 h-8 text-slate-600 hover:text-blue-600"
                  >
                    Editar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
