import express, { type Response } from 'express';
import { db } from '../database.ts';
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = express.Router();
router.use(requireAuth);

router.get('/', (_req: AuthedRequest, res: Response) => {
  try {
    const departments = db
      .prepare(
        `SELECT
          d.*,
          COUNT(e.id) AS employee_count
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id
        GROUP BY d.id
        ORDER BY d.name ASC`
      )
      .all();
    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.get('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found.' });
      return;
    }

    const employees = db
      .prepare(
        `SELECT id, employee_code, full_name, email, phone, designation, status, joining_date
         FROM employees
         WHERE department_id = ?
         ORDER BY full_name ASC`
      )
      .all(id);

    res.json({ success: true, data: { department, employees } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.post('/', (req: AuthedRequest, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    const code = String(req.body?.code || '').trim().toUpperCase();
    const description = String(req.body?.description || '').trim();
    const managerName = String(req.body?.manager_name || '').trim();

    if (!name || !code) {
      res.status(400).json({ success: false, message: 'Department name and code are required.' });
      return;
    }

    const dup = db
      .prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR UPPER(code) = UPPER(?)')
      .get(name, code);
    if (dup) {
      res.status(409).json({ success: false, message: 'Department name or code already exists.' });
      return;
    }

    const result = db
      .prepare('INSERT INTO departments (name, code, description, manager_name) VALUES (?, ?, ?, ?)')
      .run(name, code, description, managerName);

    const created = db
      .prepare('SELECT *, 0 AS employee_count FROM departments WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json({ success: true, message: 'Department created successfully.', data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.put('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Department not found.' });
      return;
    }

    const name = String(req.body?.name || '').trim();
    const code = String(req.body?.code || '').trim().toUpperCase();
    const description = String(req.body?.description || '').trim();
    const managerName = String(req.body?.manager_name || '').trim();

    if (!name || !code) {
      res.status(400).json({ success: false, message: 'Department name and code are required.' });
      return;
    }

    const dup = db
      .prepare('SELECT id FROM departments WHERE (LOWER(name) = LOWER(?) OR UPPER(code) = UPPER(?)) AND id != ?')
      .get(name, code, id);
    if (dup) {
      res.status(409).json({ success: false, message: 'Another department already uses this name or code.' });
      return;
    }

    db.prepare('UPDATE departments SET name = ?, code = ?, description = ?, manager_name = ? WHERE id = ?').run(
      name,
      code,
      description,
      managerName,
      id
    );

    const updated = db
      .prepare(
        `SELECT d.*, COUNT(e.id) AS employee_count
         FROM departments d
         LEFT JOIN employees e ON e.department_id = d.id
         WHERE d.id = ?
         GROUP BY d.id`
      )
      .get(id);

    res.json({ success: true, message: 'Department updated successfully.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.delete('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM departments WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Department not found.' });
      return;
    }
    db.prepare('DELETE FROM departments WHERE id = ?').run(id);
    res.json({ success: true, message: 'Department deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
