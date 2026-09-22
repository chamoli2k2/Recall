import * as service from '../services/notificationService.js';
export const list = async (req, res) => res.json(await service.listNotifications(req.user));
export const read = async (req, res) => res.json({ unread: await service.markRead(req.user, req.body.ids) });
