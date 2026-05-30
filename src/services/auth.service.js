/**
 * AuthService - Lógica de negocio de autenticación
 * Gestión de login stateless con JWT y recuperación de contraseña por email
 */

'use strict';

const crypto      = require('crypto');
const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const usuarioRepo = require('../repositories/usuario.repository');
const mailer      = require('../config/mailer');
const logger      = require('../config/logger');
const { AppError } = require('../middlewares/errorHandler');

const SALT_ROUNDS          = 12;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hora

/**
 * Genera un token JWT firmado
 */
const generateToken = (userId, rol) =>
  jwt.sign({ sub: userId, rol }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer:    'proformax-api',
  });

/**
 * Autentica a un usuario y retorna tokens
 */
const login = async (username, password, ip, _userAgent) => {
  // Normalizar a minúsculas para búsqueda case-insensitive
  const usernameLower = username?.toLowerCase().trim();
  const usuario = await usuarioRepo.findByUsername(usernameLower);

  if (!usuario || !usuario.estado) {
    throw new AppError('Usuario no encontrado o inactivo.', 401, 'INVALID_CREDENTIALS');
  }

  const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValido) {
    logger.warn(`[Auth] Intento fallido para ${usernameLower} desde ${ip}`);
    throw new AppError('Credenciales incorrectas.', 401, 'INVALID_CREDENTIALS');
  }

  const token = generateToken(usuario.id, usuario.rol);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

  logger.info(`[Auth] Login exitoso: ${usernameLower} desde ${ip}`);

  return {
    token,
    expiresAt,
    usuario: {
      id:       usuario.id,
      username: usuario.username,
      rol:      usuario.rol,
      estado:   usuario.estado,
    },
  };
};

/**
 * Logout stateless: el cliente descarta el token.
 */
const logout = async (_token) => {
  return true;
};

/**
 * Hashea una contraseña
 */
const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

// ─── Recuperación de Contraseña ───────────────────────────────────────────────

/**
 * Inicia el proceso de recuperación de contraseña.
 * Genera un token seguro, lo almacena hasheado en la BD y envía un correo.
 *
 * SEGURIDAD: siempre responde 200 para no revelar si el email existe o no.
 *
 * @param {string} email - Email del usuario que solicita recuperación
 */
const requestPasswordReset = async (email) => {
  const emailLower = email?.toLowerCase().trim();

  const usuario = await usuarioRepo.findByEmail(emailLower);

  // Si no existe o está inactivo, salimos silenciosamente (anti-enumeración)
  if (!usuario || !usuario.estado) {
    logger.info(`[Auth] Reset solicitado para email no registrado o inactivo: ${emailLower}`);
    return;
  }

  // Generar token aleatorio seguro (32 bytes → 64 hex chars)
  const rawToken    = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiry      = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  // Guardar en la BD el token hasheado
  await usuarioRepo.saveResetToken(usuario.id, hashedToken, expiry);

  // Construir enlace y enviar correo
  const frontendUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink    = `${frontendUrl}/reset-password?token=${rawToken}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto;">
      <h2 style="color: #1a1a2e;">Recuperación de contraseña</h2>
      <p>Hola <strong>${usuario.username}</strong>,</p>
      <p>Recibimos una solicitud para restablecer tu contraseña en <strong>Proformax</strong>.</p>
      <p>Haz clic en el siguiente botón para establecer una nueva contraseña. Este enlace expirará en <strong>1 hora</strong>.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}"
           style="background:#4f46e5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:16px;">
          Restablecer contraseña
        </a>
      </p>
      <p style="font-size:13px;color:#666;">
        Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:<br/>
        <a href="${resetLink}">${resetLink}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="font-size:12px;color:#999;">
        Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá siendo válida.
      </p>
    </div>
  `;

  await mailer.sendMail({
    to:      emailLower,
    subject: 'Recuperación de contraseña — Proformax',
    html:    htmlBody,
    text:    `Hola ${usuario.username},\n\nPara restablecer tu contraseña visita: ${resetLink}\n\nEste enlace expira en 1 hora.\n\nSi no lo solicitaste, ignora este correo.`,
  });

  logger.info(`[Auth] Correo de recuperación enviado a: ${emailLower}`);
};

/**
 * Restablece la contraseña usando el token recibido por correo.
 *
 * @param {string} rawToken   - Token en texto plano (del enlace del correo)
 * @param {string} newPassword - Nueva contraseña en texto plano
 */
const resetPassword = async (rawToken, newPassword) => {
  // Hashear el token para comparar con el almacenado en BD
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const usuario = await usuarioRepo.findByResetToken(hashedToken);

  if (!usuario) {
    throw new AppError('Token de recuperación inválido o ya utilizado.', 400, 'INVALID_RESET_TOKEN');
  }

  if (!usuario.resetTokenExpiry || new Date() > new Date(usuario.resetTokenExpiry)) {
    // Limpiar token expirado
    await usuarioRepo.clearResetToken(usuario.id);
    throw new AppError('El token de recuperación ha expirado. Solicita uno nuevo.', 400, 'EXPIRED_RESET_TOKEN');
  }

  if (!usuario.estado) {
    throw new AppError('La cuenta está inactiva.', 403, 'ACCOUNT_INACTIVE');
  }

  // Hashear nueva contraseña y actualizar
  const passwordHash = await hashPassword(newPassword);
  await usuarioRepo.update(usuario.id, { passwordHash });

  // Invalidar el token después de usarlo
  await usuarioRepo.clearResetToken(usuario.id);

  logger.info(`[Auth] Contraseña restablecida para usuario ID: ${usuario.id}`);
};

module.exports = { login, logout, hashPassword, generateToken, requestPasswordReset, resetPassword };
