// app/inscripcion/page.js
'use client';

import { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

export default function InscripcionPage() {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    cedula: '',
    celular: '',
    lider: '', // NUEVO CAMPO
    tipoVehiculo: 'moto',
    placa: '',
    municipio: 'Manizales'
  });
  const [soatFile, setSoatFile] = useState(null); // NUEVO: archivo SOAT
  const [soatPreview, setSoatPreview] = useState(null); // NUEVO: preview SOAT
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingSoat, setUploadingSoat] = useState(false); // NUEVO: estado de subida
  
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

  // Manejar cambio de archivo SOAT
  const handleSoatChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setError('SOLO SE PERMITEN IMÁGENES PARA EL SOAT');
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('LA IMAGEN DEL SOAT NO PUEDE SUPERAR 5MB');
        return;
      }
      
      setSoatFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setSoatPreview(reader.result);
      };
      reader.readAsDataURL(file);
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
    if (!soatFile) {
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

  // Subir imagen SOAT a Firebase Storage
  const uploadSoatImage = async (file) => {
    try {
      setUploadingSoat(true);
      
      // Crear referencia única para la imagen
      const timestamp = Date.now();
      const fileName = `${formData.cedula}_${timestamp}_${file.name}`;
      const storageRef = ref(storage, `soat/${fileName}`);
      
      // Subir archivo
      await uploadBytes(storageRef, file);
      
      // Obtener URL pública
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (err) {
      console.error('Error subiendo SOAT:', err);
      throw new Error('ERROR AL SUBIR LA IMAGEN DEL SOAT');
    } finally {
      setUploadingSoat(false);
    }
  };

  // Manejo del submit
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
      
      // Subir imagen SOAT primero
      const soatUrl = await uploadSoatImage(soatFile);
      
      // Preparar datos
      const inscripcionData = {
        nombreCompleto: formData.nombreCompleto.trim(),
        cedula: formData.cedula.trim(),
        celular: formData.celular.trim(),
        lider: formData.lider.trim(), // NUEVO CAMPO
        tipoVehiculo: formData.tipoVehiculo,
        placa: formData.placa.trim(),
        municipio: formData.municipio,
        soatUrl: soatUrl, // NUEVO: URL de la imagen SOAT
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
      setSoatFile(null);
      setSoatPreview(null);
      
      setTimeout(() => setSuccess(false), 8000);
      
    } catch (err) {
      console.error('Error guardando:', err);
      
      if (err.code === 'permission-denied') {
        setError('❌ ERROR CRÍTICO: Reglas de Firebase bloqueando escritura. Contacte al administrador INMEDIATAMENTE.');
      } else if (err.code === 'invalid-argument' || err.code === 'failed-precondition') {
        setError('❌ DATOS INVÁLIDOS: Verifica todos los campos');
      } else if (err.code === 'unavailable') {
        setError('❌ SIN CONEXIÓN: Verifica tu internet e intenta nuevamente');
      } else {
        setError(`❌ ERROR (${err.code || 'DESCONOCIDO'}): ${err.message || 'Falló el registro'}`);
      }
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
      setUploadingSoat(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#DA291C] to-[#B01E16] text-white relative">
      <div className="relative z-10">
        <header className="py-3 px-3 border-b border-white bg-[#B01E16]/90 backdrop-blur-sm">
          <div className="container mx-auto flex justify-center items-center">
            <div className="flex items-center space-x-2">
              <div className="bg-white p-1.5 rounded-full shadow-lg border-2 border-white">
                <div className="w-8 h-8 bg-[#DA291C] rounded-full flex items-center justify-center">
                  <span className="font-bold text-white text-base leading-none">U</span>
                </div>
              </div>
              <div className="bg-white text-[#DA291C] font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-[#DA291C]">
                TARJETA U99
              </div>
            </div>
            <div className="ml-2.5 text-center">
              <h1 className="text-lg font-bold">PARTIDO DE LA U - UNIDAD NACIONAL</h1>
              <p className="text-xs mt-0.5">¡Por un Colombia mejor!</p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 py-3">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-4 mb-5 border-4 border-[#DA291C]">
              <div className="mb-4 overflow-hidden rounded-xl shadow-lg border-2 border-[#DA291C] relative h-64 md:h-72">
                <Image
                  src="/maria-irma.jpg"
                  alt="María Irma - Candidata al Senado Tarjeta U99"
                  fill
                  className="object-cover object-center" // MEJORADO: centrado de imagen
                  loading="lazy"
                />
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-[#DA291C] bg-opacity-85 text-white px-3 py-1.5 rounded-full border-2 border-white backdrop-blur-sm z-10">
                  <span className="font-bold text-sm">MARÍA IRMA</span>
                  <span className="ml-2 bg-white text-[#DA291C] font-bold px-2 py-0.5 rounded-full text-[10px]">TARJETA U99</span>
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-[#DA291C] mb-2">INSCRIPCIÓN DE VEHÍCULOS</h2>
                <div className="bg-[#DA291C] text-white py-1.5 px-3 rounded-full inline-block mb-2 border-2 border-white">
                  <p className="text-sm font-bold">EQUIPO DE TRABAJO ELECCIÓN SENADO</p>
                  <p className="text-xs">María Irma - Candidata al Senado U99</p>
                </div>
                <div className="bg-red-100 border-l-4 border-red-500 p-2.5 rounded-r">
                  <p className="font-bold text-red-800 text-xs">⚠️ IMPORTANTE:</p>
                  <p className="text-red-700 mt-0.5 text-[10px]">
                    • SOAT VIGENTE OBLIGATORIO<br/>
                    • CÉDULA Y CELULAR VÁLIDOS<br/>
                    • REGISTRO ILIMITADO
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
                  <p className="text-xs">¡Gracias por acompañar a María Irma en su campaña al Senado!</p>
                  <p className="mt-1 text-[10px] font-bold">📱 Te contactaremos al celular proporcionado</p>
                  
                  <button
                    onClick={() => {
                      const mensaje = `🚗❤️ ¡YA ME INSCRIBÍ! 🇨🇴\n\nVoy a acompañar a MARÍA IRMA U99 en su campaña al Senado 🏛️\n\n¡Únete tú también! Es rápido y seguro:\n${window.location.origin}/inscripcion\n\n#U99 #PartidoDeLaU #MaríaIrma #Senado 💔✨`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
                    }}
                    className="mt-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-2 px-4 rounded-lg text-xs transition-all shadow-md flex items-center justify-center mx-auto"
                  >
                    <span className="mr-1">📲</span> INVITAR AMIGOS
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 bg-red-50 p-3.5 rounded-xl border border-red-200">
                <div>
                  <label className="block text-[10px] font-bold text-[#DA291C] mb-0.5">NOMBRE COMPLETO *</label>
                  <input
                    type="text"
                    name="nombreCompleto"
                    value={formData.nombreCompleto}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-2.5 py-1.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-[#DA291C] font-bold text-xs placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="EJ: JUAN PEREZ"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#DA291C] mb-0.5">CÉDULA *</label>
                  <input
                    type="text"
                    name="cedula"
                    value={formData.cedula}
                    onChange={handleInputChange}
                    required
                    maxLength="10"
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-2.5 py-1.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-[#DA291C] font-bold text-xs placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="SOLO NÚMEROS"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#DA291C] mb-0.5">NÚMERO DE CELULAR *</label>
                  <input
                    type="tel"
                    name="celular"
                    value={formData.celular}
                    onChange={handleInputChange}
                    required
                    maxLength="10"
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-2.5 py-1.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-[#DA291C] font-bold text-xs placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="EJ: 3001234567"
                  />
                  <p className="text-[8px] text-[#DA291C] mt-0.5 font-bold">CELULAR MÓVIL COLOMBIANO (10 DÍGITOS, INICIA CON 3)</p>
                </div>

                {/* NUEVO CAMPO: LÍDER */}
                <div>
                  <label className="block text-[10px] font-bold text-[#DA291C] mb-0.5">NOMBRE DEL LÍDER QUE TE REFIERE *</label>
                  <input
                    type="text"
                    name="lider"
                    value={formData.lider}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-2.5 py-1.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-[#DA291C] font-bold text-xs placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="EJ: PEDRO GOMEZ"
                  />
                  <p className="text-[8px] text-[#DA291C] mt-0.5 font-bold">EL LÍDER QUE TE INVITA A PARTICIPAR</p>
                </div>

                {/* NUEVO CAMPO: IMAGEN SOAT */}
                <div>
                  <label className="block text-[10px] font-bold text-[#DA291C] mb-0.5">SOAT VIGENTE (IMAGEN) *</label>
                  <div className="border-2 border-dashed border-[#DA291C] rounded-lg p-4 bg-white text-center">
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
                        <div className="space-y-2">
                          <div className="relative w-32 h-32 mx-auto">
                            <Image
                              src={soatPreview}
                              alt="Vista previa SOAT"
                              fill
                              className="object-contain rounded-lg border-2 border-[#DA291C]"
                            />
                          </div>
                          <p className="text-[#DA291C] text-xs font-bold">✅ IMAGEN CARGADA</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setSoatFile(null);
                              setSoatPreview(null);
                            }}
                            className="text-[8px] text-[#DA291C] hover:underline"
                          >
                            Cambiar imagen
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="mx-auto w-12 h-12 bg-[#DA291C]/10 rounded-full flex items-center justify-center">
                            <span className="text-3xl">📄</span>
                          </div>
                          <p className="text-[#DA291C] text-xs font-bold">SUBIR IMAGEN DEL SOAT</p>
                          <p className="text-[8px] text-[#DA291C]/70">Toca para seleccionar imagen (máx. 5MB)</p>
                        </div>
                      )}
                    </label>
                  </div>
                  <p className="text-[8px] text-[#DA291C] mt-1 font-bold">OBLIGATORIO - SOAT VIGENTE DEL VEHÍCULO</p>
                </div>

                {/* Tipo de vehículo */}
                <div>
                  <label className="block text-[10px] font-bold text-[#DA291C] mb-0.5">TIPO DE VEHÍCULO *</label>
                  <select
                    name="tipoVehiculo"
                    value={formData.tipoVehiculo}
                    onChange={handleInputChange}
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-2.5 py-1.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-[#DA291C] font-bold text-xs appearance-none ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="moto" className="bg-white text-[#DA291C] font-bold">🏍️ MOTO</option>
                    <option value="vehiculo" className="bg-white text-[#DA291C] font-bold">🚗 VEHÍCULO PARTICULAR</option>
                    <option value="jeep" className="bg-white text-[#DA291C] font-bold">🚙 JEEP/4X4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#DA291C] mb-0.5">PLACA DEL VEHÍCULO *</label>
                  <input
                    type="text"
                    name="placa"
                    value={formData.placa}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-2.5 py-1.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-[#DA291C] font-bold text-xs placeholder-[#DA291C]/50 ${
                      (isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="EJ: ABC123 (MOTOS) o FGH789 (VEHÍCULOS)"
                  />
                  <p className="text-[8px] text-[#DA291C] mt-0.5 font-bold">INGRESA LA PLACA COMPLETA DE TU VEHÍCULO</p>
                </div>

                {/* Municipio (27 municipios de Caldas) */}
                <div>
                  <label className="block text-[10px] font-bold text-[#DA291C] mb-0.5">MUNICIPIO DE CALDAS *</label>
                  <select
                    name="municipio"
                    value={formData.municipio}
                    onChange={handleInputChange}
                    disabled={isLoading || isSubmitting}
                    className={`w-full px-2.5 py-1.5 bg-white border-2 border-[#DA291C] rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-[#DA291C] font-bold text-xs appearance-none ${
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
                  disabled={isLoading || isSubmitting || uploadingSoat}
                  className={`w-full bg-[#DA291C] hover:bg-[#B01E16] text-white font-bold text-sm py-2.5 px-4 rounded-lg transition-all duration-300 shadow-lg border-2 border-white ${
                    (isLoading || isSubmitting || uploadingSoat) ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'
                  }`}
                >
                  {isLoading || isSubmitting || uploadingSoat ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {uploadingSoat ? 'SUBIENDO SOAT...' : error.includes('Verificando') || error.includes('Verificación lenta') ? error : 'PROCESANDO... ESPERA POR FAVOR'}
                    </span>
                  ) : (
                    '✅ INSCRIBIR VEHÍCULO AHORA ✅'
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-[#DA291C] text-center bg-red-50 p-2.5 rounded-b-xl">
                <p className="font-bold text-[#DA291C] text-xs">✅ REGISTRO ILIMITADO Y GRATUITO</p>
                <p className="mt-0.5 font-bold text-[#DA291C] text-xs">📄 SOAT VIGENTE OBLIGATORIO</p>
                <p className="mt-1 text-[#DA291C] font-bold text-[10px]">VOTA EN LA TARJETA: U99</p>
              </div>
            </div>

            <div className="text-center text-white text-[10px] mt-2.5">
              <p>PLATAFORMA OFICIAL - PARTIDO DE LA U UNIDAD NACIONAL</p>
              <p className="mt-0.5">María Irma - Candidata al Senado U99</p>
              <div className="mt-2 flex justify-center space-x-3">
                <span className="text-xl">🇨🇴</span>
                <span className="text-xl">❤️</span>
                <span className="text-xl font-bold">U 99</span>
              </div>
            </div>
          </div>
        </main>

        <footer className="bg-[#B01E16] mt-4 py-2.5 text-center border-t border-white">
          <div className="container mx-auto px-3 text-white">
            <p className="font-bold text-[10px]">© {new Date().getFullYear()} PARTIDO DE LA U - UNIDAD NACIONAL - TARJETA U99</p>
            <p className="mt-0.5 text-[8px]">Sistema de inscripción oficial - 27 Municipios de Caldas</p>
          </div>
        </footer>
      </div>
    </div>
  );
}