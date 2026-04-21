/**
 * ProductoController — Controlador HTTP para el CRUD de productos/servicios
 */

'use strict';

const productoService = require('../services/producto.service');

const getAll = async (req, res, next) => {
  try {
    const { page, limit, search, tipo, estado } = req.query;
    const result = await productoService.getAll({
      page:   parseInt(page)  || 1,
      limit:  parseInt(limit) || 20,
      search: search?.trim()  || undefined,
      tipo:   tipo            || undefined,
      estado,
    });
    res.set('X-Total-Count', result.total);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const data = await productoService.getById(parseInt(req.params.id));
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const data = await productoService.create(req.body);
    return res.status(201).json({ success: true, data, message: 'Producto creado exitosamente.' });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const data = await productoService.update(parseInt(req.params.id), req.body);
    return res.status(200).json({ success: true, data, message: 'Producto actualizado exitosamente.' });
  } catch (err) { next(err); }
};

const patch = async (req, res, next) => {
  try {
    const data = await productoService.patch(parseInt(req.params.id), req.body);
    return res.status(200).json({ success: true, data, message: 'Producto actualizado parcialmente.' });
  } catch (err) { next(err); }
};

const disable = async (req, res, next) => {
  try {
    const data = await productoService.disable(parseInt(req.params.id));
    return res.status(200).json({ success: true, data, message: 'Producto desactivado.' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, patch, disable };
