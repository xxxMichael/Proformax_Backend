/**
 * azureDocumentAI.js — Cliente Azure AI Document Intelligence
 *
 * Responsabilidad ÚNICA: inicializar y proporcionar el cliente SDK.
 * NO contiene lógica de extracción ni de negocio.
 */

'use strict';

const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
const logger = require('./logger');

let _client = null;

/**
 * Retorna el cliente Azure (patrón singleton + lazy init).
 * Lanza error si las credenciales no están configuradas.
 * @returns {DocumentAnalysisClient}
 */
const getClient = () => {
  const endpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  const apiKey   = process.env.AZURE_FORM_RECOGNIZER_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error(
      'Azure Document Intelligence no configurado. ' +
      'Defina AZURE_FORM_RECOGNIZER_ENDPOINT y AZURE_FORM_RECOGNIZER_API_KEY en .env'
    );
  }

  if (!_client) {
    _client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));
    logger.info('[Azure] DocumentAnalysisClient inicializado.');
  }

  return _client;
};

/**
 * Verifica si las credenciales de Azure están configuradas.
 * @returns {boolean}
 */
const isConfigured = () =>
  Boolean(process.env.AZURE_FORM_RECOGNIZER_ENDPOINT && process.env.AZURE_FORM_RECOGNIZER_API_KEY);

module.exports = { getClient, isConfigured };
