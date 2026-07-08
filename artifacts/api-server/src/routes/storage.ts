import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { getAuth } from "@clerk/express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = auth.userId;
  next();
};

// Content types that are safe to serve inline in a browser.
// Anything not in this list is served as application/octet-stream with
// Content-Disposition: attachment so it cannot execute in the app's origin.
// NOTE: image/svg+xml is intentionally excluded — SVG can contain inline script
// and would execute same-origin when served with that content type.
const SAFE_INLINE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
]);

// Content types allowed for upload through the generic upload endpoint.
const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);
/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * Requires authentication. Only image content types are permitted.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: any, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { name, size, contentType } = parsed.data;

  if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType)) {
    res.status(400).json({ error: "Content type not allowed. Only image files may be uploaded." });
    return;
  }

  try {
    // Scope the upload path under the authenticated user's ID so ownership
    // can be enforced when the path is later referenced.
    const uploadURL = await objectStorageService.getObjectEntityUploadURL(req.clerkUserId);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * Requires authentication. Content-Type is sanitized: only known-safe types
 * are served inline; everything else is forced to application/octet-stream
 * with Content-Disposition: attachment to prevent same-origin script execution.
 */
router.get("/storage/objects/*path", requireAuth, async (req: any, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const canAccess = await objectStorageService.canAccessObjectEntity({
      userId: req.clerkUserId,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canAccess) {
      // No ACL set OR ACL denies access. Fall through to owner check via path prefix.
      // Objects uploaded through profile or storage endpoints are scoped under
      // /objects/uploads/<userId>/... — any authenticated user may read profile
      // photos (dating-app use case) but we still block unauthenticated access.
      // Only deny if the object has an explicit ACL that excludes this user AND
      // the path is not a public profile photo path.
      const isProfilePhotoPath = objectPath.startsWith("/objects/uploads/");
      if (!isProfilePhotoPath) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const response = await objectStorageService.downloadObject(objectFile);

    // Sanitize Content-Type: only allow known-safe types to be served inline.
    // Unsafe types (text/html, application/javascript, etc.) are replaced with
    // application/octet-stream and forced to download to prevent stored XSS.
    const rawContentType = response.headers.get("content-type") ?? "application/octet-stream";
    const normalizedType = rawContentType.split(";")[0].trim().toLowerCase();
    const safeContentType = SAFE_INLINE_CONTENT_TYPES.has(normalizedType)
      ? rawContentType
      : "application/octet-stream";

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-type") {
        res.setHeader(key, value);
      }
    });
    res.setHeader("Content-Type", safeContentType);
    if (!SAFE_INLINE_CONTENT_TYPES.has(normalizedType)) {
      res.setHeader("Content-Disposition", "attachment");
    }

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
