/**
 * rucValidator.js
 * Módulo para la validación de RUC Ecuatoriano
 */

'use strict';

/**
 * Valida un número de RUC Ecuatoriano.
 * @param {string} ruc - El número de RUC a validar.
 * @returns {object} { valido: boolean, tipo: string, provincia: string, mensaje: string }
 */
const validarRucEcuatoriano = (ruc) => {
  if (!ruc || typeof ruc !== 'string') {
    return { valido: false, mensaje: 'RUC no ingresado o formato incorrecto' };
  }

  // 1. Longitud y caracteres numéricos
  if (ruc.length !== 13 || !/^\d{13}$/.test(ruc)) {
    return { valido: false, mensaje: 'El RUC debe tener exactamente 13 dígitos numéricos' };
  }

  // 2. Validación de Provincia
  const provinciaCode = parseInt(ruc.substring(0, 2), 10);
  if ((provinciaCode < 1 || provinciaCode > 24) && provinciaCode !== 30) {
    return { valido: false, mensaje: 'Código de provincia inválido' };
  }

  const provinciasMap = {
    1: 'Azuay', 2: 'Bolívar', 3: 'Cañar', 4: 'Carchi', 5: 'Cotopaxi',
    6: 'Chimborazo', 7: 'El Oro', 8: 'Esmeraldas', 9: 'Guayas', 10: 'Imbabura',
    11: 'Loja', 12: 'Los Ríos', 13: 'Manabí', 14: 'Morona Santiago', 15: 'Napo',
    16: 'Pastaza', 17: 'Pichincha', 18: 'Tungurahua', 19: 'Zamora Chinchipe',
    20: 'Galápagos', 21: 'Sucumbíos', 22: 'Orellana', 23: 'Santo Domingo de los Tsáchilas',
    24: 'Santa Elena', 30: 'Extranjero'
  };
  const provinciaName = provinciasMap[provinciaCode];

  // 4. Validación de establecimiento
  const establecimiento = parseInt(ruc.substring(10, 13), 10);
  if (establecimiento === 0) {
    return { valido: false, mensaje: 'El establecimiento no puede ser 000' };
  }

  // 3. y 5. Identificar Tipo de RUC y Validar Dígito Verificador
  const tercerDigito = parseInt(ruc.substring(2, 3), 10);
  let tipo = '';
  let modulo = 0;
  let coeficientes = [];
  let digitoVerificador = 0;
  let suma = 0;

  if (tercerDigito >= 0 && tercerDigito <= 5) {
    // Persona Natural
    tipo = 'Persona Natural';
    modulo = 10;
    coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    digitoVerificador = parseInt(ruc.substring(9, 10), 10);
    
    for (let i = 0; i < 9; i++) {
      let producto = parseInt(ruc.charAt(i), 10) * coeficientes[i];
      if (producto > 9) producto -= 9;
      suma += producto;
    }
  } else if (tercerDigito === 6) {
    // Sector Público
    tipo = 'Sector Público';
    modulo = 11;
    coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
    digitoVerificador = parseInt(ruc.substring(8, 9), 10);
    
    for (let i = 0; i < 8; i++) {
      suma += parseInt(ruc.charAt(i), 10) * coeficientes[i];
    }
  } else if (tercerDigito === 9) {
    // Sociedad Privada o Extranjera
    tipo = 'Sociedad Privada o Extranjera';
    modulo = 11;
    coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    digitoVerificador = parseInt(ruc.substring(9, 10), 10);
    
    for (let i = 0; i < 9; i++) {
      suma += parseInt(ruc.charAt(i), 10) * coeficientes[i];
    }
  } else {
    return { valido: false, mensaje: 'Tercer dígito inválido para RUC' };
  }

  let residuo = suma % modulo;
  let digitoCalculado = residuo === 0 ? 0 : modulo - residuo;

  if (digitoCalculado !== digitoVerificador) {
    return { valido: false, mensaje: 'Dígito verificador incorrecto' };
  }

  return {
    valido: true,
    tipo,
    provincia: provinciaName,
    mensaje: 'RUC válido'
  };
};

module.exports = { validarRucEcuatoriano };
