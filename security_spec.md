# SocialVerse Security Specification (Payload-First TDD)

## 1. Data Invariants
1. **PII Isolation**: User emails, blocklists, notification preferences, and privacy controls reside exclusively in `/users/{userId}/private/info` and are strictly unreadable and unwritable by any user other than `request.auth.uid == userId`.
2. **Identity Integrity**: Every user-authored record (`posts`, `comments`, `stories`, `messages`, `friend_requests`, `reports`, `saved_posts`) enforces `incoming().authorId == request.auth.uid` (or `senderId`/`fromUid`/`reporterUid`/`uid`) on create, and makes the author field immutable on update.
3. **Username Uniqueness**: `/usernames/{username}` enforces `^[a-z0-9_]{3,24}$`, non-overwrite (`!exists(...)` on create), and links exclusively to `request.auth.uid`.
4. **Master Gate Chat Isolation**: Messages in `/chats/{chatId}/messages/{messageId}` and participants in `/chats/{chatId}/members/{memberUid}` verify membership on the parent `/chats/{chatId}` document (`request.auth.uid in get(...).data.participantIds` with bounded list size `<= 50`), preventing unauthorized reading or injection into private/group chats.
5. **Temporal Integrity & Path Hardening**: All document IDs match `^[a-zA-Z0-9_\\-]+$` with length `<= 128`. Created/updated timestamps validate against `request.time` where required and prevent future-dated or backdated tampering.
6. **Admin Isolation**: `/announcements` and `/reports` admin review states cannot be forged or modified by user-app clients.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Identity Spoofing on Post**: User A creates `/posts/p1` with `authorId: "userB"`.
2. **Shadow Field Privilege Escalation**: User A updates `/users/userA` adding `"isAdmin": true` or `"role": "moderator"`.
3. **PII Snooping**: User A reads `/users/userB/private/info`.
4. **Username Hijack**: User A overwrites `/usernames/rafi` already owned by User B.
5. **1MB ID Poisoning**: User A writes `/posts/<1500-char-junk-id>` with oversized ID or caption `> 2200` chars.
6. **Unauthorized Chat Injection**: User C (not in `participantIds`) creates `/chats/c1/messages/m1`.
7. **Post Content Hijack**: User B updates User A's `/posts/p1` caption.
8. **Notification Forgery / Snooping**: User A lists `/notifications` without `recipientUid == userA` or reads User B's notification.
9. **Terminal State Reversal**: User B modifies an already `accepted` or `rejected` friend request back to `pending`.
10. **Report Tampering**: User A creates `/reports/r1` with `status: "reviewed"` or deletes another user's report.
11. **Announcement Forgery**: User A creates a document in `/announcements/a1`.
12. **Saved Post Cross-Owner Read**: User A reads or lists `/saved_posts` where `uid == "userB"`.
