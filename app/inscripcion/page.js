// app/inscripcion/page.js
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import Image from 'next/image';

export default function InscripcionPage() {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    cedula: '',
    celular: '',
    lider: '',
    tipoVehiculo: 'moto',
    placa: '',
    municipio: 'Manizales'
  });
  const [soatBase64, setSoatBase64] = useState(null); // NUEVO: Base64 en lugar de archivo
  const [soatPreview, setSoatPreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // NUEVO: Paleta de colores mejorada del Partido de la U
  const coloresU = {
    rojoPrincipal: '#DA291C',
    rojoOscuro: '#B01E16',
    rojoClaro: '#E84232',
    blanco: '#FFFFFF',
    blancoSuave: '#F8F9FA',
    grisClaro: '#F1F3F5',
    grisMedio: '#6C757D',
    dorado: '#FFD700',
    doradoOscuro: '#FFC107',
    negro: '#212529',
    rojoHover: '#C4261A',
    rojoFondo: '#FFF5F5',
    borderGris: '#DEE2E6'
  };
  
  // Municipios de Caldas agrupados por zonas
  const municipiosPorZona = {
    'Centro Sur': ['Manizales', 'Chinchiná', 'Neira', 'Palestina', 'Villamaría'],
    'Alto Occidente': ['Filadelfia', 'La Merced', 'Marmato', 'Riosucio', 'Supía'],
    'Occidente': ['Anserma', 'Belalcázar', 'Risaralda', 'San José', 'Viterbo'],
    'Norte': ['Aguadas', 'Aranzazu', 'Pácora', 'Salamina'],
    'Oriente': ['Manzanares', 'Marquetalia', 'Marulanda', 'Pensilvania', 'Samaná'],
    'Magdalena Caldense': ['La Dorada', 'Norcasia', 'Victoria']
  };

  const todosMunicipios = Object.values(municipiosPorZona).flat();

  // Manejar cambio de inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'cedula') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/[^0-9]/g, '') }));
    } else if (name === 'celular') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/[^0-9]/g, '').slice(0, 10) }));
    } else if (name === 'placa') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/[^A-Z0-9]/gi, '').toUpperCase() }));
    } else if (name === 'nombreCompleto' || name === 'lider') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // NUEVO: Convertir imagen a Base64
  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // Manejar cambio de archivo SOAT
  const handleSoatChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setError('SOLO SE PERMITEN IMÁGENES PARA EL SOAT');
        return;
      }
      
      // Validar tamaño (máximo 1MB para Firestore)
      if (file.size > 1 * 1024 * 1024) {
        setError('LA IMAGEN DEL SOAT NO PUEDE SUPERAR 1MB (LÍMITE DE FIRESTORE)');
        return;
      }
      
      try {
        // Convertir a Base64
        const base64 = await convertToBase64(file);
        setSoatBase64(base64);
        
        // Crear preview
        setSoatPreview(base64);
      } catch (err) {
        console.error('Error convirtiendo imagen:', err);
        setError('ERROR AL PROCESAR LA IMAGEN');
      }
    }
  };

  // Validación del formulario
  const validateForm = () => {
    setError('');
    
    if (!formData.nombreCompleto.trim()) {
      setError('EL NOMBRE COMPLETO ES REQUERIDO');
      return false;
    }
    if (formData.cedula.length < 6 || formData.cedula.length > 10) {
      setError('CÉDULA DEBE TENER 6-10 DÍGITOS');
      return false;
    }
    if (formData.celular.length !== 10) {
      setError('CELULAR DEBE TENER 10 DÍGITOS (INICIAR CON 3)');
      return false;
    }
    if (!formData.celular.startsWith('3')) {
      setError('CELULAR INVÁLIDO: DEBE INICIAR CON 3 (NÚMERO MÓVIL COLOMBIANO)');
      return false;
    }
    if (!formData.lider.trim()) {
      setError('EL NOMBRE DEL LÍDER ES REQUERIDO');
      return false;
    }
    if (!soatBase64) {
      setError('DEBES SUBIR LA IMAGEN DEL SOAT VIGENTE');
      return false;
    }
    if (formData.placa.length < 5) {
      setError('PLACA DEBE TENER AL MENOS 5 CARACTERES');
      return false;
    }
    return true;
  };

  // Verificación de duplicados
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

  // Manejo del submit SIN STORAGE
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) {
      setError('⚠️ ESPERA: Ya se está procesando tu inscripción...');
      return;
    }
    
    setError('');
    setSuccess(false);
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setIsLoading(true);
    
    try {
      const isDuplicate = await checkDuplicates();
      if (isDuplicate && !error.includes('Verificación lenta')) {
        setIsSubmitting(false);
        setIsLoading(false);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Preparar datos con Base64
      const inscripcionData = {
        nombreCompleto: formData.nombreCompleto.trim(),
        cedula: formData.cedula.trim(),
        celular: formData.celular.trim(),
        lider: formData.lider.trim(),
        tipoVehiculo: formData.tipoVehiculo,
        placa: formData.placa.trim(),
        municipio: formData.municipio,
        soatBase64: soatBase64, // GUARDAR COMO BASE64
        createdAt: new Date()
      };

      // Guardar en Firestore
      await addDoc(collection(db, 'inscripciones'), inscripcionData);
      
      // Éxito
      setSuccess(true);
      setFormData({
        nombreCompleto: '',
        cedula: '',
        celular: '',
        lider: '',
        tipoVehiculo: 'moto',
        placa: '',
        municipio: 'Manizales'
      });
      setSoatBase64(null);
      setSoatPreview(null);
      
      setTimeout(() => setSuccess(false), 8000);
      
    } catch (err) {
      console.error('Error guardando:', err);
      
      if (err.code === 'permission-denied') {
        setError('❌ ERROR CRÍTICO: Reglas de Firebase bloqueando escritura. Contacte al administrador INMEDIATAMENTE.');
      } else if (err.code === 'invalid-argument' || err.code === 'failed-precondition') {
        setError('❌ DATOS INVÁLIDOS: Verifica todos los campos. La imagen debe ser menor a 1MB.');
      } else if (err.code === 'unavailable') {
        setError('❌ SIN CONEXIÓN: Verifica tu internet e intenta nuevamente');
      } else {
        setError(`❌ ERROR (${err.code || 'DESCONOCIDO'}): ${err.message || 'Falló el registro'}`);
      }
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#DA291C] via-[#B01E16] to-[#8B1712] text-white relative">
      <div className="relative z-10">
        <header className="py-4 px-3 border-b-2 border-white bg-[#B01E16]/95 backdrop-blur-sm">
          <div className="container mx-auto flex justify-center items-center">
            <div className="flex items-center space-x-2">
              <div className="bg-white p-1.5 rounded-full shadow-lg border-2 border-[#FFD700]">
                <div className="w-9 h-9 bg-[#DA291C] rounded-full flex items-center justify-center">
                  <span className="font-bold text-white text-lg leading-none">U</span>
                </div>
              </div>
              <div className="bg-[#FFD700] text-[#DA291C] font-bold px-3 py-1 rounded-full text-xs border-2 border-[#DA291C] shadow-lg">
                TARJETA U99
              </div>
            </div>
            <div className="ml-3 text-center">
              <h1 className="text-xl font-bold">PARTIDO DE LA U - UNIDAD NACIONAL</h1>
              <p className="text-sm mt-0.5 font-semibold">¡Por un Colombia mejor!</p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 py-3">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-5 mb-5 border-4 border-[#DA291C]">
              <div className="mb-5 overflow-hidden rounded-xl shadow-2xl border-3 border-[#DA291C] relative h-64 md:h-72">
                <Image
                  src="/maria-irma.jpg"
                  alt="María Irma - Candidata al Senado Tarjeta U99"
                  fill
                  className="object-cover object-center"
                  loading="lazy"
                />
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-[#DA291C] bg-opacity-90 text-white px-4 py-2 rounded-full border-2 border-[#FFD700] backdrop-blur-sm z-10 shadow-lg">
                  <span className="font-bold text-base">MARÍA IRMA</span>
                  <span className="ml-2 bg-[#FFD700] text-[#DA291C] font-bold px-3 py-1 rounded-full text-xs">TARJETA U99</span>
                </div>
              </div>
              
              <div className="text-center mb-5">
                <h2 className="text-2xl md:text-3xl font-bold text-[#DA291C] mb-3">INSCRIPCIÓN DE VEHÍCULOS</h2>
                <div className="bg-[#DA291C] text-white py-2 px-4 rounded-full inline-block mb-3 border-2 border-[#FFD700] shadow-lg">
                  <p className="text-base font-bold">EQUIPO DE TRABAJO ELECCIÓN SENADO</p>
                  <p className="text-sm">María Irma - Candidata al Senado U99</p>
                </div>
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r shadow-md">
                  <p className="font-bold text-red-800 text-sm">⚠️ IMPORTANTE:</p>
                  <p className="text-red-700 mt-1 text-xs">
                    • SOAT VIGENTE OBLIGATORIO<br/>
                    • IMAGEN MÁXIMO 1MB<br/>
                    • CÉDULA Y CELULAR VÁLIDOS
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg mb-4 text-center font-bold text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded-lg mb-4 text-center shadow-lg">
                  <h3 className="text-xl font-bold mb-1">¡INSCRIPCIÓN EXITOSA! 🎉</h3>
                  <p className="text-sm">¡Gracias por acompañar a María Irma en su campaña al Senado!</p>
                  <p className="mt-2 text-sm font-bold">📱 Te contactaremos al celular proporcionado</p>
                  
                  <button
                    onClick={() => {
                      const mensaje = `🚗❤️ ¡YA ME INSCRIBÍ! 🇨🇴\n\nVoy a acompañar a MARÍA IRMA U99 en su campaña al Senado 🏛️\n\n¡Únete tú también! Es rápido y seguro:\n${window.location.origin}/inscripcion\n\n#U99 #PartidoDeLaU #MaríaIrma #Senado 💔✨`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
                    }}
                    className="mt-4 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all shadow-md flex items-center justify-center mx-auto"
                  >
                    <span className="mr-2 text-xl">📲</span> INVITAR AMIGOS
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 bg-[#FFF5F5] p-4 rounded-xl border border-[#DA291C]/30">
                <div>
                  <label className="block text-xs font-bold text-[#DA291C] mb-1">NOMBRE COMPLETO *</label>
                  <input
                    type="text"
                    name="nombreCompleto"
                    value={formData.nombreCompleto}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-3.5 py-2.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-[#212529] font-bold text-sm placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="EJ: JUAN PEREZ"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#DA291C] mb-1">CÉDULA *</label>
                  <input
                    type="text"
                    name="cedula"
                    value={formData.cedula}
                    onChange={handleInputChange}
                    required
                    maxLength="10"
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-3.5 py-2.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-[#212529] font-bold text-sm placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="SOLO NÚMEROS"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#DA291C] mb-1">NÚMERO DE CELULAR *</label>
                  <input
                    type="tel"
                    name="celular"
                    value={formData.celular}
                    onChange={handleInputChange}
                    required
                    maxLength="10"
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-3.5 py-2.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-[#212529] font-bold text-sm placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="EJ: 3001234567"
                  />
                  <p className="text-[10px] text-[#DA291C] mt-1 font-bold">CELULAR MÓVIL COLOMBIANO (10 DÍGITOS, INICIA CON 3)</p>
                </div>

                {/* NUEVO CAMPO: LÍDER */}
                <div>
                  <label className="block text-xs font-bold text-[#DA291C] mb-1">NOMBRE DEL LÍDER QUE TE REFIERE *</label>
                  <input
                    type="text"
                    name="lider"
                    value={formData.lider}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-3.5 py-2.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-[#212529] font-bold text-sm placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="EJ: PEDRO GOMEZ"
                  />
                  <p className="text-[10px] text-[#DA291C] mt-1 font-bold">EL LÍDER QUE TE INVITA A PARTICIPAR</p>
                </div>

                {/* NUEVO CAMPO: IMAGEN SOAT COMO BASE64 */}
                <div>
                  <label className="block text-xs font-bold text-[#DA291C] mb-1">SOAT VIGENTE (IMAGEN) *</label>
                  <div className="border-2 border-dashed border-[#DA291C] rounded-lg p-5 bg-white text-center hover:border-[#FFD700] hover:shadow-lg transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSoatChange}
                      disabled={isLoading || isSubmitting}
                      className="hidden"
                      id="soat-upload"
                    />
                    <label 
                      htmlFor="soat-upload" 
                      className={`cursor-pointer block ${
                        (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {soatPreview ? (
                        <div className="space-y-3">
                          <div className="relative w-40 h-40 mx-auto">
                            <Image
                              src={soatPreview}
                              alt="Vista previa SOAT"
                              fill
                              className="object-contain rounded-lg border-3 border-[#DA291C] shadow-lg"
                            />
                          </div>
                          <p className="text-[#DA291C] text-sm font-bold">✅ IMAGEN CARGADA (BASE64)</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setSoatBase64(null);
                              setSoatPreview(null);
                            }}
                            className="text-xs text-[#DA291C] hover:underline font-bold"
                          >
                            Cambiar imagen
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="mx-auto w-16 h-16 bg-[#DA291C]/10 rounded-full flex items-center justify-center">
                            <span className="text-4xl">📄</span>
                          </div>
                          <p className="text-[#DA291C] text-sm font-bold">SUBIR IMAGEN DEL SOAT</p>
                          <p className="text-xs text-[#DA291C]/70">Toca para seleccionar imagen (máx. 1MB)</p>
                        </div>
                      )}
                    </label>
                  </div>
                  <p className="text-[10px] text-[#DA291C] mt-2 font-bold">OBLIGATORIO - SOAT VIGENTE (GUARDADO COMO BASE64)</p>
                </div>

                {/* Tipo de vehículo */}
                <div>
                  <label className="block text-xs font-bold text-[#DA291C] mb-1">TIPO DE VEHÍCULO *</label>
                  <select
                    name="tipoVehiculo"
                    value={formData.tipoVehiculo}
                    onChange={handleInputChange}
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-3.5 py-2.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-[#212529] font-bold text-sm appearance-none ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="moto" className="bg-white text-[#DA291C] font-bold">🏍️ MOTO</option>
                    <option value="vehiculo" className="bg-white text-[#DA291C] font-bold">🚗 VEHÍCULO PARTICULAR</option>
                    <option value="jeep" className="bg-white text-[#DA291C] font-bold">🚙 JEEP/4X4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#DA291C] mb-1">PLACA DEL VEHÍCULO *</label>
                  <input
                    type="text"
                    name="placa"
                    value={formData.placa}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-3.5 py-2.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-[#212529] font-bold text-sm placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="EJ: ABC123 (MOTOS) o FGH789 (VEHÍCULOS)"
                  />
                  <p className="text-[10px] text-[#DA291C] mt-1 font-bold">INGRESA LA PLACA COMPLETA DE TU VEHÍCULO</p>
                </div>

                {/* Municipio (27 municipios de Caldas) */}
                <div>
                  <label className="block text-xs font-bold text-[#DA291C] mb-1">MUNICIPIO DE CALDAS *</label>
                  <select
                    name="municipio"
                    value={formData.municipio}
                    onChange={handleInputChange}
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-3.5 py-2.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-[#212529] font-bold text-sm appearance-none ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {Object.entries(municipiosPorZona).map(([zona, municipios]) => (
                      <optgroup key={zona} label={`--- ${zona.toUpperCase()} ---`}>
                        {municipios.map(municipio => (
                          <option key={municipio} value={municipio} className="bg-white text-[#DA291C] font-bold">
                            {municipio}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isSubmitting}
                  className={`w-full bg-[#DA291C] hover:bg-[#E84232] text-white font-bold text-base py-3.5 px-6 rounded-lg transition-all duration-300 shadow-2xl border-2 border-[#FFD700] ${
                    (isLoading || isSubmitting) ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-2xl hover:scale-105'
                  }`}
                >
                  {isLoading || isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {error.includes('Verificando') || error.includes('Verificación lenta') ? error : 'PROCESANDO... ESPERA POR FAVOR'}
                    </span>
                  ) : (
                    '✅ INSCRIBIR VEHÍCULO AHORA ✅'
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-[#DA291C] text-center bg-[#FFF5F5] p-3.5 rounded-b-xl">
                <p className="font-bold text-[#DA291C] text-sm">✅ REGISTRO ILIMITADO Y GRATUITO</p>
                <p className="mt-1 font-bold text-[#DA291C] text-sm">📄 SOAT VIGENTE OBLIGATORIO (MÁX. 1MB)</p>
                <p className="mt-1 text-[#DA291C] font-bold text-xs">VOTA EN LA TARJETA: U99</p>
              </div>
            </div>

            <div className="text-center text-white text-xs mt-3">
              <p className="font-bold">PLATAFORMA OFICIAL - PARTIDO DE LA U UNIDAD NACIONAL</p>
              <p className="mt-1">María Irma - Candidata al Senado U99</p>
              <div className="mt-3 flex justify-center space-x-4">
                <span className="text-2xl">🇨🇴</span>
                <span className="text-2xl">❤️</span>
                <span className="text-2xl font-bold">U 99</span>
              </div>
            </div>
          </div>
        </main>

        <footer className="bg-[#8B1712] mt-5 py-3.5 text-center border-t-2 border-[#FFD700]">
          <div className="container mx-auto px-3 text-white">
            <p className="font-bold text-sm">© {new Date().getFullYear()} PARTIDO DE LA U - UNIDAD NACIONAL - TARJETA U99</p>
            <p className="mt-1 text-xs">Sistema de inscripción oficial - 27 Municipios de Caldas</p>
          </div>
        </footer>
      </div>
    </div>
  );
}