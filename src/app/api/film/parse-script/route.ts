import { NextRequest } from "next/server";

/**
 * POST /api/film/parse-script
 * 解析上传的剧本文件(txt/doc/docx/pdf)为文本内容
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "未找到上传文件" }, { status: 400 });
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = buffer.toString("utf-8");

    // 简单清洗：去除多余空行，保留段落结构
    const cleaned = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");

    return Response.json({
      success: true,
      title: file.name.replace(/\.[^/.]+$/, ""),
      text: cleaned,
      wordCount: cleaned.length,
    });
  } catch (error) {
    console.error("[Parse Script] 解析失败:", error);
    return Response.json(
      { error: "文件解析失败，请尝试纯文本文件" },
      { status: 500 }
    );
  }
}
