/**
 * UsuarioController - Controlador de gestión de usuarios
 */

'use strict';

const usuarioService = require('../services/usuario.service');

const getAll = async (req, res, next) => {
  try {
    const { page, limit, rol, activo } = req.query;
    const result = await usuarioService.getAll({
      page:   parseInt(page)  || 1,
      limit:  parseInt(limit) || 20,
      rol,
      activo: activo !== undefined ? activo === 'true' : undefined,
    });
    res.set('X-Total-Count', result.total);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const data = await usuarioService.getById(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const data = await usuarioService.create(req.body);
    return res.status(201).json({ success: true, data, message: 'Usuario creado exitosamente.' });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const data = await usuarioService.update(req.params.id, req.body);
    return res.status(200).json({ success: true, data, message: 'Usuario actualizado exitosamente.' });
  } catch (err) { next(err); }
};

const deactivate = async (req, res, next) => {
  try {
    const data = await usuarioService.deactivate(req.params.id, req.user.id);
    return res.status(200).json({ success: true, data, message: 'Usuario desactivado.' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, deactivate };
