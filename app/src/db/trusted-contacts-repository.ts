import { desc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { trustedContacts, type TrustedContactRow } from '@/db/schema';
import { createTrustedContactId, type RelationshipKey } from '@/lib/trusted-contacts';

export type TrustedContactWrite = {
  name: string;
  phone: string;
  relationship: RelationshipKey;
  deviceContactId?: string | null;
};

export async function listTrustedContacts(): Promise<TrustedContactRow[]> {
  return db.select().from(trustedContacts).orderBy(desc(trustedContacts.created_at));
}

export async function getTrustedContact(id: string): Promise<TrustedContactRow | undefined> {
  const rows = await db.select().from(trustedContacts).where(eq(trustedContacts.id, id)).limit(1);
  return rows[0];
}

export async function insertTrustedContact(write: TrustedContactWrite): Promise<TrustedContactRow> {
  const now = Date.now();
  const row: TrustedContactRow = {
    id: createTrustedContactId(),
    name: write.name,
    phone: write.phone,
    relationship: write.relationship,
    device_contact_id: write.deviceContactId ?? null,
    created_at: now,
    updated_at: now,
  };

  await db.insert(trustedContacts).values(row);
  return row;
}

export async function updateTrustedContact(
  id: string,
  patch: Partial<Pick<TrustedContactWrite, 'name' | 'phone' | 'relationship'>>,
): Promise<void> {
  await db
    .update(trustedContacts)
    .set({ ...patch, updated_at: Date.now() })
    .where(eq(trustedContacts.id, id));
}

export async function deleteTrustedContact(id: string): Promise<void> {
  await db.delete(trustedContacts).where(eq(trustedContacts.id, id));
}