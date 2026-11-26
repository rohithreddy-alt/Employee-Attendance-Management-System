import bcrypt from 'bcryptjs';
import express, { type Response } from 'express';
import { db } from '../database.ts';
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = express.Router();
router.use(requireAuth);

router.get('/', (req: AuthedRequest, res: Response) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const admin = db
      .prepare('SELECT id, full_name, email, role, created_at FROM admins WHERE id = ?')
      .get(req.admin!.id);
    res.json({ success: true, data: { settings, admin } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.put('/company', (req: AuthedRequest, res: Response) => {
  try {
    const companyName = String(req.body?.company_name || '').trim();
    const companyEmail = String(req.body?.company_email || '').trim();
    const companyPhone = String(req.body?.company_phone || '').trim();
    const companyAddress = String(req.body?.company_address || '').trim();
    const officeStartTime = String(req.body?.office_start_time || '').trim();
    const officeEndTime = String(req.body?.office_end_time || '').trim();
    const lateGraceMinutes = Number(req.body?.late_grace_minutes ?? 15);
    const workingDays = String(req.body?.working_days || 'Mon,Tue,Wed,Thu,Fri').trim();

    if (!companyName || !officeStartTime || !officeEndTime) {
      res.status(400).json({
        success: false,
        message: 'Company name, office check-in time, and office check-out time are required.'
      });
      return;
    }

    db.prepare(
      `UPDATE settings
       SET company_name = ?, company_email = ?, company_phone = ?, company_address = ?,
           office_start_time = ?, office_end_time = ?, late_grace_minutes = ?, working_days = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`
    ).run(
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      officeStartTime,
      officeEndTime,
      Number.isFinite(lateGraceMinutes) ? Math.max(0, Math.min(180, lateGraceMinutes)) : 15,
      workingDays
    );

    const updated = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json({ success: true, message: 'Company & attendance settings updated.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.put('/profile', (req: AuthedRequest, res: Response) => {
  try {
    const fullName = String(req.body?.full_name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!fullName || !email) {
      res.status(400).json({ success: false, message: 'Full name and email are required.' });
      return;
    }

    const dup = db
      .prepare('SELECT id FROM admins WHERE LOWER(email) = LOWER(?) AND id != ?')
      .get(email, req.admin!.id);
    if (dup) {
      res.status(409).json({ success: false, message: 'Email is already in use by another admin.' });
      return;
    }

    db.prepare('UPDATE admins SET full_name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      fullName,
      email,
      req.admin!.id
    );

    const updated = db
      .prepare('SELECT id, full_name, email, role FROM admins WHERE id = ?')
      .get(req.admin!.id);
    res.json({ success: true, message: 'Admin profile updated.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.put('/password', (req: AuthedRequest, res: Response) => {
  try {
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');
    const confirmPassword = String(req.body?.confirm_password || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ success: false, message: 'All password fields are required.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
      return;
    }

    const admin = db
      .prepare('SELECT id, password_hash FROM admins WHERE id = ?')
      .get(req.admin!.id) as { id: number; password_hash: string } | undefined;

    if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
      res.status(401).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE admins SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      newHash,
      admin.id
    );

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
