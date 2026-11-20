import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { InventoryItem } from '../types/inventory';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/** Startup connection check per firebase-integration-rpc guidelines */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on test/connection still confirms server reachability
    return true;
  }
}

void testFirestoreConnection();

export async function signInWithGooglePopup(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function registerWithEmail(
  displayName: string,
  email: string,
  password: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(credential.user, { displayName: displayName.trim().slice(0, 80) });
  try {
    await sendEmailVerification(credential.user);
  } catch {
    // Verification email send may be throttled; user can re-trigger in Security tab
  }
  return credential.user;
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/** Ensures parent /users/{uid} document exists so Master Gate checks pass for subcollection writes. */
export async function ensureUserProfileDoc(user: User, department = 'Operations'): Promise<void> {
  if (!user.emailVerified) return;
  const path = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const safeName = (user.displayName || user.email?.split('@')[0] || 'Staff Member')
        .trim()
        .slice(0, 80);
      await setDoc(ref, {
        uid: user.uid,
        displayName: safeName || 'Staff Member',
        email: (user.email || 'staff@company.local').slice(0, 254),
        role: 'staff',
        department: department.trim().slice(0, 60) || 'Operations',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserInventory(
  userId: string,
  onItems: (items: InventoryItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const colPath = `users/${userId}/inventory`;
  const q = query(collection(db, 'users', userId, 'inventory'), where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const mapped: InventoryItem[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const createdMs = (d.createdAt as Timestamp | undefined)?.toMillis?.() ?? Date.now();
        const updatedMs = (d.updatedAt as Timestamp | undefined)?.toMillis?.() ?? Date.now();
        const rawSizes = Array.isArray(d.sizes) ? d.sizes : [];
        const sizes = rawSizes.length > 0
          ? rawSizes.slice(0, 12).map((s: Record<string, unknown>) => ({
              size: String(s.size ?? 'M').slice(0, 16),
              stock: Math.max(0, Math.trunc(Number(s.stock ?? 0))),
              price: Math.max(0, Math.trunc(Number(s.price ?? 0))),
            }))
          : [{ size: 'M', stock: Math.max(0, Math.trunc(Number(d.quantity ?? 0))), price: 0 }];

        const rawKarigars = Array.isArray(d.karigars) ? d.karigars : [];
        const karigars = rawKarigars.slice(0, 10).map((k: Record<string, unknown>) => ({
          stage: String(k.stage ?? 'Cutting & Stitching').slice(0, 60),
          karigarName: String(k.karigarName ?? '').slice(0, 80),
          unitOrNote: String(k.unitOrNote ?? '').slice(0, 120),
          dateGiven: String(k.dateGiven ?? '').slice(0, 20),
        }));

        const rm = (d.rawMaterials && typeof d.rawMaterials === 'object' ? d.rawMaterials : {}) as Record<string, unknown>;

        return {
          id: String(d.id ?? docSnap.id),
          ownerId: String(d.ownerId ?? userId),
          sku: String(d.sku ?? ''),
          title: String(d.title ?? ''),
          category: d.category,
          location: String(d.location ?? ''),
          quantity: Number(d.quantity ?? 0),
          minThreshold: Number(d.minThreshold ?? 5),
          status: d.status,
          sizes,
          lastKarigarName: String(d.lastKarigarName ?? '').slice(0, 80),
          lastKarigarStage: String(d.lastKarigarStage ?? '').slice(0, 60),
          lastKarigarDate: String(d.lastKarigarDate ?? '').slice(0, 20),
          karigars,
          rawMaterials: {
            topFabric: String(rm.topFabric ?? '').slice(0, 120),
            colorShade: String(rm.colorShade ?? '').slice(0, 100),
            bottomFabric: String(rm.bottomFabric ?? '').slice(0, 120),
            dupattaFabric: String(rm.dupattaFabric ?? '').slice(0, 120),
            materialNotes: String(rm.materialNotes ?? '').slice(0, 600),
          },
          notes: String(d.notes ?? ''),
          mediaKey: String(d.mediaKey ?? ''),
          photoFilter: d.photoFilter ?? 'original',
          photoAspect: d.photoAspect ?? '4:3',
          createdAt: createdMs,
          updatedAt: updatedMs,
          syncState: 'synced',
          cachedOffline: true,
        };
      });
      onItems(mapped);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        if (onError) onError(wrapped);
      }
    }
  );
}

function sanitizeDesignPayload(
  item: Omit<InventoryItem, 'previewUrl' | 'syncState' | 'cachedOffline'>
) {
  const safeSizes = (item.sizes.length > 0 ? item.sizes : [{ size: 'M', stock: 0, price: 0 }])
    .slice(0, 12)
    .map((s) => ({
      size: s.size.trim().slice(0, 16) || 'M',
      stock: Math.min(100_000, Math.max(0, Math.trunc(s.stock))),
      price: Math.min(1_000_000, Math.max(0, Math.trunc(s.price))),
    }));

  const safeKarigars = item.karigars
    .filter((k) => k.karigarName.trim().length > 0 && k.stage.trim().length > 0)
    .slice(0, 10)
    .map((k) => ({
      stage: k.stage.trim().slice(0, 60),
      karigarName: k.karigarName.trim().slice(0, 80),
      unitOrNote: k.unitOrNote.trim().slice(0, 120),
      dateGiven: k.dateGiven.trim().slice(0, 20),
    }));

  return {
    sku: item.sku.slice(0, 32),
    title: item.title.slice(0, 120),
    category: item.category,
    location: item.location.slice(0, 60),
    quantity: Math.min(1_000_000, Math.max(0, Math.trunc(item.quantity))),
    minThreshold: Math.min(100_000, Math.max(0, Math.trunc(item.minThreshold))),
    status: item.status,
    sizes: safeSizes,
    lastKarigarName: item.lastKarigarName.trim().slice(0, 80),
    lastKarigarStage: item.lastKarigarStage.trim().slice(0, 60),
    lastKarigarDate: item.lastKarigarDate.trim().slice(0, 20),
    karigars: safeKarigars,
    rawMaterials: {
      topFabric: item.rawMaterials.topFabric.trim().slice(0, 120),
      colorShade: item.rawMaterials.colorShade.trim().slice(0, 100),
      bottomFabric: item.rawMaterials.bottomFabric.trim().slice(0, 120),
      dupattaFabric: item.rawMaterials.dupattaFabric.trim().slice(0, 120),
      materialNotes: item.rawMaterials.materialNotes.trim().slice(0, 600),
    },
    notes: item.notes.slice(0, 600),
    mediaKey: item.mediaKey.slice(0, 200),
    photoFilter: item.photoFilter,
    photoAspect: item.photoAspect,
  };
}

export async function createInventoryDoc(
  userId: string,
  item: Omit<InventoryItem, 'previewUrl' | 'syncState' | 'cachedOffline'>
): Promise<void> {
  const path = `users/${userId}/inventory/${item.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'inventory', item.id), {
      id: item.id,
      ownerId: userId,
      ...sanitizeDesignPayload(item),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateInventoryDoc(
  userId: string,
  item: Omit<InventoryItem, 'previewUrl' | 'syncState' | 'cachedOffline'>
): Promise<void> {
  const path = `users/${userId}/inventory/${item.id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'inventory', item.id), {
      ...sanitizeDesignPayload(item),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteInventoryDoc(userId: string, itemId: string): Promise<void> {
  const path = `users/${userId}/inventory/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'inventory', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
