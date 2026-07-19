// Notifications CRUD Routes
// Full create/read/update/delete for the notifications table

const express = require('express');
const pool = require('../db');

const router = express.Router();

// =============================================================================
// GET /api/notifications
// List notifications with required ?user_id= filter
// Optional: ?unread_only=true to get only unread notifications
// =============================================================================
router.get('/', async (req, res) => {
  let connection;
  try {
    if (!req.query.user_id) {
      return res.status(400).json({ success: false, message: 'user_id query parameter is required.' });
    }

    connection = await pool.getConnection();

    let query = 'SELECT * FROM `notifications` WHERE `user_id` = ?';
    const params = [req.query.user_id];

    if (req.query.unread_only === 'true') {
      query += ' AND `is_read` = FALSE';
    }

    query += ' ORDER BY `created_at` DESC';

    const [rows] = await connection.execute(query, params);

    return res.status(200).json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] GET / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// POST /api/notifications
// Create a new notification
// =============================================================================
router.post('/', async (req, res) => {
  let connection;
  try {
    const { user_id, title, message } = req.body;

    // Validation
    const errors = [];
    if (!user_id) errors.push('User ID is required.');
    if (!title || title.trim().length === 0) errors.push('Title is required.');
    if (!message || message.trim().length === 0) errors.push('Message is required.');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors });
    }

    connection = await pool.getConnection();

    // Verify user exists
    const [user] = await connection.execute(
      'SELECT `id` FROM `users` WHERE `id` = ? LIMIT 1',
      [user_id]
    );
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const [result] = await connection.execute(
      'INSERT INTO `notifications` (`user_id`, `title`, `message`, `is_read`) VALUES (?, ?, ?, FALSE)',
      [user_id, title.trim(), message.trim()]
    );

    console.log(`[NOTIFICATIONS] Created notification ID: ${result.insertId} for user: ${user_id}`);

    return res.status(201).json({
      success: true,
      message: 'Notification created successfully.',
      notificationId: result.insertId
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] POST / error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/notifications/:id/read
// Mark a single notification as read
// =============================================================================
router.put('/:id/read', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      'SELECT `id` FROM `notifications` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    await connection.execute(
      'UPDATE `notifications` SET `is_read` = TRUE WHERE `id` = ?',
      [req.params.id]
    );

    console.log(`[NOTIFICATIONS] Marked notification ID: ${req.params.id} as read`);

    return res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('[NOTIFICATIONS] PUT /:id/read error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// PUT /api/notifications/read-all
// Mark all notifications as read for a given user
// =============================================================================
router.put('/read-all', async (req, res) => {
  let connection;
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required.' });
    }

    connection = await pool.getConnection();

    const [result] = await connection.execute(
      'UPDATE `notifications` SET `is_read` = TRUE WHERE `user_id` = ? AND `is_read` = FALSE',
      [user_id]
    );

    console.log(`[NOTIFICATIONS] Marked all notifications as read for user: ${user_id} (${result.affectedRows} updated)`);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      updatedCount: result.affectedRows
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] PUT /read-all error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

// =============================================================================
// DELETE /api/notifications/:id
// Delete a notification
// =============================================================================
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      'SELECT `id` FROM `notifications` WHERE `id` = ? LIMIT 1',
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    await connection.execute('DELETE FROM `notifications` WHERE `id` = ?', [req.params.id]);

    console.log(`[NOTIFICATIONS] Deleted notification ID: ${req.params.id}`);

    return res.status(200).json({ success: true, message: 'Notification deleted successfully.' });
  } catch (error) {
    console.error('[NOTIFICATIONS] DELETE /:id error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
