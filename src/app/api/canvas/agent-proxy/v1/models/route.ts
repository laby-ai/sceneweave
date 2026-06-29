// icanivas fetchImageModels 会 GET {baseUrl}/models，这里返回固定模型列表避免 404。
export async function GET() {
  const models = ['doubao-seed-2.0-pro', 'doubao-seed-1-6-250615'];
  return Response.json({ data: models.map(id => ({ id })) });
}
