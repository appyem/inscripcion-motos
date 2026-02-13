// app/page.js
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export default function DashboardPage() {
  const [inscripciones, setInscripciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCedula, setFiltroCedula] = useState('');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroSector, setFiltroSector] = useState('todos');
  const [totalInscritos, setTotalInscritos] = useState(0);
  const [formUrl, setFormUrl] = useState('');
  const sectores = ['todos', 'Samaria', 'San Luis', 'Morritos', 'Verso', 'Soledad', 'Paila', 'El Pintado', 'Otro'];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFormUrl(`${window.location.origin}/inscripcion`);
    }
    
    cargarInscripciones();
    const interval = setInterval(cargarInscripciones, 3000);
    return () => clearInterval(interval);
  }, []);

  const cargarInscripciones = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'inscripciones'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const datos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fechaFormateada: doc.data().createdAt?.toDate?.().toLocaleString('es-CO', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) || 'N/A'
      }));
      
      setInscripciones(datos);
      setTotalInscritos(datos.length);
    } catch (error) {
      console.error('Error cargando inscripciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const inscripcionesFiltradas = inscripciones.filter(ins => {
    const coincideCedula = filtroCedula ? ins.cedula.includes(filtroCedula) : true;
    const coincidePlaca = filtroPlaca ? ins.placa.includes(filtroPlaca) : true;
    const coincideSector = filtroSector === 'todos' ? true : ins.sector.toLowerCase() === filtroSector.toLowerCase();
    return coincideCedula && coincidePlaca && coincideSector;
  });

  const estadisticasSector = sectores.slice(1).map(sector => {
    const count = inscripciones.filter(ins => ins.sector === sector).length;
    return { sector, count };
  }).sort((a, b) => b.count - a.count);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formUrl);
    alert('¡URL copiada al portapapeles! Ahora puedes compartirla.');
  };

  // FUNCIÓN PARA COMPARTIR POR WHATSAPP NATIVO
  const shareViaWhatsApp = () => {
    const mensaje = `🏍️💙 ¡ÚNETE AL RECIBIMIENTO HISTÓRICO! 🇨🇴\n\nAcompaña a JUAN MANUEL LONDOÑO C101 a la Cámara de Representantes 🏛️\n\n✅ Inscripción rápida y segura\n✅ Confirma tu participación\n✅ Sé parte del cambio con el Partido Conservador\n\n👉 INSCRÍBETE AQUÍ:\n${formUrl}\n\n#C101 #PartidoConservador #JuanManuelLondoño #CámaraDeRepresentantes 💙✨`;
    
    // URL para abrir WhatsApp nativo (funciona en móviles y desktop)
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    
    // Abrir en nueva pestaña (activa la app nativa en móviles)
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[#002266] to-[#0033A0] text-white">
      <header className="bg-[#001a4d] shadow-lg border-b-4 border-[#FFD700]">
        <div className="container mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 md:space-x-4 mb-4 md:mb-0">
            <div className="flex items-center space-x-2">
              {/* Logo C 101 diseñado con CSS - Sin dependencia de imagen */}
              <div className="bg-white p-1.5 md:p-2 rounded-full shadow-lg border-2 border-[#FFD700]">
                <div className="w-9 h-9 md:w-11 md:h-11 bg-[#0033A0] rounded-full flex flex-col items-center justify-center">
                  <span className="font-bold text-white text-lg md:text-xl leading-none">C</span>
                  <span className="font-bold text-[#FFD700] text-[8px] md:text-xs leading-none -mt-0.5">101</span>
                </div>
              </div>
              <div className="bg-[#FFD700] text-[#0033A0] font-bold px-3 py-1 rounded-full text-xs md:text-sm border-2 border-[#0033A0]">
                TARJETÓN C 101
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">DASHBOARD ADMINISTRATIVO</h1>
              <p className="text-yellow-300 text-base md:text-lg mt-1">Inscripciones de Motos - Juan Manuel Londoño</p>
            </div>
          </div>
          <div className="text-center bg-[#0033A0] p-3 rounded-xl border-2 border-[#FFD700]">
            <p className="text-xl md:text-2xl font-bold text-[#FFD700]">TOTAL INSCRITOS: {totalInscritos}</p>
            <p className="mt-1 text-sm md:text-base">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-6">
        <div className="bg-linear-to-r from-[#0033A0] to-[#002266] rounded-2xl shadow-xl p-4 md:p-6 mb-6 border-2 border-[#FFD700]">
          <h2 className="text-xl md:text-2xl font-bold text-[#FFD700] text-center mb-3">🔗 URL PARA INSCRIPCIONES</h2>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 md:p-4 mb-4">
            <p className="text-white text-base md:text-lg font-mono break-all text-center">{formUrl || 'Cargando URL...'}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <button
              onClick={copyToClipboard}
              className="w-full bg-[#FFD700] hover:bg-yellow-400 text-[#0033A0] font-bold py-3 px-4 rounded-lg text-base transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center"
            >
              <span className="mr-2">📋</span> COPIAR URL
            </button>
            
            <button
              onClick={shareViaWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 px-4 rounded-lg text-base transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center"
            >
              <span className="mr-2 text-2xl">📱</span> COMPARTIR POR WHATSAPP
            </button>
          </div>
          
          <div className="bg-[#25D366]/20 border-l-4 border-[#25D366] p-3 rounded-r">
            <p className="text-white font-bold text-xs md:text-sm text-center">
              ✨ El mensaje incluye emojis y enlace directo de inscripción
            </p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-4 md:p-6 mb-6 border border-[#FFD700]">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-[#FFD700] text-center">FILTROS DE BÚSQUEDA</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-bold mb-1 md:mb-2">CÉDULA</label>
              <input
                type="text"
                value={filtroCedula}
                onChange={(e) => setFiltroCedula(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-3 py-2 md:px-4 md:py-3 bg-white/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white font-bold text-sm md:text-base placeholder-white/70"
                placeholder="Buscar cédula"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold mb-1 md:mb-2">PLACA</label>
              <input
                type="text"
                value={filtroPlaca}
                onChange={(e) => setFiltroPlaca(e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase())}
                className="w-full px-3 py-2 md:px-4 md:py-3 bg-white/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white font-bold text-sm md:text-base placeholder-white/70"
                placeholder="Buscar placa"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold mb-1 md:mb-2">SECTOR</label>
              <select
                value={filtroSector}
                onChange={(e) => setFiltroSector(e.target.value)}
                className="w-full px-3 py-2 md:px-4 md:py-3 bg-white/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white font-bold text-sm md:text-base appearance-none"
              >
                {sectores.map(sector => (
                  <option key={sector} value={sector} className="bg-[#002266] text-white font-bold">
                    {sector.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-4 md:p-6 mb-6 border border-[#FFD700]">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-[#FFD700] text-center">ESTADÍSTICAS POR SECTOR</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
            {estadisticasSector.map(({ sector, count }) => (
              <div 
                key={sector} 
                className="bg-[#0033A0]/50 p-3 rounded-lg border border-[#FFD700] text-center hover:scale-105 transition-transform"
              >
                <p className="text-xs md:text-sm font-bold truncate">{sector}</p>
                <p className="text-2xl md:text-3xl font-bold text-[#FFD700] mt-1">{count}</p>
                <p className="text-[10px] md:text-xs">MOTOS</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-[#FFD700]">
          <div className="p-3 md:p-4 border-b border-[#FFD700] bg-[#0033A0]/30">
            <h2 className="text-xl md:text-2xl font-bold text-[#FFD700]">LISTADO DE INSCRIPCIONES</h2>
            <p className="mt-1 text-sm md:text-base">Resultados: {inscripcionesFiltradas.length} de {totalInscritos}</p>
          </div>
          
          {loading ? (
            <div className="p-6 md:p-12 text-center">
              <svg className="animate-spin h-8 w-8 md:h-12 md:w-12 mx-auto text-[#FFD700]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-3 md:mt-4 text-base md:text-xl font-bold">CARGANDO DATOS...</p>
            </div>
          ) : inscripcionesFiltradas.length === 0 ? (
            <div className="p-6 md:p-12 text-center">
              <p className="text-lg md:text-2xl font-bold text-[#FFD700]">NO HAY INSCRIPCIONES QUE COINCIDAN CON LOS FILTROS</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-[#0033A0] text-[#FFD700] sticky top-0">
                  <tr>
                    <th className="p-2 md:p-3 text-left font-bold">FECHA/HORA</th>
                    <th className="p-2 md:p-3 text-left font-bold">NOMBRE</th>
                    <th className="p-2 md:p-3 text-left font-bold">CÉDULA</th>
                    <th className="p-2 md:p-3 text-left font-bold">PLACA</th>
                    <th className="p-2 md:p-3 text-left font-bold">SECTOR</th>
                  </tr>
                </thead>
                <tbody>
                  {inscripcionesFiltradas.map((ins, index) => (
                    <tr 
                      key={ins.id} 
                      className={`border-b border-white/15 ${
                        index % 2 === 0 ? 'bg-white/5' : 'bg-white/10'
                      } hover:bg-[#FFD700]/10 transition-colors`}
                    >
                      <td className="p-2 md:p-3 font-mono text-[10px] md:text-xs">{ins.fechaFormateada}</td>
                      <td className="p-2 md:p-3 font-bold text-xs md:text-sm truncate max-w-37.5 md:max-w-none">{ins.nombreCompleto}</td>
                      <td className="p-2 md:p-3 font-mono text-xs md:text-sm">{ins.cedula}</td>
                      <td className="p-2 md:p-3 font-mono text-xs md:text-sm">{ins.placa}</td>
                      <td className="p-2 md:p-3 font-bold text-[#FFD700] text-xs md:text-sm">{ins.sector}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-[#001a4d] mt-6 md:mt-8 py-4 text-center border-t border-[#FFD700]">
        <div className="container mx-auto px-4">
          <p className="font-bold text-sm md:text-base">© {new Date().getFullYear()} PARTIDO CONSERVADOR COLOMBIANO - TARJETÓN C 101</p>
          <p className="mt-1 text-xs md:text-sm">Sistema de monitoreo en tiempo real - Inscripciones de motos para Juan Manuel Londoño</p>
          <p className="mt-2 font-bold text-yellow-300 text-xs md:text-sm">¡Juntos por una Colombia mejor con el Tarjetón C 101!</p>
          <p className="mt-1 text-xs font-bold">MARQUE EN EL TARJETÓN: LETRA C Y NÚMERO 101</p>
        </div>
      </footer>
    </div>
  );
}