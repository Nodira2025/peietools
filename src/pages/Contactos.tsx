import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Phone, 
  Search, 
  Plus, 
  Copy, 
  Check, 
  ExternalLink, 
  Building2, 
  Store, 
  UserCheck, 
  MessageCircle, 
  Trash2, 
  Sparkles,
  PhoneCall,
  Globe,
  MapPin
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { buildWhatsAppLink } from '../lib/whatsapp';

export interface ContactoSocialLinks {
  website?: string;
  instagram?: string;
  facebook?: string;
  maps?: string;
}

export interface ContactoProveedor {
  id: string;
  name: string;
  phone: string;
  cleanPhone: string;
  category: 'ferreteria' | 'comercial' | 'vendedor' | 'otro';
  categoryLabel: string;
  description?: string;
  address?: string;
  isCustom?: boolean;
  socials?: ContactoSocialLinks;
}

const DEFAULT_PROVEEDORES: ContactoProveedor[] = [
  {
    id: 'prov-1',
    name: 'Ferretería Lamadrid',
    phone: '+54 9 3816 82-0304',
    cleanPhone: '5493816820304',
    category: 'ferreteria',
    categoryLabel: 'Ferretería e Insumos',
    description: 'Ferretería y artículos de limpieza / obra con entrega a domicilio (Lamadrid / Más Limpio).',
    address: 'Lamadrid 1302, San Miguel de Tucumán',
    socials: {
      facebook: 'https://www.facebook.com/people/Mas-Limpio/100063717589634/',
      maps: 'https://maps.google.com/?q=Ferreteria+Lamadrid+Lamadrid+1302+San+Miguel+de+Tucuman'
    }
  },
  {
    id: 'prov-2',
    name: 'Comercial Colon',
    phone: '+54 9 3813 01-2736',
    cleanPhone: '5493813012736',
    category: 'comercial',
    categoryLabel: 'Comercial y Materiales',
    description: 'Ferretería industrial, herramientas eléctricas y manuales, andamios, seguridad industrial y materiales de obra.',
    address: 'Av. Colón 111, San Miguel de Tucumán',
    socials: {
      website: 'https://comercialcolon.com.ar',
      instagram: 'https://www.instagram.com/comercial.colon',
      facebook: 'https://www.facebook.com/comercial.colon',
      maps: 'https://maps.google.com/?q=Comercial+Colon+Av+Colon+111+San+Miguel+de+Tucuman'
    }
  },
  {
    id: 'prov-3',
    name: 'Bp Vendedor Pablo Fernandez',
    phone: '+54 9 3813 19-5555',
    cleanPhone: '5493813195555',
    category: 'vendedor',
    categoryLabel: 'Vendedor BP / Distribuidor',
    description: 'Venta mayorista y atención técnica en materiales eléctricos e iluminación (BP Soluciones Eléctricas).',
    address: 'San Martín 1301, San Miguel de Tucumán',
    socials: {
      website: 'https://bpsolucioneselectricas.com.ar',
      instagram: 'https://www.instagram.com/bpsolucioneselectricas',
      facebook: 'https://www.facebook.com/BPsolucioneselectricas',
      maps: 'https://maps.google.com/?q=BP+Soluciones+Electricas+San+Martin+1301+San+Miguel+de+Tucuman'
    }
  }
];

const DEFAULT_MESSAGE_TEMPLATE = 'Hola, ¿Como estas?';

export default function Contactos() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Almacenamiento de contactos personalizados agregados por el usuario
  const [customContacts, setCustomContacts] = useState<ContactoProveedor[]>(() => {
    try {
      const saved = localStorage.getItem('peie_custom_contactos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal para agregar nuevo contacto
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCategory, setNewCategory] = useState<'ferreteria' | 'comercial' | 'vendedor' | 'otro'>('ferreteria');
  const [newDescription, setNewDescription] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newInstagram, setNewInstagram] = useState('');
  const [newFacebook, setNewFacebook] = useState('');

  // Modal para mensaje de WhatsApp personalizado
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [activeContactForMessage, setActiveContactForMessage] = useState<ContactoProveedor | null>(null);
  const [customMessage, setCustomMessage] = useState(DEFAULT_MESSAGE_TEMPLATE);

  // Lista combinada de proveedores
  const allContacts = useMemo(() => {
    return [...DEFAULT_PROVEEDORES, ...customContacts];
  }, [customContacts]);

  // Filtro de búsqueda y categoría
  const filteredContacts = useMemo(() => {
    return allContacts.filter(c => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = 
        c.name.toLowerCase().includes(s) ||
        c.phone.includes(s) ||
        c.cleanPhone.includes(s) ||
        (c.description && c.description.toLowerCase().includes(s)) ||
        (c.address && c.address.toLowerCase().includes(s)) ||
        (c.socials?.website && c.socials.website.toLowerCase().includes(s)) ||
        (c.socials?.instagram && c.socials.instagram.toLowerCase().includes(s)) ||
        (c.socials?.facebook && c.socials.facebook.toLowerCase().includes(s)) ||
        c.categoryLabel.toLowerCase().includes(s);
      
      const matchesCategory = selectedCategory === 'todos' || c.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allContacts, searchTerm, selectedCategory]);

  const handleSendWhatsApp = (contact: ContactoProveedor, message: string = DEFAULT_MESSAGE_TEMPLATE) => {
    const link = buildWhatsAppLink(contact.cleanPhone, message);
    window.open(link, '_blank');
    toast({
      title: 'WhatsApp Abierto',
      description: `Iniciando chat con ${contact.name}...`
    });
  };

  const handleOpenCustomMessageModal = (contact: ContactoProveedor) => {
    setActiveContactForMessage(contact);
    setCustomMessage(DEFAULT_MESSAGE_TEMPLATE);
    setIsMessageModalOpen(true);
  };

  const handleCopyPhone = (contact: ContactoProveedor) => {
    navigator.clipboard.writeText(contact.phone);
    setCopiedId(contact.id);
    toast({
      title: 'Teléfono copiado',
      description: `${contact.phone} copiado al portapapeles.`
    });
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const formatUrl = (url: string, type: 'web' | 'ig' | 'fb') => {
    if (!url || !url.trim()) return '';
    let clean = url.trim();
    if (type === 'ig') {
      if (clean.startsWith('@')) clean = clean.substring(1);
      if (!clean.includes('instagram.com')) return `https://www.instagram.com/${clean}`;
    }
    if (type === 'fb') {
      if (!clean.includes('facebook.com')) return `https://www.facebook.com/${clean}`;
    }
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      return `https://${clean}`;
    }
    return clean;
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos requeridos',
        description: 'Por favor completá el nombre y teléfono del proveedor.'
      });
      return;
    }

    const clean = newPhone.replace(/[^0-9]/g, '');
    if (clean.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Teléfono inválido',
        description: 'Ingresá un número de teléfono válido (ej: +54 9 381...)'
      });
      return;
    }

    let categoryLabel = 'Proveedor';
    if (newCategory === 'ferreteria') categoryLabel = 'Ferretería e Insumos';
    else if (newCategory === 'comercial') categoryLabel = 'Comercial y Materiales';
    else if (newCategory === 'vendedor') categoryLabel = 'Vendedor / Asesor';

    const socials: ContactoSocialLinks = {};
    if (newWebsite.trim()) socials.website = formatUrl(newWebsite, 'web');
    if (newInstagram.trim()) socials.instagram = formatUrl(newInstagram, 'ig');
    if (newFacebook.trim()) socials.facebook = formatUrl(newFacebook, 'fb');
    if (newAddress.trim()) {
      socials.maps = `https://maps.google.com/?q=${encodeURIComponent(newAddress.trim() + ' Tucuman')}`;
    }

    const newContact: ContactoProveedor = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      phone: newPhone.trim(),
      cleanPhone: clean,
      category: newCategory,
      categoryLabel,
      description: newDescription.trim() || undefined,
      address: newAddress.trim() || undefined,
      socials: Object.keys(socials).length > 0 ? socials : undefined,
      isCustom: true
    };

    const updated = [...customContacts, newContact];
    setCustomContacts(updated);
    try {
      localStorage.setItem('peie_custom_contactos', JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving contact to localStorage', err);
    }

    toast({
      title: 'Contacto Guardado',
      description: `${newContact.name} se agregó a tu lista de proveedores.`
    });

    setNewName('');
    setNewPhone('');
    setNewCategory('ferreteria');
    setNewDescription('');
    setNewAddress('');
    setNewWebsite('');
    setNewInstagram('');
    setNewFacebook('');
    setIsAddModalOpen(false);
  };

  const handleDeleteCustomContact = (id: string) => {
    const updated = customContacts.filter(c => c.id !== id);
    setCustomContacts(updated);
    try {
      localStorage.setItem('peie_custom_contactos', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    toast({
      title: 'Contacto eliminado',
      description: 'El proveedor ha sido quitado de la lista.'
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ferreteria':
        return <Store className="w-4 h-4 text-amber-600" />;
      case 'comercial':
        return <Building2 className="w-4 h-4 text-blue-600" />;
      case 'vendedor':
        return <UserCheck className="w-4 h-4 text-emerald-600" />;
      default:
        return <Store className="w-4 h-4 text-purple-600" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'ferreteria':
        return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'comercial':
        return 'bg-blue-50 text-blue-800 border-blue-200/80';
      case 'vendedor':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      default:
        return 'bg-purple-50 text-purple-800 border-purple-200/80';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
      {/* Header Superior */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#031530] to-[#042454] text-white p-5 md:p-6 rounded-3xl shadow-lg border border-slate-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-peie-light/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Directorio y Redes
            </span>
            <span className="text-xs text-slate-300 font-medium">
              ({allContacts.length} proveedores verificados)
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
            Contactos y Proveedores
          </h1>
          <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
            Comunicate al instante vía WhatsApp, consultá sus catálogos web, redes sociales oficiales (Instagram / Facebook) o accedé a su ubicación.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl px-4 py-2.5 shadow-md hover:shadow-emerald-600/20 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Agregar Proveedor</span>
          </Button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, teléfono, web o red social..."
            className="pl-10 pr-4 py-2 text-xs rounded-xl border-slate-200 focus-visible:ring-[#031530] font-medium bg-slate-50/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'ferreteria', label: 'Ferreterías' },
            { id: 'comercial', label: 'Comerciales' },
            { id: 'vendedor', label: 'Vendedores' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#031530] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Tarjetas de Proveedores */}
      {filteredContacts.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-xs space-y-3">
          <Store className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">No se encontraron contactos</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Probá ajustando el término de búsqueda o seleccioná otra categoría.
          </p>
          <Button
            variant="outline"
            onClick={() => { setSearchTerm(''); setSelectedCategory('todos'); }}
            className="rounded-xl text-xs font-semibold"
          >
            Restablecer filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredContacts.map((contact) => {
            const isCopied = copiedId === contact.id;
            const hasSocials = contact.socials && (
              contact.socials.website || 
              contact.socials.instagram || 
              contact.socials.facebook || 
              contact.socials.maps ||
              contact.address
            );

            return (
              <Card 
                key={contact.id} 
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Top: Icon + Badge + Menu */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 rounded-2xl bg-slate-100 group-hover:bg-blue-50 border border-slate-200/60 group-hover:border-blue-100 flex items-center justify-center shrink-0 transition-colors">
                          {getCategoryIcon(contact.category)}
                        </div>
                        <div>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-tight ${getCategoryBadgeClass(contact.category)}`}>
                            {contact.categoryLabel}
                          </span>
                        </div>
                      </div>

                      {contact.isCustom && (
                        <button
                          onClick={() => handleDeleteCustomContact(contact.id)}
                          className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg transition-colors"
                          title="Eliminar contacto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Nombre y Descripción */}
                    <div>
                      <h3 className="text-base font-black text-slate-900 leading-snug group-hover:text-[#031530] transition-colors">
                        {contact.name}
                      </h3>
                      {contact.description && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                          {contact.description}
                        </p>
                      )}
                    </div>

                    {/* Dirección / Ubicación */}
                    {contact.address && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-100">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate">{contact.address}</span>
                      </div>
                    )}

                    {/* Caja de Teléfono */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-xs font-extrabold text-slate-800 tracking-wide font-mono">
                          {contact.phone}
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopyPhone(contact)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200/60 transition-colors flex items-center gap-1 text-[11px] font-bold"
                        title="Copiar número"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] text-emerald-600 font-bold">Copiado</span>
                          </>
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Redes Sociales y Sitio Web (Debajo del WhatsApp/Teléfono) */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
                    {/* Botón Principal: WhatsApp con plantilla "Hola, ¿Como estas?" */}
                    <Button
                      onClick={() => handleSendWhatsApp(contact, DEFAULT_MESSAGE_TEMPLATE)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-98 transition-all"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.09-3.846c1.62.963 3.426 1.47 5.278 1.471 5.516 0 10.01-4.498 10.014-10.02.002-2.673-1.04-5.187-2.936-7.086-1.897-1.9-4.411-2.946-7.083-2.947-5.525 0-10.02 4.5-10.024 10.022-.002 1.737.452 3.427 1.316 4.939l-1.002 3.66 3.737-.98zm11.378-7.79c-.3-.15-1.77-.874-2.045-.975-.276-.1-.476-.15-.676.15-.2.3-.775.975-.95 1.174-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.79-1.487-1.77-1.663-2.07-.175-.3-.019-.461.13-.61.135-.133.3-.349.45-.523.15-.174.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.676-1.625-.925-2.225-.244-.595-.513-.51-.676-.51-.162-.008-.349-.01-.536-.01-.187 0-.49.07-.747.349-.257.276-.98.958-.98 2.337s1.003 2.707 1.143 2.894c.14.188 1.974 3.014 4.782 4.228.668.288 1.19.46 1.597.59.672.214 1.28.184 1.762.11.536-.08 1.77-.724 2.02-1.388.25-.664.25-1.233.175-1.353-.075-.12-.275-.22-.575-.37z"/>
                      </svg>
                      <span>Enviar WhatsApp</span>
                    </Button>

                    {/* Botones secundarios: Llamar y Editar texto */}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
                        <span>Llamar</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleOpenCustomMessageModal(contact)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Editar texto</span>
                      </button>
                    </div>

                    {/* 🌐 Canales Digitales y Redes Sociales */}
                    {hasSocials && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                        {/* Sitio Web Oficial */}
                        {contact.socials?.website && (
                          <a
                            href={contact.socials.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 text-[11px] font-bold transition-all"
                            title="Visitar sitio web oficial"
                          >
                            <Globe className="w-3.5 h-3.5 text-sky-600" />
                            <span>Web</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        )}

                        {/* Instagram */}
                        {contact.socials?.instagram && (
                          <a
                            href={contact.socials.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 text-pink-800 hover:bg-pink-100 border border-pink-200 text-[11px] font-bold transition-all"
                            title="Ver perfil de Instagram"
                          >
                            <svg className="w-3.5 h-3.5 fill-pink-600" viewBox="0 0 24 24">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                            </svg>
                            <span>Instagram</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        )}

                        {/* Facebook */}
                        {contact.socials?.facebook && (
                          <a
                            href={contact.socials.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 text-[11px] font-bold transition-all"
                            title="Ver página de Facebook"
                          >
                            <svg className="w-3.5 h-3.5 fill-blue-600" viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                            <span>Facebook</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        )}

                        {/* Google Maps / Ubicación */}
                        {contact.socials?.maps && (
                          <a
                            href={contact.socials.maps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold transition-all"
                            title="Abrir ubicación en Google Maps"
                          >
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Maps</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal para Agregar Nuevo Proveedor */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              <span>Nuevo Proveedor o Contacto</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registrá un nuevo contacto de proveedor con sus teléfonos, redes sociales y sitio web.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddContact} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="prov-name" className="text-xs font-bold text-slate-700">Nombre del Proveedor / Empresa *</Label>
              <Input
                id="prov-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Distribuidora Eléctrica Norte"
                className="rounded-xl border-slate-200 text-xs font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="prov-phone" className="text-xs font-bold text-slate-700">Teléfono / WhatsApp *</Label>
                <Input
                  id="prov-phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Ej: +54 9 381 400-0000"
                  className="rounded-xl border-slate-200 text-xs font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="prov-category" className="text-xs font-bold text-slate-700">Rubro / Categoría</Label>
                <select
                  id="prov-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-medium bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#031530]"
                >
                  <option value="ferreteria">Ferretería e Insumos</option>
                  <option value="comercial">Comercial y Materiales</option>
                  <option value="vendedor">Vendedor / Distribuidor</option>
                  <option value="otro">Otro Proveedor</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prov-address" className="text-xs font-bold text-slate-700">Dirección / Localidad (Opcional)</Label>
              <Input
                id="prov-address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Ej: Av. Belgrano 1500, Tucumán"
                className="rounded-xl border-slate-200 text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prov-desc" className="text-xs font-bold text-slate-700">Notas / Descripción (Opcional)</Label>
              <Input
                id="prov-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Ej: Especialistas en iluminación LED y cables"
                className="rounded-xl border-slate-200 text-xs font-medium"
              />
            </div>

            {/* Sección Redes Sociales y Web */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                🌐 Canales Digitales y Redes Sociales
              </p>

              <div className="space-y-1">
                <Label htmlFor="prov-web" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-sky-600" />
                  <span>Sitio Web Oficial</span>
                </Label>
                <Input
                  id="prov-web"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="Ej: www.proveedor.com.ar"
                  className="rounded-xl border-slate-200 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="prov-ig" className="text-xs font-bold text-slate-700">Instagram</Label>
                  <Input
                    id="prov-ig"
                    value={newInstagram}
                    onChange={(e) => setNewInstagram(e.target.value)}
                    placeholder="Ej: @proveedortucuman"
                    className="rounded-xl border-slate-200 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="prov-fb" className="text-xs font-bold text-slate-700">Facebook</Label>
                  <Input
                    id="prov-fb"
                    value={newFacebook}
                    onChange={(e) => setNewFacebook(e.target.value)}
                    placeholder="Ej: Proveedor SRL Tucumán"
                    className="rounded-xl border-slate-200 text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold px-5"
              >
                Guardar Contacto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para Personalizar Mensaje de WhatsApp */}
      <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
              <span>Mensaje para {activeContactForMessage?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Elegí una plantilla rápida o editá el mensaje que se enviará por WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCustomMessage('Hola, ¿Como estas?')}
                className="text-[11px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                👋 Hola, ¿Como estas?
              </button>
              <button
                type="button"
                onClick={() => setCustomMessage('Hola, ¿Como estas? Te consulto si tienen stock disponible.')}
                className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                📦 Consultar Stock
              </button>
              <button
                type="button"
                onClick={() => setCustomMessage('Hola, ¿Como estas? Te escribo de PEIE para solicitar un presupuesto.')}
                className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                📄 Pedir Presupuesto
              </button>
            </div>

            <div className="space-y-1">
              <Label htmlFor="custom-msg-text" className="text-xs font-bold text-slate-700">Texto del mensaje</Label>
              <textarea
                id="custom-msg-text"
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                placeholder="Escribí el mensaje..."
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMessageModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (activeContactForMessage) {
                    handleSendWhatsApp(activeContactForMessage, customMessage);
                    setIsMessageModalOpen(false);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold px-5 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir en WhatsApp</span>
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
