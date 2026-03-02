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

interface UploadExecutionImageParams {
  projectId: string;
  fileName: string;
  base64: string;
  contentType: string;
}

interface CreateSignedDownloadUrlParams {
  bucket: string;
  path: string;
  expiresIn?: number;
}

const DEFAULT_BUCKET = "xbase-execution-results";
const DEFAULT_IMAGE_BUCKET = "xbase-execution-images";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || DEFAULT_BUCKET;
const SUPABASE_IMAGE_BUCKET =
  process.env.SUPABASE_IMAGE_BUCKET || DEFAULT_IMAGE_BUCKET;

const preparedBuckets = new Set<string>();

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

const ensureBucket = async (
  bucketName: string,
  allowedMimeTypes?: string[],
) => {
  if (preparedBuckets.has(bucketName)) {
    console.log(`${LOG_PREFIX} Bucket already prepared, skipping`);
    return;
  }

  console.log(`${LOG_PREFIX} Ensuring bucket exists: ${bucketName}`);
  const client = getSupabaseAdminClient();
  const { data: buckets, error: listError } =
    await client.storage.listBuckets();
  if (listError) {
    console.error(`${LOG_PREFIX} Failed to list buckets: ${listError.message}`);
    throw new Error(`Supabase listBuckets failed: ${listError.message}`);
  }

  console.log(`${LOG_PREFIX} Found ${buckets.length} existing buckets`);
  const exists = buckets.some((bucket) => bucket.name === bucketName);
  if (!exists) {
    console.log(`${LOG_PREFIX} Bucket does not exist, creating...`);
    const { error: createError } = await client.storage.createBucket(
      bucketName,
      {
        public: false,
        allowedMimeTypes,
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

  preparedBuckets.add(bucketName);
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

  await ensureBucket(SUPABASE_BUCKET, ["application/json"]);

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

export const uploadExecutionImage = async ({
  projectId,
  fileName,
  base64,
  contentType,
}: UploadExecutionImageParams): Promise<UploadExecutionJsonResult> => {
  console.log(`${LOG_PREFIX} uploadExecutionImage called`);
  console.log(`${LOG_PREFIX} Project ID: ${projectId}`);
  console.log(`${LOG_PREFIX} File name: ${fileName}`);
  console.log(`${LOG_PREFIX} Content type: ${contentType}`);

  await ensureBucket(SUPABASE_IMAGE_BUCKET, [contentType]);

  const client = getSupabaseAdminClient();
  const path = `projects/${projectId}/${fileName}`;
  const cleanedBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
  const body = Buffer.from(cleanedBase64, "base64");

  console.log(`${LOG_PREFIX} Uploading image to path: ${path}`);
  console.log(`${LOG_PREFIX} Payload size: ${body.length} bytes`);

  const { error } = await client.storage
    .from(SUPABASE_IMAGE_BUCKET)
    .upload(path, body, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error(`${LOG_PREFIX} Image upload failed: ${error.message}`);
    throw new Error(`Supabase image upload failed: ${error.message}`);
  }

  console.log(`${LOG_PREFIX} Image upload successful`);
  return {
    bucket: SUPABASE_IMAGE_BUCKET,
    path,
  };
};

export const createSignedDownloadUrl = async ({
  bucket,
  path,
  expiresIn = 60,
}: CreateSignedDownloadUrlParams): Promise<string> => {
  console.log(`${LOG_PREFIX} createSignedDownloadUrl called`);
  console.log(`${LOG_PREFIX} Bucket: ${bucket}`);
  console.log(`${LOG_PREFIX} Path: ${path}`);

  const client = getSupabaseAdminClient();
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error(`${LOG_PREFIX} Signed URL failed: ${error.message}`);
    throw new Error(`Supabase createSignedUrl failed: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error("Supabase createSignedUrl returned no URL");
  }

  return data.signedUrl;
};
