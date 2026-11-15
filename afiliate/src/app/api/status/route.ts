import { connectionFlags } from "@/lib/env";
import { json, optionalViewer } from "@/lib/http";
import { ffmpegAvailable } from "@/lib/video";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const identity = await optionalViewer(request);
  const flags = connectionFlags();
  return json({
    viewer: identity.verified
      ? {
          name: identity.kind === "person" ? identity.name : identity.name,
          simulated: Boolean(identity.simulated),
        }
      : null,
    connections: {
      ...flags,
      ffmpeg: await ffmpegAvailable(),
    },
  });
}
