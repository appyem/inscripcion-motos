// app/page.js
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function DashboardPage() {
  const [inscripciones, setInscripciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCedula, setFiltroCedula] = useState('');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('todos');
  const [filtroTipoVehiculo, setFiltroTipoVehiculo] = useState('todos');
  const [filtroLider, setFiltroLider] = useState('');
  const [totalInscritos, setTotalInscritos] = useState(0);
  const [formUrl, setFormUrl] = useState(typeof window !== 'undefined' ? `${window.location.origin}/inscripcion` : '');
  const [imagenModal, setImagenModal] = useState(null);
  
  // NUEVO: Paleta de colores cálidos y suaves
  const coloresCalidos = {
    cremaPrincipal: '#F5E6D3',
    doradoSuave: '#E8C999',
    beigeClaro: '#F8F0E3',
    terracota: '#C87A5D',
    terracotaOscuro: '#A65E47',
    marronSuave: '#8B6F47',
    blancoRoto: '#FFF9F0',
    grisPerla: '#E8E0D5',
    doradoClaro: '#F5D7B3',
    sombraSuave: '#D4B896',
    textoOscuro: '#4A3C30',
    textoMedio: '#6B5E51',
    verdeOliva: '#8A9B68',
    verdeOscuro: '#6D7B55',
    acentoCoral: '#E67E7E',
    acentoCoralOscuro: '#C46A6A'
  };
  
  // Municipios de Caldas agrupados por zonas
  const municipiosPorZona = {
    'todos': 'Todos los Municipios',
    'Centro Sur': ['Manizales', 'Chinchiná', 'Neira', 'Palestina', 'Villamaría'],
    'Alto Occidente': ['Filadelfia', 'La Merced', 'Marmato', 'Riosucio', 'Supía'],
    'Occidente': ['Anserma', 'Belalcázar', 'Risaralda', 'San José', 'Viterbo'],
    'Norte': ['Aguadas', 'Aranzazu', 'Pácora', 'Salamina'],
    'Oriente': ['Manzanares', 'Marquetalia', 'Marulanda', 'Pensilvania', 'Samaná'],
    'Magdalena Caldense': ['La Dorada', 'Norcasia', 'Victoria']
  };
  
  const todosMunicipios = ['todos', ...Object.values(municipiosPorZona).flat().filter(m => m !== 'todos')];
  const tiposVehiculo = ['todos', 'moto', 'vehiculo', 'jeep'];

  useEffect(() => {
    const q = query(collection(db, 'inscripciones'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const datos = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fechaFormateada: data.createdAt?.toDate?.().toLocaleString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) || 'N/A'
        };
      });
      
      setInscripciones(datos);
      setTotalInscritos(datos.length);
      setLoading(false);
    }, (error) => {
      console.error('Error en listener de Firestore:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // NUEVO: Estadísticas por tipo de vehículo
  const estadisticasVehiculos = tiposVehiculo.slice(1).map(tipo => {
    const count = inscripciones.filter(ins => ins.tipoVehiculo === tipo).length;
    const nombres = {
      'moto': '🏍️ MOTOS',
      'vehiculo': '🚗 VEHÍCULOS',
      'jeep': '🚙 JEEPS/4X4'
    };
    return { tipo, count, nombre: nombres[tipo] };
  });

  // NUEVO: Estadísticas por zona
  const estadisticasZonas = Object.keys(municipiosPorZona)
    .filter(zona => zona !== 'todos')
    .map(zona => {
      const municipios = municipiosPorZona[zona];
      const count = inscripciones.filter(ins => municipios.includes(ins.municipio)).length;
      return { zona, count };
    })
    .sort((a, b) => b.count - a.count);

  // NUEVO: Estadísticas por municipio (individual)
  const estadisticasMunicipios = [...new Set(inscripciones.map(ins => ins.municipio))]
    .map(municipio => {
      const count = inscripciones.filter(ins => ins.municipio === municipio).length;
      return { municipio, count };
    })
    .sort((a, b) => b.count - a.count);

  // NUEVO: Estadísticas por líder (top 10)
  const estadisticasLideres = [...inscripciones.reduce((acc, ins) => {
    const lider = ins.lider || 'SIN LÍDER';
    if (!acc.has(lider)) {
      acc.set(lider, { lider, count: 0 });
    }
    acc.get(lider).count++;
    return acc;
  }, new Map()).values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Filtrar inscripciones
  const inscripcionesFiltradas = inscripciones.filter(ins => {
    const coincideCedula = filtroCedula ? ins.cedula.includes(filtroCedula) : true;
    const coincidePlaca = filtroPlaca ? ins.placa.includes(filtroPlaca) : true;
    const coincideMunicipio = filtroMunicipio === 'todos' ? true : ins.municipio === filtroMunicipio;
    const coincideTipoVehiculo = filtroTipoVehiculo === 'todos' ? true : ins.tipoVehiculo === filtroTipoVehiculo;
    const coincideLider = filtroLider ? (ins.lider || '').includes(filtroLider.toUpperCase()) : true;
    return coincideCedula && coincidePlaca && coincideMunicipio && coincideTipoVehiculo && coincideLider;
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formUrl);
    alert('¡URL copiada al portapapeles! Ahora puedes compartirla.');
  };

  const shareViaWhatsApp = () => {
    const mensaje = `🚗❤️ ¡ÚNETE AL EQUIPO DE TRABAJO DE MARÍA IRMA! 🇨🇴\n\nAcompaña a MARÍA IRMA U99 en su campaña al Senado 🏛️\n\n✅ Inscripción rápida y segura\n✅ SOAT vigente obligatorio\n✅ Regístrate con tu líder\n\n👉 INSCRÍBETE AQUÍ:\n${formUrl}\n\n#U99 #PartidoDeLaU #MaríaIrma #Senado 💔✨`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  // NUEVO: Función para ver imagen SOAT (Base64)
  const verSoat = (soatBase64) => {
    if (soatBase64) {
      setImagenModal(soatBase64);
    } else {
      alert('No hay imagen de SOAT disponible para esta inscripción');
    }
  };

  // NUEVO: Función para cerrar modal
  const cerrarModal = () => {
    setImagenModal(null);
  };

  // NUEVO: Función para exportar a Excel
  const exportarExcel = () => {
    if (inscripciones.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    // Preparar datos para Excel
    const datosExcel = inscripciones.map(ins => ({
      'Fecha/Hora': ins.fechaFormateada,
      'Nombre Completo': ins.nombreCompleto,
      'Cédula': ins.cedula,
      'Celular': ins.celular,
      'Líder': ins.lider || 'SIN LÍDER',
      'Tipo de Vehículo': ins.tipoVehiculo === 'moto' ? 'MOTO' : 
                         ins.tipoVehiculo === 'vehiculo' ? 'VEHÍCULO PARTICULAR' : 'JEEP/4X4',
      'Placa': ins.placa,
      'Municipio': ins.municipio,
      'SOAT': ins.soatBase64 ? 'IMAGEN DISPONIBLE' : 'NO DISPONIBLE'
    }));

    // Crear hoja de trabajo
    const ws = XLSX.utils.json_to_sheet(datosExcel);
    
    // Ajustar ancho de columnas
    const wscols = [
      {wch: 20}, // Fecha/Hora
      {wch: 30}, // Nombre Completo
      {wch: 15}, // Cédula
      {wch: 15}, // Celular
      {wch: 25}, // Líder
      {wch: 20}, // Tipo de Vehículo
      {wch: 12}, // Placa
      {wch: 20}, // Municipio
      {wch: 18}  // SOAT
    ];
    ws['!cols'] = wscols;

    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inscripciones');

    // Generar archivo Excel
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Inscripciones_Maria_Irma_U99_${fecha}.xlsx`);
    
    // Alerta de éxito
    alert(`✅ ¡Exportación exitosa!\n\nSe han exportado ${inscripciones.length} registros a Excel.`);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#F5E6D3] via-[#E8C999] to-[#F8F0E3] text-[#4A3C30] relative">
      {/* Modal para ver imagen SOAT */}
      {imagenModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={cerrarModal}
        >
          <div className="bg-[#FFF9F0] rounded-2xl max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-[#C87A5D]">
              <h3 className="text-xl font-bold text-[#C87A5D]">IMAGEN SOAT</h3>
              <button 
                onClick={cerrarModal}
                className="bg-[#C87A5D] text-[#F8F0E3] px-4 py-2 rounded-lg hover:bg-[#A65E47] transition-all"
              >
                ✕ CERRAR
              </button>
            </div>
            <div className="p-4">
              <Image 
                src={imagenModal} 
                alt="SOAT"
                width={800}
                height={600}
                className="max-w-full max-h-[70vh] object-contain rounded-lg border-4 border-[#E8C999]"
              />
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#F8F0E3]/95 shadow-lg border-b-2 border-[#C87A5D]">
        <div className="container mx-auto px-4 py-4 md:py-5 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 md:space-x-4 mb-3 md:mb-0">
            <div className="flex items-center space-x-2">
              <div className="bg-[#F5E6D3] p-1.5 md:p-2 rounded-full shadow-lg border-2 border-[#E8C999]">
                <div className="w-9 h-9 md:w-11 md:h-11 bg-[#C87A5D] rounded-full flex items-center justify-center">
                  <span className="font-bold text-[#F8F0E3] text-lg md:text-xl leading-none">U</span>
                </div>
              </div>
              <div className="bg-[#E8C999] text-[#4A3C30] font-bold px-3 py-1 rounded-full text-xs md:text-sm border-2 border-[#C87A5D] shadow-lg">
                TARJETA U99
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#8B6F47]">DASHBOARD ADMINISTRATIVO</h1>
              <p className="text-[#6B5E51] text-base md:text-lg mt-1 font-semibold">Inscripciones de Vehículos - María Irma U99</p>
            </div>
          </div>
          <div className="text-center bg-[#C87A5D] p-3 rounded-xl border-2 border-[#E8C999] shadow-lg">
            <p className="text-xl md:text-2xl font-bold text-[#F8F0E3]">TOTAL INSCRITOS: {totalInscritos}</p>
            <p className="mt-1 text-sm md:text-base text-[#F5E6D3]">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-3 md:py-5">
        <div className="bg-linear-to-r from-[#C87A5D] to-[#A65E47] rounded-2xl shadow-xl p-4 md:p-5 mb-5 border-2 border-[#E8C999]">
          <h2 className="text-xl md:text-2xl font-bold text-[#F8F0E3] text-center mb-3">🔗 URL PARA INSCRIPCIONES</h2>
          <div className="bg-[#F8F0E3]/30 backdrop-blur-sm rounded-lg p-3 md:p-4 mb-3">
            <p className="text-[#4A3C30] text-base md:text-lg font-mono break-all text-center">{formUrl || 'Cargando URL...'}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
            <button
              onClick={copyToClipboard}
              className="w-full bg-[#E8C999] hover:bg-[#F5D7B3] text-[#4A3C30] font-bold py-2.5 px-4 rounded-lg text-base transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center"
            >
              <span className="mr-2 text-lg">📋</span> COPIAR URL
            </button>
            
            <button
              onClick={shareViaWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-2.5 px-4 rounded-lg text-base transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center"
            >
              <span className="mr-2 text-2xl">📱</span> COMPARTIR POR WHATSAPP
            </button>

            {/* NUEVO: Botón Exportar Excel */}
            <button
              onClick={exportarExcel}
              className="w-full bg-[#8A9B68] hover:bg-[#6D7B55] text-[#F8F0E3] font-bold py-2.5 px-4 rounded-lg text-base transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center"
            >
              <span className="mr-2 text-2xl">📊</span> EXPORTAR A EXCEL
            </button>
          </div>
          
          <div className="bg-[#8A9B68]/20 border-l-4 border-[#8A9B68] p-2.5 rounded-r">
            <p className="text-[#4A3C30] font-bold text-xs md:text-sm text-center">
              ✨ El mensaje incluye emojis y enlace directo de inscripción
            </p>
          </div>
        </div>

        {/* NUEVO: RESUMEN DE ESTADÍSTICAS */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5">
          {/* Estadísticas por Tipo de Vehículo */}
          <div className="bg-[#FFF9F0]/80 backdrop-blur-lg rounded-2xl shadow-xl p-4 border border-[#C87A5D]">
            <h2 className="text-lg md:text-xl font-bold mb-3 text-[#C87A5D] text-center">📊 POR TIPO DE VEHÍCULO</h2>
            <div className="space-y-2">
              {estadisticasVehiculos.map(({ tipo, count, nombre }) => (
                <div key={tipo} className="flex justify-between items-center p-2 bg-[#F5E6D3]/50 rounded-lg">
                  <span className="font-bold text-[#4A3C30]">{nombre}</span>
                  <span className="text-2xl font-bold text-[#C87A5D]">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Estadísticas por Zona */}
          <div className="bg-[#FFF9F0]/80 backdrop-blur-lg rounded-2xl shadow-xl p-4 border border-[#C87A5D]">
            <h2 className="text-lg md:text-xl font-bold mb-3 text-[#C87A5D] text-center">🗺️ POR ZONA DE CALDAS</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {estadisticasZonas.map(({ zona, count }) => (
                <div key={zona} className="flex justify-between items-center p-2 bg-[#F5E6D3]/50 rounded-lg">
                  <span className="font-bold text-[#4A3C30] text-xs">{zona}</span>
                  <span className="text-xl font-bold text-[#C87A5D]">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* NUEVO: Estadísticas por Municipio */}
          <div className="bg-[#FFF9F0]/80 backdrop-blur-lg rounded-2xl shadow-xl p-4 border border-[#C87A5D]">
            <h2 className="text-lg md:text-xl font-bold mb-3 text-[#C87A5D] text-center">🏙️ TOP 10 MUNICIPIOS</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {estadisticasMunicipios.slice(0, 10).map(({ municipio, count }) => (
                <div key={municipio} className="flex justify-between items-center p-2 bg-[#F5E6D3]/50 rounded-lg">
                  <span className="font-bold text-[#4A3C30] text-[10px] truncate max-w-20">{municipio}</span>
                  <span className="text-xl font-bold text-[#C87A5D]">{count}</span>
                </div>
              ))}
              {estadisticasMunicipios.length === 0 && (
                <p className="text-center text-[#6B5E51]/70 text-sm">Sin datos aún</p>
              )}
            </div>
          </div>

          {/* Estadísticas por Líder (Top 10) */}
          <div className="bg-[#FFF9F0]/80 backdrop-blur-lg rounded-2xl shadow-xl p-4 border border-[#C87A5D]">
            <h2 className="text-lg md:text-xl font-bold mb-3 text-[#C87A5D] text-center">👥 TOP 10 LÍDERES</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {estadisticasLideres.map(({ lider, count }, index) => (
                <div key={lider} className="flex justify-between items-center p-2 bg-[#F5E6D3]/50 rounded-lg">
                  <div>
                    <span className="font-bold text-[#4A3C30] text-[10px] truncate max-w-20">{index + 1}. {lider}</span>
                  </div>
                  <span className="text-xl font-bold text-[#C87A5D]">{count}</span>
                </div>
              ))}
              {estadisticasLideres.length === 0 && (
                <p className="text-center text-[#6B5E51]/70 text-sm">Sin datos de líderes aún</p>
              )}
            </div>
          </div>
        </div>

        {/* Filtros de Búsqueda */}
        <div className="bg-[#FFF9F0]/80 backdrop-blur-lg rounded-2xl shadow-xl p-4 mb-5 border border-[#C87A5D]">
          <h2 className="text-xl md:text-2xl font-bold mb-3 text-[#C87A5D] text-center">🔍 FILTROS DE BÚSQUEDA</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-xs font-bold mb-1 text-[#8B6F47]">CÉDULA</label>
              <input
                type="text"
                value={filtroCedula}
                onChange={(e) => setFiltroCedula(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8C999] text-[#4A3C30] font-bold text-xs placeholder-[#8B6F47]/50"
                placeholder="Buscar cédula"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-[#8B6F47]">PLACA</label>
              <input
                type="text"
                value={filtroPlaca}
                onChange={(e) => setFiltroPlaca(e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase())}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8C999] text-[#4A3C30] font-bold text-xs placeholder-[#8B6F47]/50"
                placeholder="Buscar placa"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-[#8B6F47]">MUNICIPIO</label>
              <select
                value={filtroMunicipio}
                onChange={(e) => setFiltroMunicipio(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8C999] text-[#4A3C30] font-bold text-xs appearance-none"
              >
                {todosMunicipios.map(municipio => (
                  <option key={municipio} value={municipio} className="bg-[#F8F0E3] text-[#8B6F47] font-bold">
                    {municipio === 'todos' ? 'TODOS' : municipio}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-[#8B6F47]">TIPO VEHÍCULO</label>
              <select
                value={filtroTipoVehiculo}
                onChange={(e) => setFiltroTipoVehiculo(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8C999] text-[#4A3C30] font-bold text-xs appearance-none"
              >
                {tiposVehiculo.map(tipo => (
                  <option key={tipo} value={tipo} className="bg-[#F8F0E3] text-[#8B6F47] font-bold">
                    {tipo === 'todos' ? 'TODOS' : 
                     tipo === 'moto' ? '🏍️ MOTO' :
                     tipo === 'vehiculo' ? '🚗 VEHÍCULO' : '🚙 JEEP/4X4'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-[#8B6F47]">LÍDER</label>
              <input
                type="text"
                value={filtroLider}
                onChange={(e) => setFiltroLider(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8C999] text-[#4A3C30] font-bold text-xs placeholder-[#8B6F47]/50"
                placeholder="Nombre del líder"
              />
            </div>
          </div>
        </div>

        {/* Listado de Inscripciones */}
        <div className="bg-[#FFF9F0]/80 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-[#C87A5D]">
          <div className="p-3 md:p-4 border-b border-[#C87A5D] bg-[#F5E6D3]/50">
            <h2 className="text-xl md:text-2xl font-bold text-[#C87A5D]">📋 LISTADO DE INSCRIPCIONES</h2>
            <p className="mt-1 text-sm md:text-base text-[#8B6F47]">Resultados: {inscripcionesFiltradas.length} de {totalInscritos}</p>
          </div>
          
          {loading ? (
            <div className="p-6 md:p-10 text-center">
              <svg className="animate-spin h-8 w-8 md:h-12 md:w-12 mx-auto text-[#C87A5D]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-3 md:mt-4 text-base md:text-xl font-bold text-[#4A3C30]">CARGANDO DATOS INICIALES...</p>
              <p className="mt-2 text-xs text-[#6B5E51]/80">Conectando con base de datos en tiempo real</p>
            </div>
          ) : inscripcionesFiltradas.length === 0 ? (
            <div className="p-6 md:p-10 text-center">
              <p className="text-lg md:text-xl font-bold text-[#C87A5D]">NO HAY INSCRIPCIONES QUE COINCIDAN CON LOS FILTROS</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-[#C87A5D] text-[#F8F0E3] sticky top-0">
                  <tr>
                    <th className="p-2 md:p-3 text-left font-bold">FECHA/HORA</th>
                    <th className="p-2 md:p-3 text-left font-bold">NOMBRE</th>
                    <th className="p-2 md:p-3 text-left font-bold">CÉDULA</th>
                    <th className="p-2 md:p-3 text-left font-bold">CELULAR</th>
                    <th className="p-2 md:p-3 text-left font-bold">LÍDER</th>
                    <th className="p-2 md:p-3 text-left font-bold">TIPO</th>
                    <th className="p-2 md:p-3 text-left font-bold">PLACA</th>
                    <th className="p-2 md:p-3 text-left font-bold">MUNICIPIO</th>
                    <th className="p-2 md:p-3 text-center font-bold">SOAT</th>
                  </tr>
                </thead>
                <tbody>
                  {inscripcionesFiltradas.map((ins, index) => (
                    <tr 
                      key={ins.id} 
                      className={`border-b border-[#E8E0D5] ${
                        index % 2 === 0 ? 'bg-[#F8F0E3]/50' : 'bg-[#F5E6D3]/30'
                      } hover:bg-[#C87A5D]/10 transition-colors`}
                    >
                      <td className="p-2 md:p-3 font-mono text-[10px] md:text-xs text-[#6B5E51]">{ins.fechaFormateada}</td>
                      <td className="p-2 md:p-3 font-bold text-xs md:text-sm truncate max-w-30 md:max-w-none text-[#4A3C30]">{ins.nombreCompleto}</td>
                      <td className="p-2 md:p-3 font-mono text-xs md:text-sm text-[#4A3C30]">{ins.cedula}</td>
                      <td className="p-2 md:p-3 font-mono text-xs md:text-sm text-[#4A3C30]">{ins.celular || 'N/A'}</td>
                      <td className="p-2 md:p-3 font-bold text-xs md:text-sm text-[#8B6F47] truncate max-w-25">{ins.lider || 'SIN LÍDER'}</td>
                      <td className="p-2 md:p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ins.tipoVehiculo === 'moto' ? 'bg-blue-200 text-blue-800' :
                          ins.tipoVehiculo === 'vehiculo' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
                        }`}>
                          {ins.tipoVehiculo === 'moto' ? '🏍️' : ins.tipoVehiculo === 'vehiculo' ? '🚗' : '🚙'}
                        </span>
                      </td>
                      <td className="p-2 md:p-3 font-mono text-xs md:text-sm text-[#4A3C30]">{ins.placa}</td>
                      <td className="p-2 md:p-3 font-bold text-xs md:text-sm text-[#C87A5D]">{ins.municipio}</td>
                      <td className="p-2 md:p-3 text-center">
                        <button
                          onClick={() => verSoat(ins.soatBase64)}
                          disabled={!ins.soatBase64}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            ins.soatBase64 
                              ? 'bg-green-200 text-green-800 hover:bg-green-300' 
                              : 'bg-red-200 text-red-800 cursor-not-allowed'
                          } transition-all`}
                          title={ins.soatBase64 ? 'Ver imagen SOAT' : 'SOAT no disponible'}
                        >
                          {ins.soatBase64 ? '🖼️ VER' : '❌ SIN SOAT'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-[#E8C999] mt-5 py-3 text-center border-t-2 border-[#C87A5D]">
        <div className="container mx-auto px-3 text-[#4A3C30]">
          <p className="font-bold text-sm">© {new Date().getFullYear()} PARTIDO DE LA U - UNIDAD NACIONAL - TARJETA U99</p>
          <p className="mt-1 text-xs">Sistema de monitoreo en tiempo real - Inscripciones de vehículos para María Irma</p>
          <p className="mt-1 font-bold text-xs text-[#8B6F47]">¡Juntos por un Colombia mejor con la Tarjeta U99!</p>
        </div>
      </footer>
    </div>
  );
}