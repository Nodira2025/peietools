import type { OperationalWorksite, OperationalEmployee, OperationalTool } from '../../types/operations';

import { calculateHaversineDistance, formatDistance } from '../geo/haversine';

export interface OperationalSuggestion {
  id: string;
  type: 'personal' | 'herramienta' | 'alerta';
  title: string;
  description: string;
  targetWorksiteId: string;
  targetWorksiteName: string;
  sourceWorksiteId?: string | null;
  sourceWorksiteName?: string | null;
  resourceId: string;
  resourceName: string;
  resourceSubtext: string;
  reasons: string[];
  distanceKm?: number;
  priority: 'alta' | 'media' | 'baja';
  actionType: 'asignar_personal' | 'trasladar_herramienta' | 'revisar_obra';
}

/**
 * Deterministic, rule-based recommendation engine for worksites, workers, and tools.
 * Explainable and transparent. Never mutates database automatically.
 */
export function generateOperationalSuggestions(
  worksites: OperationalWorksite[],
  allEmployees: OperationalEmployee[],
  allTools: OperationalTool[]
): OperationalSuggestion[] {
  const suggestions: OperationalSuggestion[] = [];

  // 1. REGLA PERSONAL: Obras activas con 0 o muy poco personal vs. operarios libres
  const availableWorkers = allEmployees.filter(
    (e) => e.status === 'Libre' || !e.obra_id || e.status === 'Disponible'
  );

  const activeWorksites = worksites.filter((w) => w.active);

  // Buscar obras con baja dotación de personal
  activeWorksites.forEach((targetObra) => {
    if (targetObra.workersCount <= 1 && availableWorkers.length > 0) {
      // Ordenar operarios libres por cercanía a la obra destino
      const rankedCandidates = availableWorkers
        .map((emp) => {
          let dist = 3.5; // Distancia estimada base si el operario no tiene GPS
          if (emp.lastKnownLocation) {
            dist = calculateHaversineDistance(emp.lastKnownLocation, {
              latitude: targetObra.latitude,
              longitude: targetObra.longitude,
            });
          }
          return { emp, dist };
        })
        .sort((a, b) => a.dist - b.dist);

      const bestCandidate = rankedCandidates[0];
      if (bestCandidate) {
        suggestions.push({
          id: `sug-emp-${targetObra.id}-${bestCandidate.emp.id}`,
          type: 'personal',
          title: `Refuerzo de personal para ${targetObra.name}`,
          description: `${bestCandidate.emp.full_name} (${bestCandidate.emp.specialty || 'Electricista'}) está disponible y puede cubrir la dotación en esta obra.`,
          targetWorksiteId: targetObra.id,
          targetWorksiteName: targetObra.name,
          resourceId: bestCandidate.emp.id,
          resourceName: bestCandidate.emp.full_name,
          resourceSubtext: bestCandidate.emp.specialty || 'Electricista',
          distanceKm: bestCandidate.dist,
          priority: targetObra.workersCount === 0 ? 'alta' : 'media',
          reasons: [
            `Especialidad compatible (${bestCandidate.emp.specialty || 'Electricista'})`,
            'Estado actual: Libre / Sin asignación activa',
            `Cercanía calculada: aprox. ${formatDistance(bestCandidate.dist)}`,
            `La obra tiene solo ${targetObra.workersCount} operario(s) asignados`,
          ],
          actionType: 'asignar_personal',
        });
      }
    }
  });

  // 2. REGLA HERRAMIENTAS: Obras sin herramientas vs. herramientas disponibles en depósito u obras cercanas
  const availableTools = allTools.filter(
    (t) => t.status === 'Disponible' || !t.current_obra_id
  );

  activeWorksites.forEach((targetObra) => {
    if (targetObra.toolsCount === 0 && targetObra.workersCount > 0 && availableTools.length > 0) {
      const toolCandidate = availableTools[0];
      suggestions.push({
        id: `sug-tool-${targetObra.id}-${toolCandidate.id}`,
        type: 'herramienta',
        title: `Equipamiento para ${targetObra.name}`,
        description: `La obra cuenta con ${targetObra.workersCount} operarios pero no tiene herramientas registradas. Se puede despachar ${toolCandidate.name} (${toolCandidate.code}).`,
        targetWorksiteId: targetObra.id,
        targetWorksiteName: targetObra.name,
        resourceId: toolCandidate.id,
        resourceName: toolCandidate.name,
        resourceSubtext: `Código: ${toolCandidate.code} • ${toolCandidate.category || 'Herramienta'}`,
        priority: 'media',
        reasons: [
          'La obra posee personal pero registra 0 herramientas',
          `Equipo disponible en base/depósito (${toolCandidate.code})`,
          'Optimización de productividad operativa en campo',
        ],
        actionType: 'trasladar_herramienta',
      });
    }
  });

  // 3. REGLA ALERTA: Obras inactivas o finalizadas que aún retienen herramientas o personal
  const inactiveWorksites = worksites.filter((w) => !w.active);
  inactiveWorksites.forEach((inactiva) => {
    if (inactiva.toolsCount > 0 || inactiva.workersCount > 0) {
      suggestions.push({
        id: `sug-alert-${inactiva.id}`,
        type: 'alerta',
        title: `Recursos en obra inactiva: ${inactiva.name}`,
        description: `Esta obra figura inactiva pero retiene ${inactiva.workersCount} operarios y ${inactiva.toolsCount} herramientas registradas.`,
        targetWorksiteId: inactiva.id,
        targetWorksiteName: inactiva.name,
        resourceId: inactiva.id,
        resourceName: inactiva.name,
        resourceSubtext: `${inactiva.workersCount} trabajadores • ${inactiva.toolsCount} equipos`,
        priority: 'alta',
        reasons: [
          'La obra está marcada como inactiva en el sistema',
          'Recursos inmovilizados que podrían redistribuirse en obras activas',
        ],
        actionType: 'revisar_obra',
      });
    }
  });

  return suggestions;
}
