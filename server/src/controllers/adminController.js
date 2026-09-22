import * as admin from '../services/adminService.js';
export const users = async (req, res) => res.json({ users: await admin.listUsers(req.query.q) });
export const setAccount = async (req, res) => res.json({ user: await admin.setAccount(req.user, req.params.id, req.body.account) });
export const orders = async (req, res) => res.json({ orders: await admin.listOrders(req.query.status) });
export const decide = async (req, res) => res.json({ order: await admin.decideOrder(req.user, req.params.id, req.body.status) });
