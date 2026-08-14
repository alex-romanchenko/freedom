const {
  hasAcceptedTerms,
  acceptTerms,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getBlockRelationship,
  createReport,
  createAccountDeletionRequest,
} = require('../models/safety.model');
const sendEmail = require('../utils/sendEmail');

// Send reports directly to the moderation inbox. This avoids a forwarding
// loop when EMAIL_USER is the same Gmail inbox that receives support mail.
const SUPPORT_EMAIL =
  process.env.REPORT_RECIPIENT_EMAIL || 'support@myfreedomchat.org';

const ENTITY_TYPES = new Set([
  'user',
  'post',
  'post_comment',
  'photo',
  'photo_comment',
  'message',
]);
const REASONS = new Set([
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'scam',
  'other',
]);

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

async function getTermsStatus(req, res) {
  try {
    res.json({ accepted: await hasAcceptedTerms(req.user.id) });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load terms status' });
  }
}

async function acceptTermsController(req, res) {
  try {
    const result = await acceptTerms(req.user.id);
    res.json({ accepted: true, acceptedAt: result?.terms_accepted_at });
  } catch (error) {
    res.status(500).json({ message: 'Unable to accept terms' });
  }
}

async function reportContent(req, res) {
  try {
    const { entityType, entityId, reportedUserId, reason, details } = req.body;
    if (!ENTITY_TYPES.has(entityType) || !REASONS.has(reason)) {
      return res.status(400).json({ message: 'Invalid report data' });
    }
    if (entityType !== 'user' && !Number.isInteger(Number(entityId))) {
      return res.status(400).json({ message: 'Entity id is required' });
    }
    if (details && String(details).length > 1000) {
      return res.status(400).json({ message: 'Report details are too long' });
    }
    const report = await createReport({
      reporterId: req.user.id,
      reportedUserId: Number(reportedUserId) || null,
      entityType,
      entityId: entityType === 'user' ? Number(reportedUserId) || null : Number(entityId),
      reason,
      details: String(details || '').trim(),
    });
    await sendEmail(
      SUPPORT_EMAIL,
      `[Freedom] New ${entityType} report #${report.id}`,
      `<h2>New Freedom content report</h2>
       <p><strong>Report ID:</strong> ${report.id}</p>
       <p><strong>Content type:</strong> ${escapeHtml(entityType)}</p>
       <p><strong>Content ID:</strong> ${entityId ?? 'N/A'}</p>
       <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
       <p><strong>Reporter ID:</strong> ${req.user.id}</p>
       <p><strong>Reported user ID:</strong> ${reportedUserId ?? 'N/A'}</p>
       <p><strong>Details:</strong><br>${escapeHtml(details).replace(/\n/g, '<br>') || 'N/A'}</p>`,
    );
    console.info(
      `REPORT EMAIL SENT: report=${report.id} type=${entityType} recipient=${SUPPORT_EMAIL}`,
    );
    res.status(201).json({ message: 'Report submitted', report });
  } catch (error) {
    console.error('REPORT SUBMISSION ERROR:', error);
    res.status(500).json({ message: 'Unable to submit report' });
  }
}

async function blockUserController(req, res) {
  try {
    const blockedId = Number(req.params.userId);
    if (!blockedId || blockedId === Number(req.user.id)) {
      return res.status(400).json({ message: 'Invalid user' });
    }
    await blockUser(req.user.id, blockedId);
    res.json({ message: 'User blocked' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to block user' });
  }
}

async function unblockUserController(req, res) {
  try {
    await unblockUser(req.user.id, Number(req.params.userId));
    res.json({ message: 'User unblocked' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to unblock user' });
  }
}

async function listBlockedUsers(req, res) {
  try {
    res.json(await getBlockedUsers(req.user.id));
  } catch (error) {
    res.status(500).json({ message: 'Unable to load blocked users' });
  }
}

async function getBlockStatus(req, res) {
  try {
    const otherUserId = Number(req.params.userId);
    if (!otherUserId || otherUserId === Number(req.user.id)) {
      return res.status(400).json({ message: 'Invalid user' });
    }
    res.json(await getBlockRelationship(req.user.id, otherUserId));
  } catch (error) {
    res.status(500).json({ message: 'Unable to load block status' });
  }
}

async function requestAccountDeletion(req, res) {
  try {
    const email = String(req.body.email || '').trim();
    const username = String(req.body.username || '').trim();
    const details = String(req.body.details || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (username.length > 100 || details.length > 1000) {
      return res.status(400).json({ message: 'Request data is too long' });
    }
    const request = await createAccountDeletionRequest({ email, username, details });
    res.status(201).json({ message: 'Deletion request submitted', requestId: request.id });
  } catch (error) {
    res.status(500).json({ message: 'Unable to submit deletion request' });
  }
}

module.exports = {
  getTermsStatus,
  acceptTermsController,
  reportContent,
  blockUserController,
  unblockUserController,
  listBlockedUsers,
  getBlockStatus,
  requestAccountDeletion,
};
