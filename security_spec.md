# Katalog Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Owner Isolation & PII Containment**: Every `/users/{userId}` document contains PII (`email`) and is readable/writable strictly by `request.auth.uid == userId` (`allow list: if false`).
2. **Master Gate Parent Sync**: Every read/write on `/users/{userId}/inventory/{itemId}` (except cost-optimized `allow list`) verifies parent `/users/{userId}` exists and belongs to `request.auth.uid`.
3. **Verified Identity for Mutations**: All creates, updates, and deletes require `request.auth.token.email_verified == true`.
4. **Strict Per-Size Stock & Pricing Bounds**: `sizes` is a strictly bounded list (`1 <= size <= 12`); each validated entry enforces `keys().hasOnly(['size', 'stock', 'price'])`, non-negative integer `stock <= 100000`, and non-negative integer INR `price <= 1000000`.
5. **Bounded Karigar & Raw Material Fields**: `karigars` is capped at `<= 10` entries with strict `.size()` bounds on every string. `rawMaterials` strictly enforces `hasAll`/`hasOnly` on `['topFabric', 'colorShade', 'bottomFabric', 'dupattaFabric', 'materialNotes']` with explicit string size limits.
6. **Immutable Ownership & Temporal Integrity**: `id`, `ownerId`, and `createdAt` cannot be modified after creation; `createdAt == request.time` on create and `updatedAt == request.time` on update.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `get /users/u1/inventory/item-1` with `auth == null`.
2. **Cross-Tenant PII Leak**: `get /users/u2` as authenticated user `u1`.
3. **Blanket User List Scraping**: `list /users` as authenticated user `u1`.
4. **Unverified Email Write**: `create /users/u1/inventory/item-1` where `email_verified == false`.
5. **Owner Spoofing**: `create /users/u1/inventory/item-1` with `ownerId: "u2"`.
6. **Shadow Field Injection**: `create` or `update` including ghost key `isAdmin: true` or `discountOverride: 99`.
7. **ID Poisoning**: Document path ID containing spaces, slashes, or > 128 chars.
8. **Unbounded Sizes Array DoS**: `sizes` array with 13+ entries or empty `[]`.
9. **Negative / Non-Integer Size Price Poisoning**: `sizes[0].price = -500` or `"free"`.
10. **Oversized Raw Material String**: `rawMaterials.materialNotes` exceeding 600 chars or adding unknown key `rawMaterials.secret`.
11. **Oversized Karigar Array**: `karigars` array with 11+ entries or `karigars[0].karigarName` > 80 chars.
12. **Client Timestamp Forgery / Immutable Field Mutation**: Updating `createdAt`, `ownerId`, or setting `updatedAt` to a client-chosen timestamp instead of `request.time`.
