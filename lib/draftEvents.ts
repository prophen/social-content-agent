import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type DraftEventType =
  | "draft_created"
  | "draft_updated"
  | "draft_approved"
  | "draft_scheduled"
  | "draft_published"
  | "draft_publish_failed";

export type DraftEvent = {
  id: string;
  draftId: string;
  ownerId: string | null;
  eventType: DraftEventType;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type DraftEventRow = {
  id: string;
  draft_id: string;
  owner_id: string | null;
  event_type: DraftEventType;
  metadata: Record<string, unknown>;
  created_at: string;
};

function toDraftEvent(row: DraftEventRow): DraftEvent {
  return {
    id: row.id,
    draftId: row.draft_id,
    ownerId: row.owner_id,
    eventType: row.event_type,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export async function createDraftEvent(
  draftId: string,
  ownerId: string,
  eventType: DraftEventType,
  metadata: Record<string, unknown> = {},
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("draft_events")
    .insert({
      draft_id: draftId,
      owner_id: ownerId,
      event_type: eventType,
      metadata,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create draft event: ${error.message}`);
  }

  return toDraftEvent(data as DraftEventRow);
}

export async function getDraftEvents(draftId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("draft_events")
    .select("*")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load draft events: ${error.message}`);
  }

  return (data as DraftEventRow[]).map(toDraftEvent);
}

export async function createPublisherDraftEvent(
  draftId: string,
  ownerId: string,
  eventType: Extract<
    DraftEventType,
    "draft_published" | "draft_publish_failed"
  >,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabaseAdmin.from("draft_events").insert({
    draft_id: draftId,
    owner_id: ownerId,
    event_type: eventType,
    metadata,
  });

  if (error) {
    throw new Error(`Could not create publisher event: ${error.message}`);
  }
}
