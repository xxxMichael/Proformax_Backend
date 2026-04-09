/**
 * ProformaController - Controlador de gestión de proformas
 * Incluye: CRUD, cambio de estado y exportación PDF
 *Esta pendiente quitar datos harcodeados del pdf 
 * 

*/

'use strict';

const proformaService = require('../services/proforma.service');
const puppeteer       = require('puppeteer');
const path            = require('path');
const logger          = require('../config/logger');

const getAll = async (req, res, next) => {
  try {
    const { page, limit, estado, clienteId, search } = req.query;
    const usuarioId = req.user.rol === 'VENDEDOR' ? req.user.id : req.query.usuarioId;

    const result = await proformaService.getAll({
      page:      parseInt(page)  || 1,
      limit:     parseInt(limit) || 20,
      estado,
      clienteId,
      usuarioId,
      search,
    });
    res.set('X-Total-Count', result.total);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const data = await proformaService.getById(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const data = await proformaService.create(req.body, req.user.id);
    return res.status(201).json({ success: true, data, message: 'Proforma creada exitosamente.' });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const data = await proformaService.update(req.params.id, req.body, req.user.id);
    return res.status(200).json({ success: true, data, message: 'Proforma actualizada exitosamente.' });
  } catch (err) { next(err); }
};

const changeStatus = async (req, res, next) => {
  try {
    const { estado, motivo } = req.body;
    const data = await proformaService.changeStatus(req.params.id, estado, motivo);
    return res.status(200).json({ success: true, data, message: `Estado actualizado a ${estado}.` });
  } catch (err) { next(err); }
};

/**
 * Exporta la proforma a PDF usando Puppeteer (headless Chrome)
 */
const exportPdf = async (req, res, next) => {
  let browser;
  try {
    const proforma = await proformaService.getById(req.params.id);

    // Generación de HTML para el PDF
    const html = generateProformaHTML(proforma);

    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin:          { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
    });

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="Proforma-${proforma.numero}.pdf"`,
      'Content-Length':      pdfBuffer.length,
    });

    return res.status(200).end(pdfBuffer);
  } catch (err) {
    next(err);
  } finally {
    if (browser) await browser.close();
  }
};

/**
 * Genera el HTML de la proforma para conversión a PDF
 */
const generateProformaHTML = (proforma) => {
  const formatMoney = (n) => `$${parseFloat(n).toFixed(2)}`;
  const formatDate  = (d) => new Date(d).toLocaleDateString('es-EC');

  const rows = proforma.detalles.map((d) => `
    <tr>
      <td>${d.producto?.codigo || '-'}</td>
      <td>${d.descripcion}</td>
      <td style="text-align:center">${d.cantidad}</td>
      <td style="text-align:right">${formatMoney(d.precioUnitario)}</td>
      <td style="text-align:center">${d.descuento}%</td>
      <td style="text-align:center">${d.aplicaIva ? 'Sí' : 'No'}</td>
      <td style="text-align:right">${formatMoney(d.subtotal)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; font-size: 12px; color: #333; }
    .header { background: #1a3a5c; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 24px; }
    .header .proforma-num { font-size: 18px; }
    .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; }
    .info-box h3 { color: #1a3a5c; border-bottom: 2px solid #1a3a5c; padding-bottom: 5px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 0 20px; }
    th { background: #1a3a5c; color: white; padding: 8px; font-size: 11px; }
    td { padding: 7px 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #f8f9fa; }
    .totals { float: right; margin: 15px 20px; min-width: 280px; }
    .totals table { width: 100%; }
    .totals td { padding: 5px 10px; }
    .total-row { font-weight: bold; font-size: 14px; background: #1a3a5c; color: white; }
    .footer { margin-top: 40px; padding: 20px; text-align: center; color: #666; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Arte Parquet G&G</h1>
      <p>Quito, Ecuador | info@arteparquet.com</p>
    </div>
    <div style="text-align:right">
      <div class="proforma-num">PROFORMA</div>
      <div style="font-size:20px; font-weight:bold">${proforma.numero}</div>
      <div>Estado: <strong>${proforma.estado}</strong></div>
    </div>
  </div>

  <div class="info-section">
    <div class="info-box">
      <h3>Datos del Cliente</h3>
      <p><strong>Nombre:</strong> ${proforma.cliente.nombres} ${proforma.cliente.apellidos || ''}</p>
      ${proforma.cliente.ruc ? `<p><strong>RUC:</strong> ${proforma.cliente.ruc}</p>` : ''}
      ${proforma.cliente.cedula ? `<p><strong>Cédula:</strong> ${proforma.cliente.cedula}</p>` : ''}
      ${proforma.cliente.email ? `<p><strong>Email:</strong> ${proforma.cliente.email}</p>` : ''}
    </div>
    <div class="info-box">
      <h3>Información de la Proforma</h3>
      <p><strong>Fecha de Emisión:</strong> ${formatDate(proforma.fechaEmision)}</p>
      <p><strong>Válida hasta:</strong> ${formatDate(proforma.fechaVigencia)}</p>
      <p><strong>Vendedor:</strong> ${proforma.usuario.username}</p>
      ${proforma.observaciones ? `<p><strong>Observaciones:</strong> ${proforma.observaciones}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Código</th><th>Descripción</th><th>Cantidad</th>
        <th>P. Unitario</th><th>Descuento</th><th>IVA</th><th>Subtotal</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal:</td><td style="text-align:right">${formatMoney(proforma.subtotal)}</td></tr>
      ${parseFloat(proforma.descuento) > 0 ? `<tr><td>Descuento:</td><td style="text-align:right">-${formatMoney(proforma.descuento)}</td></tr>` : ''}
      <tr><td>Base IVA:</td><td style="text-align:right">${formatMoney(proforma.baseIva)}</td></tr>
      <tr><td>IVA (${(proforma.tasaIva * 100).toFixed(0)}%):</td><td style="text-align:right">${formatMoney(proforma.valorIva)}</td></tr>
      <tr class="total-row"><td>TOTAL:</td><td style="text-align:right">${formatMoney(proforma.total)}</td></tr>
    </table>
  </div>

  <div class="footer">
    <p>Arte Parquet G&G | RUC: 1234567890001 | Quito, Ecuador</p>
    <p>Este documento es una proforma y no constituye una factura. Válida por el período indicado.</p>
  </div>
</body>
</html>`;
};

module.exports = { getAll, getById, create, update, changeStatus, exportPdf };
