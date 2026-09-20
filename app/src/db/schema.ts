import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  created_at: integer("created_at"),
  updated_at: integer("updated_at"),
});

export type Users = typeof users.$inferSelect;

export const trustedContacts = sqliteTable("trusted_contacts", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  relationship: text("relationship").notNull().default("family"),
  device_contact_id: text("device_contact_id"),
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
});

export type TrustedContactRow = typeof trustedContacts.$inferSelect;
export type NewTrustedContactRow = typeof trustedContacts.$inferInsert;
