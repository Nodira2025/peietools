import type { ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, BookOpen, ClipboardCheck, FileCheck2, FileText, HardHat, Scale, Zap } from 'lucide-react';
import { legalCertificates, legalDocuments, legalInspections, legalReviewDate, legalSources } from '@/data/legales';
import type { LegalRecord, LegalScope, LegalSourceId } from '@/data/legales';

const scopeStyles: Record<LegalScope, string> = {
  Publicado: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Según la obra': 'bg-amber-50 text-amber-900 border-amber-200',
  'Preparación técnica': 'bg-blue-50 text-blue-800 border-blue-200',
};

const sections = [
  { id: 'documentacion', label: 'Documentación', icon: FileText },
  { id: 'potencia', label: 'Potencia', icon: Zap },
  { id: 'inspecciones', label: 'Inspecciones', icon: HardHat },
  { id: 'certificados', label: 'Certificados', icon: FileCheck2 },
  { id: 'fuentes', label: 'Fuentes oficiales', icon: BookOpen },
];

function SourceLinks({ ids }: { ids: LegalSourceId[] }) {
  return <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
    {ids.map(id => <a key={id} href={legalSources[id].url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-peie-blue underline decoration-blue-200 underline-offset-4 hover:decoration-peie-blue">
      {legalSources[id].title}<ArrowUpRight size={14} aria-hidden="true" />
    </a>)}
  </div>;
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-5">
    <div>
      <h2 id={`${id}-title`} className="text-2xl font-bold tracking-tight text-peie-blue">{title}</h2>
      <p className="mt-2 max-w-4xl text-base leading-relaxed text-slate-600">{description}</p>
    </div>
    {children}
  </section>;
}

function RecordCard({ item }: { item: LegalRecord }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${scopeStyles[item.scope]}`}>{item.scope}</span>
    <h3 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h3>
    <dl className="mt-3 space-y-1 text-sm leading-relaxed">
      <div><dt className="inline font-semibold text-slate-700">Ante quién / responsable: </dt><dd className="inline text-slate-600">{item.recipient}</dd></div>
      <div><dt className="inline font-semibold text-slate-700">Cuándo: </dt><dd className="inline text-slate-600">{item.when}</dd></div>
    </dl>
    <p className="mt-3 text-base leading-relaxed text-slate-600">{item.description}</p>
    {item.sources.length > 0 ? <SourceLinks ids={item.sources} /> : <p className="mt-3 text-sm font-medium text-amber-900">Pendiente de definición en el expediente o contrato de la obra.</p>}
  </article>;
}

export default function Legales() {
  return <div className="min-w-0 space-y-10 pb-8">
    <header className="space-y-5">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-peie-blue p-3 text-white"><Scale size={28} aria-hidden="true" /></div>
        <div>
          <p className="text-sm font-semibold text-slate-500">PEIE / Gestión de obras / Tucumán</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-peie-blue sm:text-4xl">Legales</h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">EDET, documentación e inspecciones para obras de gran envergadura.</p>
        </div>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
        <p className="text-base leading-relaxed text-slate-700">Guía de requisitos publicados y preparación del expediente. La lista definitiva depende de la ubicación, la actividad, la potencia y las condiciones que aprueben EDET y las autoridades de cada obra.</p>
        <p className="mt-2 text-sm text-slate-600">Fuentes consultadas: <time dateTime="2026-09-11">{legalReviewDate}</time>. Actualización manual. Esta página no acredita documentos presentados ni habilitaciones de PEIE.</p>
      </div>
      <nav aria-label="Secciones de Legales" className="flex flex-wrap gap-2">
        {sections.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-peie-blue hover:border-peie-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peie-blue">
          <Icon size={17} aria-hidden="true" />{label}<ArrowDown size={13} aria-hidden="true" />
        </a>)}
      </nav>
    </header>

    <section aria-labelledby="recorrido-title" className="rounded-2xl bg-peie-blue p-5 text-white sm:p-6">
      <h2 id="recorrido-title" className="flex items-center gap-2 text-lg font-bold"><ClipboardCheck size={21} aria-hidden="true" />Orden sugerido para preparar la obra</h2>
      <p className="mt-2 text-sm leading-relaxed text-blue-100">Organización interna de PEIE; confirmar con cada organismo los pasos de su trámite.</p>
      <ol className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Definir la demanda', 'Ubicación, equipos, etapas y suministro provisorio o definitivo.'],
          ['Consultar a EDET', 'Condiciones técnicas, potencia disponible y requisitos del expediente.'],
          ['Preparar y presentar', 'Documentación comercial, ingeniería, permisos y seguridad.'],
          ['Inspeccionar y corregir', 'Coordinar visitas, ensayos y cierre de observaciones.'],
          ['Habilitar y archivar', 'Guardar aprobaciones, protocolos y constancias de entrega.'],
        ].map(([title, text], i) => <li key={title} className="border-t border-white/20 pt-3">
          <span className="text-sm font-bold text-sky-300">0{i + 1}</span>
          <h3 className="mt-1 font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-blue-100">{text}</p>
        </li>)}
      </ol>
    </section>

    <Section id="documentacion" title="Documentación y registros" description="Qué reunir, ante quién se presenta y en qué momento se necesita.">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
        <p><strong className="text-emerald-800">Publicado:</strong> respaldado por la fuente citada.</p>
        <p><strong className="text-amber-900">Según la obra:</strong> aplica bajo condiciones específicas.</p>
        <p><strong className="text-blue-800">Preparación técnica:</strong> guía para consultar y armar la carpeta.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{legalDocuments.map(item => <RecordCard key={item.title} item={item} />)}</div>
    </Section>

    <Section id="potencia" title="Potencia eléctrica y tipo de suministro" description="La magnitud de la obra no determina por sí sola la potencia. El responsable eléctrico debe calcular la demanda de cada etapa y acordar el suministro con EDET.">
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-peie-blue">Hasta 10 kW</p>
          <h3 className="mt-2 font-semibold">Alcance de los planos publicados</h3>
          <p className="mt-3 leading-relaxed text-slate-600">EDET publica esquemas monofásicos y trifásicos para potencia menor o igual a 10 kW. No utilizarlos como diseño de una conexión de mayor demanda.</p>
          <SourceLinks ids={['acometida']} />
        </article>
        <article className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
          <p className="text-2xl font-bold text-peie-blue">Más de 10 kW</p>
          <h3 className="mt-2 font-semibold">Consulta de grandes clientes</h3>
          <p className="mt-3 leading-relaxed text-slate-600">Las preguntas frecuentes agrupan T2, T4 y T6 bajo grandes clientes. La categoría y la tensión deben confirmarse con EDET; este dato no asigna automáticamente una tarifa ni exige media tensión.</p>
          <SourceLinks ids={['preguntas', 'tarifas']} />
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-peie-blue">Red disponible</p>
          <h3 className="mt-2 font-semibold">Capacidad y ampliaciones</h3>
          <p className="mt-3 leading-relaxed text-slate-600">Aumentar la potencia declarada requiere conformidad de EDET. Si la red es insuficiente, pueden corresponder obras y transformación conforme al art. 29.</p>
          <SourceLinks ids={['reglamento']} />
        </article>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-bold text-slate-900">Datos que debe definir la ingeniería</h3>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          {[
            ['Potencia instalada · kW', 'Inventario y suma de las potencias eléctricas de los equipos.'],
            ['Demanda máxima prevista · kW', 'Equipos que operan simultáneamente, arranques y escenarios por etapa.'],
            ['Potencia aparente · kVA', 'Dato necesario para evaluar equipos y transformación junto con el factor de potencia.'],
            ['Energía · kWh', 'Consumo acumulado durante un período; es distinto de la potencia requerida.'],
            ['Tensión y medición', 'Punto de conexión, baja/media tensión y esquema que autorice EDET.'],
            ['Provisorio y definitivo', 'Separar necesidades de construcción y de operación final del edificio o instalación.'],
          ].map(([term, description]) => <div key={term}><dt className="font-semibold text-slate-800">{term}</dt><dd className="mt-1 leading-relaxed text-slate-600">{description}</dd></div>)}
        </dl>
        <p className="mt-5 border-t border-slate-100 pt-4 leading-relaxed text-slate-600">EDET informa un factor de potencia aceptable de al menos <strong>0,92</strong> en sus preguntas frecuentes. Verificar el régimen aplicable al contrato y dimensionar cualquier compensación mediante estudio técnico.</p>
        <SourceLinks ids={['preguntas']} />
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-base leading-relaxed text-amber-950"><strong>Potencia de las obras de PEIE: pendiente de relevamiento.</strong> No se incorporaron valores por obra porque no se dispone aquí de cuadros de cargas ni de potencias autorizadas por EDET.</p>
    </Section>

    <Section id="inspecciones" title="Inspecciones y verificaciones" description="Cada control tiene un responsable y un alcance. La conexión a la red y la seguridad de la instalación interior deben documentarse por separado.">
      <div className="grid gap-4 lg:grid-cols-2">{legalInspections.map(item => <RecordCard key={item.title} item={item} />)}</div>
    </Section>

    <Section id="certificados" title="Certificados y constancias" description="Qué acredita cada documento y quién interviene en su emisión o aprobación.">
      <div className="grid gap-4 lg:grid-cols-2">{legalCertificates.map(item => <RecordCard key={item.title} item={item} />)}</div>
      <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="font-bold text-amber-950">Para completar el expediente de cada obra</h3>
        <p className="mt-2 leading-relaxed text-amber-950">Confirmar municipio, titular, responsable matriculado, potencia solicitada/autorizada, solución de conexión, requisitos de visado, inspecciones y certificados exigidos. Pedir a EDET la versión aplicable de sus especificaciones y registrar número de expediente, fecha y respuesta.</p>
        <p className="mt-3 leading-relaxed text-amber-950">No se verificó una lista pública exhaustiva para todas las grandes obras. Los elementos señalados como pendientes deben resolverse con EDET, el municipio y el pliego de cada proyecto.</p>
      </aside>
    </Section>

    <Section id="fuentes" title="Fuentes oficiales y formularios" description="Accesos a la documentación de respaldo. Verificar modificaciones normativas, versiones y períodos tarifarios al preparar cada presentación.">
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {Object.entries(legalSources).map(([id, source]) => <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-4 p-5 hover:bg-slate-50">
          <div><h3 className="font-semibold text-peie-blue">{source.title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{source.detail}</p></div>
          <ArrowUpRight size={20} className="shrink-0 text-peie-blue" aria-hidden="true" />
        </a>)}
      </div>
      <p className="text-sm text-slate-500">Alcance territorial: servicio de EDET en Tucumán. Para obras en otras jurisdicciones corresponde verificar distribuidora y normativa local.</p>
    </Section>
  </div>;
}
