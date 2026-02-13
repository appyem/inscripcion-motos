// app/inscripcion/page.js
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import Image from 'next/image';

export default function InscripcionPage() {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    fechaNacimiento: '',
    cedula: '',
    celular: '', // NUEVO CAMPO
    placa: '',
    sector: 'Samaria'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [edadValida, setEdadValida] = useState(true);
  const sectores = ['Samaria', 'San Luis', 'Morritos', 'Verso', 'Soledad', 'Paila', 'El Pintado', 'Otro'];

  // Convertir texto a mayúsculas automáticamente
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'cedula') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/[^0-9]/g, '') }));
    } else if (name === 'celular') {
      // Solo números, máximo 10 dígitos (formato colombiano)
      setFormData(prev => ({ ...prev, [name]: value.replace(/[^0-9]/g, '').slice(0, 10) }));
    } else if (name === 'placa') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5) }));
    } else if (name === 'nombreCompleto') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Validar edad en tiempo real
  useEffect(() => {
    if (formData.fechaNacimiento) {
      const hoy = new Date();
      const fechaNac = new Date(formData.fechaNacimiento);
      let edad = hoy.getFullYear() - fechaNac.getFullYear();
      const mes = hoy.getMonth() - fechaNac.getMonth();
      const dia = hoy.getDate() - fechaNac.getDate();
      
      if (mes < 0 || (mes === 0 && dia < 0)) {
        edad--;
      }
      
      setEdadValida(edad >= 18);
    }
  }, [formData.fechaNacimiento]);

  // Validación del formulario CON CELULAR
  const validateForm = () => {
    setError('');
    
    if (!formData.nombreCompleto.trim()) {
      setError('EL NOMBRE COMPLETO ES REQUERIDO');
      return false;
    }
    if (!formData.fechaNacimiento) {
      setError('LA FECHA DE NACIMIENTO ES REQUERIDA');
      return false;
    }
    if (!edadValida) {
      setError('DEBES SER MAYOR DE 18 AÑOS');
      return false;
    }
    if (formData.cedula.length < 6 || formData.cedula.length > 10) {
      setError('CÉDULA DEBE TENER 6-10 DÍGITOS');
      return false;
    }
    // VALIDACIÓN NUEVA: CELULAR COLOMBIANO
    if (formData.celular.length !== 10) {
      setError('CELULAR DEBE TENER 10 DÍGITOS (INICIAR CON 3)');
      return false;
    }
    if (!formData.celular.startsWith('3')) {
      setError('CELULAR INVÁLIDO: DEBE INICIAR CON 3 (NÚMERO MÓVIL COLOMBIANO)');
      return false;
    }
    if (formData.placa.length !== 5) {
      setError('PLACA DEBE TENER EXACTAMENTE 5 CARACTERES');
      return false;
    }
    if (!/^[A-Z]{3}[0-9]{2}$/.test(formData.placa)) {
      setError('FORMATO PLACA: 3 LETRAS + 2 NÚMEROS (EJ: ABC12)');
      return false;
    }
    return true;
  };

  // Verificación de duplicados MEJORADA
  const checkDuplicates = async () => {
    try {
      setError('🔍 Verificando duplicados...');
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      );
      
      // Verificar cédula
      const cedulaCheck = getDocs(query(
        collection(db, 'inscripciones'),
        where('cedula', '==', formData.cedula)
      ));
      
      const cedulaSnapshot = await Promise.race([cedulaCheck, timeoutPromise]);
      if (!cedulaSnapshot.empty) {
        setError('❌ ¡CÉDULA YA REGISTRADA! Usa otra cédula');
        return true;
      }

      // Verificar placa
      const placaCheck = getDocs(query(
        collection(db, 'inscripciones'),
        where('placa', '==', formData.placa)
      ));
      
      const placaSnapshot = await Promise.race([placaCheck, timeoutPromise]);
      if (!placaSnapshot.empty) {
        setError('❌ ¡PLACA YA REGISTRADA! Usa otra placa');
        return true;
      }

      setError('');
      return false;
    } catch (err) {
      console.error('Error en verificación:', err);
      
      if (err.message === 'TIMEOUT' || err.code === 'unavailable') {
        console.warn('Verificación de duplicados fallida. Permitiendo inscripción...');
        setError('⚠️ Verificación lenta. Continuando con precaución...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return false;
      }
      
      setError(`❌ ERROR: ${err.message || 'Verificación fallida'}`);
      return true;
    }
  };

  // Manejo del submit CON CELULAR
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    
    if (!validateForm()) return;
    
    const isDuplicate = await checkDuplicates();
    if (isDuplicate && !error.includes('Verificación lenta')) return;
    
    setIsLoading(true);
    
    try {
      // Preparar datos CON CELULAR
      const inscripcionData = {
        nombreCompleto: formData.nombreCompleto.trim(),
        fechaNacimiento: formData.fechaNacimiento,
        cedula: formData.cedula.trim(),
        celular: formData.celular.trim(), // NUEVO CAMPO
        placa: formData.placa.trim(),
        sector: formData.sector,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'inscripciones'), inscripcionData);
      
      // Éxito
      setSuccess(true);
      setFormData({
        nombreCompleto: '',
        fechaNacimiento: '',
        cedula: '',
        celular: '', // REINICIAR CAMPO
        placa: '',
        sector: 'Samaria'
      });
      
      setTimeout(() => setSuccess(false), 8000);
      
    } catch (err) {
      console.error('Error guardando:', err);
      
      if (err.code === 'permission-denied') {
        setError('❌ ERROR CRÍTICO: Reglas de Firebase bloqueando escritura. Contacte al administrador INMEDIATAMENTE.');
      } else if (err.code === 'invalid-argument' || err.code === 'failed-precondition') {
        setError('❌ DATOS INVÁLIDOS: Verifica formato de placa (ABC12), cédula y celular (10 dígitos)');
      } else if (err.code === 'unavailable') {
        setError('❌ SIN CONEXIÓN: Verifica tu internet e intenta nuevamente');
      } else {
        setError(`❌ ERROR (${err.code || 'DESCONOCIDO'}): ${err.message || 'Falló el registro'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0033A0] to-[#002266] text-white relative">
      <div className="relative z-10">
        <header className="py-3 px-3 border-b border-[#FFD700] bg-[#002266]/90 backdrop-blur-sm">
          <div className="container mx-auto flex justify-center items-center">
            <div className="flex items-center space-x-2">
              <div className="bg-white p-1.5 rounded-full shadow-lg border-2 border-[#FFD700]">
                <div className="w-8 h-8 bg-[#0033A0] rounded-full flex flex-col items-center justify-center">
                  <span className="font-bold text-white text-base leading-none">C</span>
                  <span className="font-bold text-[#FFD700] text-[7px] leading-none -mt-0.5">101</span>
                </div>
              </div>
              <div className="bg-[#FFD700] text-[#0033A0] font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-[#0033A0]">
                TARJETÓN C 101
              </div>
            </div>
            <div className="ml-2.5 text-center">
              <h1 className="text-lg font-bold">PARTIDO CONSERVADOR</h1>
              <p className="text-xs mt-0.5">¡Por un Colombia mejor!</p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 py-3">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-4 mb-5 border-4 border-[#FFD700]">
              <div className="mb-4 overflow-hidden rounded-xl shadow-lg border-2 border-[#0033A0] relative h-56 md:h-64">
                <Image
                  src="/candidato-optimizado.jpg"
                  alt="Juan Manuel Londoño - Candidato a la Cámara Tarjetón C 101"
                  fill
                  className="object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-2 left-2 bg-[#0033A0] bg-opacity-85 text-white px-2.5 py-1 rounded-full border-2 border-[#FFD700] backdrop-blur-sm z-10">
                  <span className="font-bold text-sm">JUAN MANUEL LONDOÑO</span>
                  <span className="ml-2 bg-[#FFD700] text-[#0033A0] font-bold px-2 py-0.5 rounded-full text-[10px]">TARJETÓN C 101</span>
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-[#0033A0] mb-2">INSCRIPCIÓN DE MOTOS</h2>
                <div className="bg-[#0033A0] text-white py-1.5 px-3 rounded-full inline-block mb-2 border-2 border-[#FFD700]">
                  <p className="text-sm font-bold">RECIBIMIENTO A JUAN MANUEL LONDOÑO</p>
                  <p className="text-xs">Candidato a la Cámara - Tarjetón C 101</p>
                </div>
                <div className="bg-red-100 border-l-4 border-red-500 p-2.5 rounded-r">
                  <p className="font-bold text-red-800 text-xs">⚠️ IMPORTANTE:</p>
                  <p className="text-red-700 mt-0.5 text-[10px]">
                    • MAYORES DE 18 AÑOS<br/>
                    • PLACA COLOMBIANA VÁLIDA (3 LETRAS + 2 NÚMEROS)<br/>
                    • CELULAR VÁLIDO PARA CONFIRMACIÓN
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg mb-3 text-center font-bold text-xs">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-lg mb-3 text-center">
                  <h3 className="text-base font-bold mb-0.5">¡INSCRIPCIÓN EXITOSA! 🎉</h3>
                  <p className="text-xs">¡Gracias por acompañar a Juan Manuel Londoño!</p>
                  <p className="mt-1 text-[10px] font-bold">📱 Te contactaremos al celular proporcionado</p>
                  
                  <button
                    onClick={() => {
                      const mensaje = `🏍️💙 ¡YA ME INSCRIBÍ! 🇨🇴\n\nVoy a acompañar a JUAN MANUEL LONDOÑO C101 al recibimiento 🏛️\n\n¡Únete tú también! Es rápido y seguro:\n${window.location.origin}/inscripcion\n\n#C101 #PartidoConservador 💙✨`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
                    }}
                    className="mt-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-2 px-4 rounded-lg text-xs transition-all shadow-md flex items-center justify-center mx-auto"
                  >
                    <span className="mr-1">📲</span> INVITAR AMIGOS
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 bg-blue-50 p-3.5 rounded-xl border border-blue-200">
                <div>
                  <label className="block text-[10px] font-bold text-[#0033A0] mb-0.5">NOMBRE COMPLETO *</label>
                  <input
                    type="text"
                    name="nombreCompleto"
                    value={formData.nombreCompleto}
                    onChange={handleInputChange}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border-2 border-[#0033A0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-[#0033A0] font-bold text-xs placeholder-[#0033A0]/50"
                    placeholder="EJ: JUAN PEREZ"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#0033A0] mb-0.5">FECHA NACIMIENTO *</label>
                  <input
                    type="date"
                    name="fechaNacimiento"
                    value={formData.fechaNacimiento}
                    onChange={handleInputChange}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border-2 border-[#0033A0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-[#0033A0] font-bold text-xs"
                  />
                  {!edadValida && formData.fechaNacimiento && (
                    <p className="text-red-600 font-bold mt-0.5 text-[10px]">❌ DEBES SER MAYOR DE 18 AÑOS</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#0033A0] mb-0.5">CÉDULA *</label>
                  <input
                    type="text"
                    name="cedula"
                    value={formData.cedula}
                    onChange={handleInputChange}
                    required
                    maxLength="10"
                    className="w-full px-2.5 py-1.5 bg-white border-2 border-[#0033A0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-[#0033A0] font-bold text-xs placeholder-[#0033A0]/50"
                    placeholder="SOLO NÚMEROS"
                  />
                </div>

                {/* NUEVO CAMPO: CELULAR */}
                <div>
                  <label className="block text-[10px] font-bold text-[#0033A0] mb-0.5">NÚMERO DE CELULAR *</label>
                  <input
                    type="tel"
                    name="celular"
                    value={formData.celular}
                    onChange={handleInputChange}
                    required
                    maxLength="10"
                    className="w-full px-2.5 py-1.5 bg-white border-2 border-[#0033A0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-[#0033A0] font-bold text-xs placeholder-[#0033A0]/50"
                    placeholder="EJ: 3001234567"
                  />
                  <p className="text-[8px] text-[#0033A0] mt-0.5 font-bold">CELULAR MÓVIL COLOMBIANO (10 DÍGITOS, INICIA CON 3)</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#0033A0] mb-0.5">PLACA MOTO *</label>
                  <input
                    type="text"
                    name="placa"
                    value={formData.placa}
                    onChange={handleInputChange}
                    required
                    maxLength="5"
                    className="w-full px-2.5 py-1.5 bg-white border-2 border-[#0033A0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-[#0033A0] font-bold text-xs placeholder-[#0033A0]/50"
                    placeholder="EJ: ABC12"
                  />
                  <p className="text-[8px] text-[#0033A0] mt-0.5 font-bold">3 LETRAS + 2 NÚMEROS (EJ: ABC12)</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#0033A0] mb-0.5">SECTOR *</label>
                  <select
                    name="sector"
                    value={formData.sector}
                    onChange={handleInputChange}
                    className="w-full px-2.5 py-1.5 bg-white border-2 border-[#0033A0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-[#0033A0] font-bold text-xs appearance-none"
                  >
                    {sectores.map((sector) => (
                      <option key={sector} value={sector} className="bg-white text-[#0033A0] font-bold">
                        {sector.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full bg-[#0033A0] hover:bg-[#002266] text-white font-bold text-sm py-2.5 px-4 rounded-lg transition-all duration-300 shadow-lg border-2 border-[#FFD700] ${
                    isLoading ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {error.includes('Verificando') || error.includes('Verificación lenta') ? error : 'ENVIANDO...'}
                    </span>
                  ) : (
                    '✅ INSCRIBIR MOTO AHORA ✅'
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-[#0033A0] text-center bg-blue-50 p-2.5 rounded-b-xl">
                <p className="font-bold text-[#0033A0] text-xs">✅ GRATIS Y SEGURO</p>
                <p className="mt-0.5 font-bold text-[#0033A0] text-xs">📱 CONFIRMACIÓN POR CELULAR INMEDIATA</p>
                <p className="mt-1 text-[#0033A0] font-bold text-[10px]">VOTA EN EL TARJETÓN: LETRA C Y NÚMERO 101</p>
              </div>
            </div>

            <div className="text-center text-white text-[10px] mt-2.5">
              <p>PLATAFORMA OFICIAL - PARTIDO CONSERVADOR COLOMBIANO</p>
              <p className="mt-0.5">Juan Manuel Londoño - Candidato a la Cámara</p>
              <div className="mt-2 flex justify-center space-x-3">
                <span className="text-xl">🇨🇴</span>
                <span className="text-xl">💙</span>
                <span className="text-xl font-bold">C 101</span>
              </div>
            </div>
          </div>
        </main>

        <footer className="bg-[#002266] mt-4 py-2.5 text-center border-t border-[#FFD700]">
          <div className="container mx-auto px-3 text-white">
            <p className="font-bold text-[10px]">© {new Date().getFullYear()} PARTIDO CONSERVADOR - TARJETÓN C 101</p>
            <p className="mt-0.5 text-[8px]">Sistema de inscripción oficial</p>
          </div>
        </footer>
      </div>
    </div>
  );
}