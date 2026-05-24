import { Router } from 'express';
import { validateTicker } from '../utils/validateTicker.js';
import { getNotes, getNoteById } from '../db/repositories/note.repo.js';
import { badRequest, notFound } from '../utils/errors.js';

export function createNotesRouter() {
  const router = Router();

  router.get('/:ticker', (req, res, next) => {
    const { valid, ticker } = validateTicker(req.params.ticker);
    if (!valid) return next(badRequest('Invalid ticker'));
    res.json(getNotes(ticker));
  });

  router.get('/note/:id', (req, res, next) => {
    const note = getNoteById(req.params.id);
    if (!note) return next(notFound('Note not found'));
    res.json(note);
  });

  return router;
}
