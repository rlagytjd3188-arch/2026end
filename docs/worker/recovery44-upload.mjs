export default {
  async fetch(request, env) {
    const allowedOrigin = "https://rlagytjd3188-arch.github.io";
    const origin = request.headers.get("Origin");
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    // 브라우저 CORS 사전 요청
    if (request.method === "OPTIONS") {
      if (origin !== allowedOrigin) {
        return new Response("Forbidden", { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }
    // 업로드 외 요청 차단
    if (request.method !== "POST") {
      return jsonResponse(
        { ok: false, error: "POST 요청만 허용됩니다." },
        405,
        corsHeaders
      );
    }
    // RECOVERY 사이트 외 브라우저 요청 차단
    if (origin !== allowedOrigin) {
      return jsonResponse(
        { ok: false, error: "허용되지 않은 사이트입니다." },
        403,
        corsHeaders
      );
    }
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return jsonResponse(
          { ok: false, error: "사진 파일이 없습니다." },
          400,
          corsHeaders
        );
      }
      // 이미지 파일만 허용
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ];
      if (!allowedTypes.includes(file.type)) {
        return jsonResponse(
          { ok: false, error: "JPG, PNG, WEBP, HEIC 사진만 업로드할 수 있습니다." },
          400,
          corsHeaders
        );
      }
      // 최대 15MB
      const MAX_SIZE = 15 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return jsonResponse(
          { ok: false, error: "사진은 15MB 이하만 업로드할 수 있습니다." },
          400,
          corsHeaders
        );
      }
      // 한국 시간 기준 안전한 파일명 생성 (브라우저 파일명은 사용하지 않음)
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());
      const part = (type) => parts.find((item) => item.type === type).value;
      const date = `${part("year")}${part("month")}${part("day")}`;
      const time = `${part("hour")}${part("minute")}${part("second")}`;
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let randomId = "";
      while (randomId.length < 4) {
        const value = crypto.getRandomValues(new Uint8Array(1))[0];
        if (value < 252) randomId += alphabet[value % alphabet.length];
      }
      const filename = `RECOVERY44_${date}_${time}_${randomId}.png`;
      // App Folder 앱에서는 "/"가 앱 전용 폴더의 루트
      const dropboxPath = `/uploads/${filename}`;
      const uploadResponse = await fetch(
        "https://content.dropboxapi.com/2/files/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.DROPBOX_ACCESS_TOKEN}`,
            "Dropbox-API-Arg": JSON.stringify({
              path: dropboxPath,
              mode: "add",
              autorename: true,
              mute: false,
            }),
            "Content-Type": "application/octet-stream",
          },
          body: await file.arrayBuffer(),
        }
      );
      const result = await uploadResponse.json();
      if (!uploadResponse.ok) {
        console.error("Dropbox upload error:", result);
        return jsonResponse(
          {
            ok: false,
            error: "Dropbox에 사진을 저장하지 못했습니다.",
          },
          502,
          corsHeaders
        );
      }
      return jsonResponse(
        {
          ok: true,
          message: "사진이 전송되었습니다.",
          filename: result.name,
        },
        200,
        corsHeaders
      );
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse(
        {
          ok: false,
          error: "사진 업로드 중 오류가 발생했습니다.",
        },
        500,
        corsHeaders
      );
    }
  },
};
function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
function getExtension(filename, mimeType) {
  const original = filename.split(".").pop()?.toLowerCase();
  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
  if (allowedExtensions.includes(original)) {
    return original;
  }
  const mimeExtensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return mimeExtensions[mimeType] || "jpg";
}
