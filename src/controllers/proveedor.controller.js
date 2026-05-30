/**
 * ProveedorController — Controlador HTTP para CRUD de proveedores
 */

'use strict';

const proveedorService = require('../services/proveedor.service');

const getAll = async (req, res, next) => {
  try {
    const { page, limit, search, estado } = req.query;
    const result = await proveedorService.getAll({
      page:   parseInt(page)  || 1,
      limit:  parseInt(limit) || 20,
      search: search?.trim()  || undefined,
      estado,
    });
    res.set('X-Total-Count', result.total);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const data = await proveedorService.getById(parseInt(req.params.id));
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const data = await proveedorService.create(req.body);
    return res.status(201).json({ success: true, data, message: 'Proveedor creado exitosamente.' });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const data = await proveedorService.update(parseInt(req.params.id), req.body);
    return res.status(200).json({ success: true, data, message: 'Proveedor actualizado exitosamente.' });
  } catch (err) { next(err); }
};

const patch = async (req, res, next) => {
  try {
    const data = await proveedorService.patch(parseInt(req.params.id), req.body);
    return res.status(200).json({ success: true, data, message: 'Proveedor actualizado parcialmente.' });
  } catch (err) { next(err); }
};

const disable = async (req, res, next) => {
  try {
    const data = await proveedorService.disable(parseInt(req.params.id));
    return res.status(200).json({ success: true, data, message: 'Proveedor desactivado.' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, patch, disable };
