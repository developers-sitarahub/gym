import express from "express";
import { Readable } from "stream";
import prisma from "../prisma.js";
import { decrypt } from "../utils/encryption.js";

const router = express.Router({ mergeParams: true });
const GRAPH_BASE_URL = "https://graph.facebook.com";
const META_API_VERSION = process.env.META_API_VERSION || "v19.0";

// GET /api/media/:gymSlug/:mediaId
router.get("/:mediaId", async (req, res) => {
  const { gymSlug, mediaId } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
    });

    if (!gym || !gym.whatsapp_access_token) {
      return res.status(404).json({ error: "Gym or WhatsApp configuration not found" });
    }

    const token = decrypt(gym.whatsapp_access_token);

    // 1. Fetch the media URL from Meta
    const mediaRes = await fetch(`${GRAPH_BASE_URL}/${META_API_VERSION}/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const mediaData = await mediaRes.json();

    if (!mediaRes.ok || !mediaData.url) {
      console.error("❌ [Media Proxy] Failed to fetch media URL:", mediaData);
      return res.status(400).json({ error: "Failed to fetch media details from Meta" });
    }

    // 2. Fetch the actual media binary from Meta
    const downloadRes = await fetch(mediaData.url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!downloadRes.ok || !downloadRes.body) {
      console.error("❌ [Media Proxy] Failed to download media from Meta");
      return res.status(500).json({ error: "Failed to download media" });
    }

    // 3. Forward the headers (Content-Type, Content-Length)
    const contentType = downloadRes.headers.get("content-type");
    const contentLength = downloadRes.headers.get("content-length");
    
    if (contentType) res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    
    // Enable caching for a year since WhatsApp media IDs are immutable
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // 4. Pipe the binary stream to the client
    Readable.fromWeb(downloadRes.body).pipe(res);
  } catch (err) {
    console.error("❌ [Media Proxy] Internal Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
