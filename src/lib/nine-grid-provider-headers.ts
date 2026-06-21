export async function extractNineGridForwardHeaders(headers: Headers): Promise<Record<string, string>> {
  const { HeaderUtils } = await import('coze-coding-dev-sdk');
  return HeaderUtils.extractForwardHeaders(headers);
}
