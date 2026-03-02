// app/page.js
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import Image from 'next/image';

export default function DashboardPage() {
  const [inscripciones, setInscripciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCedula, setFiltroCedula] = useState('');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('todos');
  const [filtroTipoVehiculo, setFiltroTipoVehiculo] = useState('todos');
  const [filtroLider, setFiltroLider] = useState('');
  const [totalInscritos, setTotalInscritos] = useState(0);
  const formUrl = typeof window !== 'undefined' ? `${window.location.origin}/inscripcion` : '';
  
  // NUEVO: Municipios de Caldas agrupados por zonas
  const municipiosPorZona = {
    'todos': 'Todos los Municipios',
    'Centro Sur': ['Manizales', 'Chinchiná', 'Neira', 'Palestina', 'Villamaría'],
    'Alto Occidente': ['Filadelfia', 'La Merced', 'Marmato', 'Riosucio', 'Supía'],
    'Occidente': ['Anserma', 'Belalcázar', 'Risaralda', 'San José', 'Viterbo'],
    'Norte': ['Aguadas', 'Aranzazu', 'Pácora', 'Salamina'],
    'Oriente': ['Manzanares', 'Marquetalia', 'Marulanda', 'Pensilvania', 'Samaná'],
    'Magdalena Caldense': ['La Dorada', 'Norcasia', 'Victoria']
  };
  
  // Obtener todos los municipios en un solo array para filtros
  const todosMunicipios = ['todos', ...Object.values(municipiosPorZona).flat().filter(m => m !== 'todos')];
  
  // Tipos de vehículo
  const tiposVehiculo = ['todos', 'moto', 'vehiculo', 'jeep'];

  useEffect(() => {
    // USAR LISTENER EN TIEMPO REAL
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

  // NUEVO: Estadísticas por líder (top 5)
  const estadisticasLideres = [...inscripciones.reduce((acc, ins) => {
    const lider = ins.lider || 'SIN LÍDER';
    if (!acc.has(lider)) {
      acc.set(lider, { lider, count: 0 });
    }
    acc.get(lider).count++;
    return acc;
  }, new Map()).values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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

  // NUEVO: Función para ver imagen SOAT en nueva pestaña
  const verSoat = (soatUrl) => {
    if (soatUrl) {
      window.open(soatUrl, '_blank');
    } else {
      alert('No hay imagen de SOAT disponible para esta inscripción');
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#DA291C] via-[#B01E16] to-[#8B1712] text-white relative">
      <header className="bg-[#B01E16]/95 shadow-lg border-b-2 border-white">
        <div className="container mx-auto px-4 py-4 md:py-5 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 md:space-x-4 mb-3 md:mb-0">
            <div className="flex items-center space-x-2">
              <div className="bg-white p-1.5 md:p-2 rounded-full shadow-lg border-2 border-[#FFD700]">
                <div className="w-9 h-9 md:w-11 md:h-11 bg-[#DA291C] rounded-full flex items-center justify-center">
                  <span className="font-bold text-white text-lg md:text-xl leading-none">U</span>
                </div>
              </div>
              <div className="bg-[#FFD700] text-[#DA291C] font-bold px-3 py-1 rounded-full text-xs md:text-sm border-2 border-[#DA291C] shadow-lg">
                TARJETA U99
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">DASHBOARD ADMINISTRATIVO</h1>
              <p className="text-[#FFD700] text-base md:text-lg mt-1 font-semibold">Inscripciones de Vehículos - María Irma U99</p>
            </div>
          </div>
          <div className="text-center bg-[#DA291C] p-3 rounded-xl border-2 border-[#FFD700] shadow-lg">
            <p className="text-xl md:text-2xl font-bold text-white">TOTAL INSCRITOS: {totalInscritos}</p>
            <p className="mt-1 text-sm md:text-base">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-3 md:py-5">
        <div className="bg-linear-to-r from-[#DA291C] to-[#B01E16] rounded-2xl shadow-xl p-4 md:p-5 mb-5 border-2 border-[#FFD700]">
          <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-3">🔗 URL PARA INSCRIPCIONES</h2>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 md:p-4 mb-3">
            <p className="text-white text-base md:text-lg font-mono break-all text-center">{formUrl || 'Cargando URL...'}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
            <button
              onClick={copyToClipboard}
              className="w-full bg-[#FFD700] hover:bg-[#FFC107] text-[#DA291C] font-bold py-2.5 px-4 rounded-lg text-base transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center"
            >
              <span className="mr-2 text-lg">📋</span> COPIAR URL
            </button>
            
            <button
              onClick={shareViaWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-2.5 px-4 rounded-lg text-base transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center"
            >
              <span className="mr-2 text-2xl">📱</span> COMPARTIR POR WHATSAPP
            </button>
          </div>
          
          <div className="bg-[#25D366]/20 border-l-4 border-[#25D366] p-2.5 rounded-r">
            <p className="text-white font-bold text-xs md:text-sm text-center">
              ✨ El mensaje incluye emojis y enlace directo de inscripción
            </p>
          </div>
        </div>

        {/* NUEVO: RESUMEN DE ESTADÍSTICAS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {/* Estadísticas por Tipo de Vehículo */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-4 border border-[#DA291C]">
            <h2 className="text-lg md:text-xl font-bold mb-3 text-[#FFD700] text-center">📊 POR TIPO DE VEHÍCULO</h2>
            <div className="space-y-2">
              {estadisticasVehiculos.map(({ tipo, count, nombre }) => (
                <div key={tipo} className="flex justify-between items-center p-2 bg-[#DA291C]/20 rounded-lg">
                  <span className="font-bold text-white">{nombre}</span>
                  <span className="text-2xl font-bold text-[#FFD700]">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Estadísticas por Zona */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-4 border border-[#DA291C]">
            <h2 className="text-lg md:text-xl font-bold mb-3 text-[#FFD700] text-center">🗺️ POR ZONA DE CALDAS</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {estadisticasZonas.map(({ zona, count }) => (
                <div key={zona} className="flex justify-between items-center p-2 bg-[#DA291C]/20 rounded-lg">
                  <span className="font-bold text-white text-xs">{zona}</span>
                  <span className="text-xl font-bold text-[#FFD700]">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Estadísticas por Líder (Top 5) */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-4 border border-[#DA291C]">
            <h2 className="text-lg md:text-xl font-bold mb-3 text-[#FFD700] text-center">👥 TOP LÍDERES</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {estadisticasLideres.map(({ lider, count }, index) => (
                <div key={lider} className="flex justify-between items-center p-2 bg-[#DA291C]/20 rounded-lg">
                  <div>
                    <span className="font-bold text-white text-xs">{index + 1}. {lider}</span>
                  </div>
                  <span className="text-xl font-bold text-[#FFD700]">{count}</span>
                </div>
              ))}
              {estadisticasLideres.length === 0 && (
                <p className="text-center text-white/70 text-sm">Sin datos de líderes aún</p>
              )}
            </div>
          </div>
        </div>

        {/* Filtros de Búsqueda */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-4 mb-5 border border-[#DA291C]">
          <h2 className="text-xl md:text-2xl font-bold mb-3 text-[#FFD700] text-center">🔍 FILTROS DE BÚSQUEDA</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-xs font-bold mb-1 text-white">CÉDULA</label>
              <input
                type="text"
                value={filtroCedula}
                onChange={(e) => setFiltroCedula(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-2.5 py-1.5 bg-white/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white font-bold text-xs placeholder-white/70"
                placeholder="Buscar cédula"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-white">PLACA</label>
              <input
                type="text"
                value={filtroPlaca}
                onChange={(e) => setFiltroPlaca(e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase())}
                className="w-full px-2.5 py-1.5 bg-white/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white font-bold text-xs placeholder-white/70"
                placeholder="Buscar placa"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-white">MUNICIPIO</label>
              <select
                value={filtroMunicipio}
                onChange={(e) => setFiltroMunicipio(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white font-bold text-xs appearance-none"
              >
                {todosMunicipios.map(municipio => (
                  <option key={municipio} value={municipio} className="bg-[#B01E16] text-white font-bold">
                    {municipio === 'todos' ? 'TODOS' : municipio}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-white">TIPO VEHÍCULO</label>
              <select
                value={filtroTipoVehiculo}
                onChange={(e) => setFiltroTipoVehiculo(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white font-bold text-xs appearance-none"
              >
                {tiposVehiculo.map(tipo => (
                  <option key={tipo} value={tipo} className="bg-[#B01E16] text-white font-bold">
                    {tipo === 'todos' ? 'TODOS' : 
                     tipo === 'moto' ? '🏍️ MOTO' :
                     tipo === 'vehiculo' ? '🚗 VEHÍCULO' : '🚙 JEEP/4X4'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-white">LÍDER</label>
              <input
                type="text"
                value={filtroLider}
                onChange={(e) => setFiltroLider(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white font-bold text-xs placeholder-white/70"
                placeholder="Nombre del líder"
              />
            </div>
          </div>
        </div>

        {/* Listado de Inscripciones */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-[#DA291C]">
          <div className="p-3 md:p-4 border-b border-[#DA291C] bg-[#B01E16]/50">
            <h2 className="text-xl md:text-2xl font-bold text-white">📋 LISTADO DE INSCRIPCIONES</h2>
            <p className="mt-1 text-sm md:text-base text-[#FFD700]">Resultados: {inscripcionesFiltradas.length} de {totalInscritos}</p>
          </div>
          
          {loading ? (
            <div className="p-6 md:p-10 text-center">
              <svg className="animate-spin h-8 w-8 md:h-12 md:w-12 mx-auto text-[#FFD700]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-3 md:mt-4 text-base md:text-xl font-bold">CARGANDO DATOS INICIALES...</p>
              <p className="mt-2 text-xs text-white/80">Conectando con base de datos en tiempo real</p>
            </div>
          ) : inscripcionesFiltradas.length === 0 ? (
            <div className="p-6 md:p-10 text-center">
              <p className="text-lg md:text-xl font-bold text-[#FFD700]">NO HAY INSCRIPCIONES QUE COINCIDAN CON LOS FILTROS</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-[#DA291C] text-white sticky top-0">
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
                      className={`border-b border-white/15 ${
                        index % 2 === 0 ? 'bg-white/5' : 'bg-white/10'
                      } hover:bg-[#DA291C]/20 transition-colors`}
                    >
                      <td className="p-2 md:p-3 font-mono text-[10px] md:text-xs">{ins.fechaFormateada}</td>
                      <td className="p-2 md:p-3 font-bold text-xs md:text-sm truncate max-w-30 md:max-w-none">{ins.nombreCompleto}</td>
                      <td className="p-2 md:p-3 font-mono text-xs md:text-sm">{ins.cedula}</td>
                      <td className="p-2 md:p-3 font-mono text-xs md:text-sm">{ins.celular || 'N/A'}</td>
                      <td className="p-2 md:p-3 font-bold text-xs md:text-sm text-[#FFD700] truncate max-w-25">{ins.lider || 'SIN LÍDER'}</td>
                      <td className="p-2 md:p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ins.tipoVehiculo === 'moto' ? 'bg-blue-500/20 text-blue-300' :
                          ins.tipoVehiculo === 'vehiculo' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {ins.tipoVehiculo === 'moto' ? '🏍️' : ins.tipoVehiculo === 'vehiculo' ? '🚗' : '🚙'}
                        </span>
                      </td>
                      <td className="p-2 md:p-3 font-mono text-xs md:text-sm">{ins.placa}</td>
                      <td className="p-2 md:p-3 font-bold text-xs md:text-sm">{ins.municipio}</td>
                      <td className="p-2 md:p-3 text-center">
                        <button
                          onClick={() => verSoat(ins.soatUrl)}
                          disabled={!ins.soatUrl}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            ins.soatUrl 
                              ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' 
                              : 'bg-red-500/20 text-red-300 cursor-not-allowed'
                          } transition-all`}
                          title={ins.soatUrl ? 'Ver imagen SOAT' : 'SOAT no disponible'}
                        >
                          {ins.soatUrl ? '📄 VER' : '❌ SIN SOAT'}
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

      <footer className="bg-[#8B1712] mt-5 py-3 text-center border-t-2 border-[#FFD700]">
        <div className="container mx-auto px-3 text-white">
          <p className="font-bold text-sm">© {new Date().getFullYear()} PARTIDO DE LA U - UNIDAD NACIONAL - TARJETA U99</p>
          <p className="mt-1 text-xs">Sistema de monitoreo en tiempo real - Inscripciones de vehículos para María Irma</p>
          <p className="mt-1 font-bold text-xs text-[#FFD700]">¡Juntos por un Colombia mejor con la Tarjeta U99!</p>
        </div>
      </footer>
    </div>
  );
}