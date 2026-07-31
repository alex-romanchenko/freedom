# Freedom Trust and Safety Runbook

Support contact: support@myfreedomchat.org

## Daily review

Review pending reports and account deletion requests at least once every business
day. Prioritize credible threats, sexual content involving minors, violence,
harassment, fraud, and repeated abuse.

```sql
SELECT r.id, r.created_at, r.entity_type, r.entity_id, r.reason, r.details,
       reporter.username AS reporter, reported.username AS reported_user
FROM content_reports r
JOIN users reporter ON reporter.id = r.reporter_id
LEFT JOIN users reported ON reported.id = r.reported_user_id
WHERE r.status IN ('pending', 'reviewing')
ORDER BY r.created_at;
```

Mark a report as being reviewed before investigating it:

```sql
UPDATE content_reports
SET status = 'reviewing'
WHERE id = REPORT_ID AND status = 'pending';
```

After reviewing the referenced content and account history, remove violating
content or restrict the responsible account. Preserve evidence when required by
law. Record the result:

```sql
UPDATE content_reports
SET status = 'resolved', reviewed_at = NOW()
WHERE id = REPORT_ID;
```

Use `dismissed` only when the reported material does not violate the Terms of
Use. Reports indicating imminent danger or child sexual abuse material must be
escalated to the appropriate authorities without delay.

## Account deletion requests

```sql
SELECT id, email, username, details, created_at
FROM account_deletion_requests
WHERE status IN ('pending', 'processing')
ORDER BY created_at;
```

Verify ownership through the registered email before deleting an account from a
public request. The authenticated in-app deletion flow remains the preferred
method. Update the request when processing is complete:

```sql
UPDATE account_deletion_requests
SET status = 'completed', processed_at = NOW()
WHERE id = REQUEST_ID;
```

## Enforcement principles

- Apply the published Terms of Use consistently.
- Blocked users cannot message, call, follow, or appear in each other's feeds.
- Do not expose reporter identities to reported users.
- Retain only the minimum information needed for security, legal obligations,
  fraud prevention, and deletion-request verification.
