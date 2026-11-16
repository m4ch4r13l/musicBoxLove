# Security Specification — Tocadiscos 3D (Firestore Rules TDD)

## 1. Data Invariants
1. Every document in `/gifts/{giftId}` MUST have a valid `giftId` matching `^[a-zA-Z0-9_\\-]+$` with length `1..128`.
2. Every gift document MUST belong to an authenticated, email-verified creator (`ownerId == request.auth.uid` on `create`), and `ownerId` + `createdAt` are immutable after creation.
3. Unauthenticated visitors (gift recipients) may ONLY `get` a single published document by knowing its exact `giftId`; they are strictly forbidden from listing `/gifts`, reading unpublished drafts, or mutating any document.
4. `list` queries on `/gifts` are strictly restricted to authenticated, email-verified users where `resource.data.ownerId == request.auth.uid` (or a verified admin).
5. Every string field and array (`discs`, size `1..12`) is strictly bounded in size, and no arbitrary/ghost keys are permitted (`hasOnly`).
6. Timestamps (`createdAt`, `updatedAt`) MUST equal `request.time`.
7. Every document in `/media_library/{mediaId}` MUST have a valid `mediaId` (`^[a-zA-Z0-9_\\-]+$`, `1..128`), belong to an email-verified creator (`ownerId == request.auth.uid`), and remain strictly private to its owner or verified admin on `get`, `list`, `update`, and `delete`.
8. `MediaAsset` fields MUST satisfy strict bounds (`kind in ['audio', 'cover']`, `title` 1..140, `fileName` 1..160, `fileSize` int `>= 0 && <= 52428800`, `url` 1..1024) with `hasOnly` key enforcement.

## 2. Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Create**: Create `/gifts/gift-1` with `request.auth == null`.
2. **Unverified Email Spoof**: Create `/gifts/gift-2` with `email: 'machariel123@gmail.com'` and `email_verified: false`.
3. **Identity Spoofing on Create**: Signed-in user `uid_a` tries to create `/gifts/gift-3` or `/media_library/m-1` with `ownerId: 'uid_b'`.
4. **Ghost Field Injection (Shadow Update)**: Owner adds `{ isAdmin: true }` or `{ extraField: 'hack' }` on create or update.
5. **Path ID Poisoning**: Create `/gifts/bad$id..with..chars` or `/media_library/bad$id` or a 200-char ID.
6. **Unauthorized List Scraping**: Unauthenticated user or signed-in user queries `/gifts` or `/media_library` without `where('ownerId', '==', auth.uid)`.
7. **Unpublished Draft / Private Media Read by Stranger**: Stranger tries `get(/gifts/draft-id)` where `isPublished == false` or `get(/media_library/m-owned-by-a)`.
8. **Cross-Owner Update**: User `uid_b` tries to update `/gifts/gift-owned-by-a` or `/media_library/m-owned-by-a`.
9. **Owner Reassignment Attack**: Owner `uid_a` tries to change `ownerId` on update.
10. **Client Timestamp Forgery**: Owner sends a backdated JS `Date` instead of `request.time` for `createdAt` or `updatedAt`.
11. **Oversized Array / Denial of Wallet**: Owner sends `discs` with 0 items or >12 items, or `title` >160 chars, or `url` >1024 chars.
12. **Invalid Enum / Value Poisoning**: Owner updates `finish` to `'plastic'`, `environment` to `'mars'`, `kind` to `'executable'`, or sets `discs[0]` to a non-map value.
