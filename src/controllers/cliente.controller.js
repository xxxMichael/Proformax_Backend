/**
 * ClienteController - Controlador HTTP para el CRUD de clientes
 */

'use strict';

const clienteService = require('../services/cliente.service');

// GET /api/v1/clientes
const getAll = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;

    const result = await clienteService.getAll({
      page:   parseInt(page)  || 1,
      limit:  parseInt(limit) || 20,
      search: search?.trim()  || undefined,
    });

    res.set('X-Total-Count', result.total);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

// GET /api/v1/clientes/:id
const getById = async (req, res, next) => {
  try {
    const data = await clienteService.getById(parseInt(req.params.id));
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

// POST /api/v1/clientes
const create = async (req, res, next) => {
  try {
    const data = await clienteService.create(req.body);
    return res.status(201).json({
      success: true,
      data,
      message: 'Cliente creado exitosamente.',
    });
  } catch (err) { next(err); }
};

// PUT /api/v1/clientes/:id
const update = async (req, res, next) => {
  try {
    const data = await clienteService.update(parseInt(req.params.id), req.body);
    return res.status(200).json({ success: true, data, message: 'Cliente actualizado exitosamente.' });
  } catch (err) { next(err); }
};

// PATCH /api/v1/clientes/:id
const patch = async (req, res, next) => {
  try {
    const data = await clienteService.patch(parseInt(req.params.id), req.body);
    return res.status(200).json({ success: true, data, message: 'Cliente actualizado parcialmente.' });
  } catch (err) { next(err); }
};

// DELETE /api/v1/clientes/:id
const remove = async (req, res, next) => {
  try {
    await clienteService.remove(parseInt(req.params.id));
    return res.status(200).json({
      success: true,
      message: 'Cliente eliminado exitosamente.',
    });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, patch, remove };
