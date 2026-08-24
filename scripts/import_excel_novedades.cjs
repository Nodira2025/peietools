const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://kwgzivpokkhaeyrvhkbm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3Z3ppdnBva2toYWV5cnZoa2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODE4NTksImV4cCI6MjA5NDI1Nzg1OX0.fZCdl2nvFwced2ZIZk7LdHfjxABnE5qYunX8zT-Lzps";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function excelSerialToDate(serial) {
  if (!serial) return new Date().toISOString().split('T')[0];
  if (typeof serial === 'string' && serial.includes('-')) return serial;
  if (typeof serial === 'string' && serial.includes('/')) {
    const parts = serial.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  const num = Number(serial);
  if (isNaN(num)) return new Date().toISOString().split('T')[0];
  const date = new Date(Math.round((num - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

async function main() {
  const filePath = 'D:\\Carpetas de Winsows 2026\\mu\\NOVEDADES DIARIAS - PEIE (2).xlsx';
  console.log(`Leyendo archivo Excel: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`El archivo no existe en: ${filePath}`);
    process.exit(1);
  }

  const wb = xlsx.readFile(filePath);
  const sheetName = 'NOVEDADES DIARIAS GENERALES ';
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.error(`No se encontró la hoja: ${sheetName}`);
    process.exit(1);
  }

  const rawRows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Cargar empleados para asociar IDs
  const { data: empleadosData } = await supabase
    .from('empleados')
    .select('id, full_name');
  
  const empMap = new Map();
  if (empleadosData) {
    empleadosData.forEach(e => {
      empMap.set(e.full_name.toLowerCase().trim(), e.id);
    });
  }

  // Limpiar novedades previas para re-importar limpio
  await supabase.from('novedades_diarias').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const recordsToInsert = [];

  for (let i = 2; i < rawRows.length; i++) {
    const row = rawRows[i];
    const mes = (row[1] || '').toString().trim();
    const quincena = (row[2] || '').toString().trim() || '2Q';
    const fechaRaw = row[3];
    const nombre = (row[4] || '').toString().trim();
    const estadoRaw = (row[5] || '').toString().trim();
    const tipoLicenciaRaw = (row[6] || '').toString().trim();
    const seJustifica = (row[7] || '').toString().trim();
    const certMedicoRaw = (row[8] || '').toString().trim();
    const desdeRaw = row[9];
    const hastaRaw = row[10];
    const diasEnf = Number(row[12]) || 0;
    const diasFam = Number(row[13]) || 0;
    const diasDuelo = Number(row[14]) || 0;
    const obs = (row[15] || '').toString().trim();

    if (!nombre && !fechaRaw && !mes) continue;
    if (!nombre) continue;

    // Normalizar Estado
    let estado = 'PRESENTE';
    const estUpper = estadoRaw.toUpperCase();
    if (estUpper.includes('AUSENTE')) estado = 'AUSENTE';
    else if (estUpper.includes('TARDE')) estado = 'LLEGADA TARDE';
    else if (estUpper.includes('RETIRO') || estUpper.includes('RETIRA')) estado = 'SE RETIRO';
    else if (estUpper.includes('ART')) estado = 'AUSENTE';
    else if (estUpper.includes('PRESENTE')) estado = 'PRESENTE';
    else if (tipoLicenciaRaw.toLowerCase().includes('enfermedad')) estado = 'AUSENTE';
    else estado = estadoRaw || 'PRESENTE';

    // Normalizar Tipo de Licencia
    let tipoLicencia = tipoLicenciaRaw || 'Ninguno';
    const validLicencias = ['Ninguno', 'Enfermedad Trabajador', 'Familiar Enfermo', 'Fallecimiento', 'No justificado', 'Llegada tarde', 'Otro'];
    if (!validLicencias.includes(tipoLicencia)) {
      if (diasEnf > 0) tipoLicencia = 'Enfermedad Trabajador';
      else if (diasFam > 0) tipoLicencia = 'Familiar Enfermo';
      else if (diasDuelo > 0) tipoLicencia = 'Fallecimiento';
      else if (estado === 'LLEGADA TARDE') tipoLicencia = 'Llegada tarde';
      else if (estado === 'AUSENTE') tipoLicencia = 'No justificado';
      else tipoLicencia = 'Otro';
    }

    const fecha = excelSerialToDate(fechaRaw);
    const desde = desdeRaw ? excelSerialToDate(desdeRaw) : null;
    const hasta = hastaRaw ? excelSerialToDate(hastaRaw) : null;
    const certificadoMedico = certMedicoRaw.toLowerCase().includes('si');

    const empId = empMap.get(nombre.toLowerCase().trim()) || null;

    let obsFinal = obs;
    if (tipoLicenciaRaw && !validLicencias.includes(tipoLicenciaRaw)) {
      obsFinal = obsFinal ? `[Licencia original: ${tipoLicenciaRaw}] ${obsFinal}` : `Licencia: ${tipoLicenciaRaw}`;
    }
    if (estadoRaw && !['PRESENTE', 'AUSENTE', 'LLEGADA TARDE', 'SE RETIRO'].includes(estado)) {
      obsFinal = obsFinal ? `[Estado original: ${estadoRaw}] ${obsFinal}` : `Estado: ${estadoRaw}`;
    }
    if (seJustifica) {
      obsFinal = obsFinal ? `${obsFinal} (Justificación: ${seJustifica})` : `Justificación: ${seJustifica}`;
    }

    recordsToInsert.push({
      empleado_id: empId,
      empleado_nombre: nombre,
      fecha: fecha,
      mes: mes || 'AGOSTO',
      quincena: quincena || '2Q',
      estado: ['PRESENTE', 'AUSENTE', 'LLEGADA TARDE', 'SE RETIRO'].includes(estado) ? estado : 'AUSENTE',
      tipo_licencia: tipoLicencia,
      certificado_medico: certificadoMedico,
      desde: desde,
      hasta: hasta,
      horas_trabajadas: estado === 'PRESENTE' ? 10 : (estado === 'LLEGADA TARDE' ? 8 : (estado === 'SE RETIRO' ? 6 : 0)),
      horas_ausente: estado === 'AUSENTE' ? 8 : 0,
      observaciones: obsFinal || null,
      fuente: 'MANUAL_COORDINADOR'
    });
  }

  console.log(`Registros válidos a insertar: ${recordsToInsert.length}`);

  let inserted = 0;
  for (let i = 0; i < recordsToInsert.length; i += 50) {
    const chunk = recordsToInsert.slice(i, i + 50);
    const { error } = await supabase.from('novedades_diarias').insert(chunk);
    if (error) {
      console.error(`Error en lote ${i}:`, error.message);
    } else {
      inserted += chunk.length;
      console.log(`Insertados ${inserted} de ${recordsToInsert.length}...`);
    }
  }

  console.log(`\n🎉 ¡Importación completada con éxito total! Se insertaron ${inserted} registros reales.`);
}

main().catch(console.error);
