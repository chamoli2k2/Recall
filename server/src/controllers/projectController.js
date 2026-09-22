import * as projects from '../services/projectService.js';
export const list = async (req, res) => res.json({ projects: await projects.listProjects(req.user) });
export const get = async (req, res) => res.json({ project: await projects.getProject(req.params.id, req.user) });
export const create = async (req, res) => res.status(201).json({ project: await projects.createProject(req.user, req.body) });
export const update = async (req, res) => res.json({ project: await projects.updateProject(req.params.id, req.user, req.body) });
export const archive = async (req, res) => res.json(await projects.archiveProject(req.params.id, req.user, req.body.archived));
export const addFolder = async (req, res) => res.json({ project: await projects.addFolder(req.params.id, req.user, req.body.folderId) });
export const removeFolder = async (req, res) => res.json({ project: await projects.removeFolder(req.params.id, req.user, req.params.folderId) });
