import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type DraftStatus = "draft" | "approved" | "scheduled" | "published";

export type Draft = {
  id: string;
  topic: string;
  content: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  ownerId: string;
};

type DraftRow = {
  id: string;
  topic: string;
  content: string;
  status: DraftStatus;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  owner_id: string;
};

function toDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    topic: row.topic,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    ownerId: row.owner_id,
  };
}

export async function createDraft(
  topic: string,
  content: string,
  ownerId: string,
): Promise<Draft> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drafts")
    .insert({
      topic,
      content,
      status: "draft",
      approved_at: null,
      owner_id: ownerId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Could not create draft: ${error.message}`);
  }

  return toDraft(data as DraftRow);
}

export async function getDrafts(): Promise<Draft[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load drafts: ${error.message}`);
  }

  return (data as DraftRow[]).map(toDraft);
}

export async function getDraftById(id: string): Promise<Draft | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load draft: ${error.message}`);
  }

  return data ? toDraft(data as DraftRow) : undefined;
}

export async function deleteDraft(id: string, ownerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drafts")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not delete draft: ${error.message}`);
  }

  return Boolean(data);
}

export async function updateDraft(
  id: string,
  updates: {
    content?: string;
    status?: DraftStatus;
    scheduledFor?: string;
  },
): Promise<Draft | undefined> {
  const supabase = await createClient();
  const existingDraft = await getDraftById(id);

  if (!existingDraft) {
    return undefined;
  }

  const contentChanged =
    typeof updates.content === "string" &&
    updates.content !== existingDraft.content;

  const databaseUpdates: {
    content?: string;
    status?: DraftStatus;
    approved_at?: string | null;
    scheduled_for?: string | null;
    published_at?: string | null;
  } = {};

  if (typeof updates.content === "string") {
    if (existingDraft.status === "published") {
      throw new Error("Published drafts cannot be edited.");
    }

    databaseUpdates.content = updates.content;
  }

  /*
      Editing content changes what the user previously approved.
      It also cancels any pending scheduled publication.
    */
  if (contentChanged) {
    databaseUpdates.status = "draft";
    databaseUpdates.approved_at = null;
    databaseUpdates.scheduled_for = null;
    databaseUpdates.published_at = null;
  } else if (updates.status === "approved") {
    if (existingDraft.status !== "draft") {
      throw new Error("Only a draft can be approved.");
    }

    databaseUpdates.status = "approved";
    databaseUpdates.approved_at = new Date().toISOString();
  } else if (updates.status === "scheduled") {
    if (existingDraft.status !== "approved") {
      throw new Error("Only an approved draft can be scheduled.");
    }

    if (!updates.scheduledFor) {
      throw new Error("A scheduled publishing time is required.");
    }

    const scheduledFor = new Date(updates.scheduledFor);

    if (Number.isNaN(scheduledFor.getTime())) {
      throw new Error("The scheduled publishing time is invalid.");
    }

    if (scheduledFor <= new Date()) {
      throw new Error("The scheduled publishing time must be in the future.");
    }

    databaseUpdates.status = "scheduled";
    databaseUpdates.scheduled_for = scheduledFor.toISOString();
  } else if (updates.status === "published") {
    if (existingDraft.status !== "scheduled") {
      throw new Error("Only a scheduled draft can be published.");
    }

    if (
      !existingDraft.scheduledFor ||
      new Date(existingDraft.scheduledFor) > new Date()
    ) {
      throw new Error("This draft is not ready to publish yet.");
    }

    databaseUpdates.status = "published";
    databaseUpdates.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("drafts")
    .update(databaseUpdates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not update draft: ${error.message}`);
  }

  if (!data) {
    throw new Error("Could not update draft: Supabase returned no draft row.");
  }

  return toDraft(data as DraftRow);
}
export async function publishDueDrafts(): Promise<Draft[]> {
  const now = new Date().toISOString();

  const { data: dueRows, error: findError } = await supabaseAdmin
    .from("drafts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", now);

  if (findError) {
    throw new Error(`Could not find due drafts: ${findError.message}`);
  }

  if (!dueRows || dueRows.length === 0) {
    return [];
  }

  const ids = dueRows.map((draft) => draft.id);

  const { data: publishedRows, error: publishError } = await supabaseAdmin
    .from("drafts")
    .update({
      status: "published",
      published_at: now,
    })
    .in("id", ids)
    .eq("status", "scheduled")
    .select("*");

  if (publishError) {
    throw new Error(`Could not publish due drafts: ${publishError.message}`);
  }

  const publishedDrafts = (publishedRows ?? []) as DraftRow[];

  if (publishedDrafts.length > 0) {
    const { error: eventError } = await supabaseAdmin
      .from("draft_events")
      .insert(
        publishedDrafts.map((draft) => ({
          draft_id: draft.id,
          owner_id: draft.owner_id,
          event_type: "draft_published",
          metadata: {
            publishedAt: now,
          },
        })),
      );

    if (eventError) {
      throw new Error(
        `Drafts were published, but activity events could not be recorded: ${eventError.message}`,
      );
    }
  }

  return publishedDrafts.map(toDraft);
}
