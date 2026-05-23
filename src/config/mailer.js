/**
 * Mailer - Envío de correos con Twilio SendGrid
 *
 * Requiere una API Key de SendGrid con permiso "Mail Send".
 * Genera una en: https://app.sendgrid.com/settings/api_keys
 *
 * El remitente (SENDGRID_FROM) debe estar verificado en SendGrid:
 * https://app.sendgrid.com/settings/sender_auth
 */

'use strict';

const sgMail = require('@sendgrid/mail');
const logger  = require('./logger');

// Inicializar con la API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Envía un correo electrónico usando SendGrid.
 * @param {object} options
 * @param {string} options.to      - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.html    - Cuerpo HTML
 * @param {string} [options.text]  - Cuerpo texto plano (fallback)
 */
const sendMail = async ({ to, subject, html, text }) => {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM,
    subject,
    html,
    ...(text && { text }),
  };

  const [response] = await sgMail.send(msg);
  logger.info(`[Mailer] Correo enviado a ${to} | StatusCode: ${response.statusCode}`);
  return response;
};

module.exports = { sendMail };
