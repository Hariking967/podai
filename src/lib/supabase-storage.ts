import { createClient } from "@supabase/supabase-js";

const LOG_PREFIX = "[Supabase-Storage]";

interface UploadExecutionJsonParams {
  projectId: string;
  fileName: string;
  payload: unknown;
}

interface UploadExecutionJsonResult {
  bucket: string;
  path: string;
}

const DEFAULT_BUCKET = "xbase-execution-results";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || DEFAULT_BUCKET;

let bucketPrepared = false;

const getSupabaseAdminClient = () => {
  console.log(`${LOG_PREFIX} Getting Supabase admin client`);
  console.log(
    `${LOG_PREFIX} SUPABASE_URL present: ${SUPABASE_URL ? "YES" : "NO"}`,
  );
  console.log(
    `${LOG_PREFIX} SUPABASE_SECRET_KEY present: ${SUPABASE_SECRET_KEY ? "YES" : "NO"}`,
  );

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error(`${LOG_PREFIX} ERROR: Missing Supabase credentials`);
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const ensureBucket = async () => {
  if (bucketPrepared) {
    console.log(`${LOG_PREFIX} Bucket already prepared, skipping`);
    return;
  }

  console.log(`${LOG_PREFIX} Ensuring bucket exists: ${SUPABASE_BUCKET}`);
  const client = getSupabaseAdminClient();
  const { data: buckets, error: listError } =
    await client.storage.listBuckets();
  if (listError) {
    console.error(`${LOG_PREFIX} Failed to list buckets: ${listError.message}`);
    throw new Error(`Supabase listBuckets failed: ${listError.message}`);
  }

  console.log(`${LOG_PREFIX} Found ${buckets.length} existing buckets`);
  const exists = buckets.some((bucket) => bucket.name === SUPABASE_BUCKET);
  if (!exists) {
    console.log(`${LOG_PREFIX} Bucket does not exist, creating...`);
    const { error: createError } = await client.storage.createBucket(
      SUPABASE_BUCKET,
      {
        public: false,
        allowedMimeTypes: ["application/json"],
      },
    );
    if (createError && !/already exists/i.test(createError.message)) {
      console.error(
        `${LOG_PREFIX} Failed to create bucket: ${createError.message}`,
      );
      throw new Error(`Supabase createBucket failed: ${createError.message}`);
    }
    console.log(`${LOG_PREFIX} Bucket created successfully`);
  } else {
    console.log(`${LOG_PREFIX} Bucket already exists`);
  }

  bucketPrepared = true;
};

export const uploadExecutionJson = async ({
  projectId,
  fileName,
  payload,
}: UploadExecutionJsonParams): Promise<UploadExecutionJsonResult> => {
  console.log(`${LOG_PREFIX} uploadExecutionJson called`);
  console.log(`${LOG_PREFIX} Project ID: ${projectId}`);
  console.log(`${LOG_PREFIX} File name: ${fileName}`);
  console.log(`${LOG_PREFIX} Payload type: ${typeof payload}`);

  await ensureBucket();

  const client = getSupabaseAdminClient();
  const path = `projects/${projectId}/${fileName}`;
  const body = JSON.stringify(payload, null, 2);

  console.log(`${LOG_PREFIX} Uploading to path: ${path}`);
  console.log(`${LOG_PREFIX} Payload size: ${body.length} bytes`);

  const { error } = await client.storage
    .from(SUPABASE_BUCKET)
    .upload(path, body, {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    console.error(`${LOG_PREFIX} Upload failed: ${error.message}`);
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  console.log(`${LOG_PREFIX} Upload successful`);
  return {
    bucket: SUPABASE_BUCKET,
    path,
  };
};
