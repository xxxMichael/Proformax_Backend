/**
 * Cliente de Azure AI Document Intelligence (Form Recognizer)
 * Para extracción automática de datos de facturas de proveedores
 */

'use strict';

const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
const logger = require('./logger');

const endpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
const apiKey   = process.env.AZURE_FORM_RECOGNIZER_API_KEY;

let documentAnalysisClient = null;

/**
 * Obtiene el cliente de Azure Document Intelligence (lazy initialization)
 * @returns {DocumentAnalysisClient}
 */
const getDocumentClient = () => {
  if (!endpoint || !apiKey) {
    logger.warn('[Azure] Credenciales no configuradas. Módulo de facturas deshabilitado.');
    return null;
  }

  if (!documentAnalysisClient) {
    documentAnalysisClient = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(apiKey)
    );
    logger.info('[Azure] DocumentAnalysisClient inicializado correctamente.');
  }

  return documentAnalysisClient;
};

/**
 * Analiza una factura a partir de un buffer de archivo
 * Modelo: prebuilt-invoice
 * @param {Buffer|string} source - Buffer del archivo o URL
 * @returns {Promise<object>} Datos extraídos de la factura
 */
const analyzeInvoice = async (source) => {
  const client = getDocumentClient();
  if (!client) throw new Error('Cliente Azure no inicializado.');

  const isUrl = typeof source === 'string' && source.startsWith('http');

  let poller;
  if (isUrl) {
    poller = await client.beginAnalyzeDocumentFromUrl('prebuilt-invoice', source);
  } else {
    poller = await client.beginAnalyzeDocument('prebuilt-invoice', source);
  }

  const result = await poller.pollUntilDone();
  const invoice = result.documents?.[0];

  if (!invoice) throw new Error('No se detectó ninguna factura en el documento.');

  const fields = invoice.fields;

  return {
    vendorName:    fields?.VendorName?.value        || null,
    vendorRuc:     fields?.VendorTaxId?.value       || null,
    invoiceId:     fields?.InvoiceId?.value         || null,
    invoiceDate:   fields?.InvoiceDate?.value       || null,
    dueDate:       fields?.DueDate?.value           || null,
    subtotal:      fields?.SubTotal?.value?.amount  || null,
    totalTax:      fields?.TotalTax?.value?.amount  || null,
    total:         fields?.InvoiceTotal?.value?.amount || null,
    items:         (fields?.Items?.values || []).map((item) => ({
      description: item.properties?.Description?.value   || '',
      quantity:    item.properties?.Quantity?.value       || 0,
      unitPrice:   item.properties?.UnitPrice?.value?.amount || 0,
      amount:      item.properties?.Amount?.value?.amount || 0,
    })),
    rawConfidence: invoice.confidence,
  };
};

module.exports = { getDocumentClient, analyzeInvoice };
