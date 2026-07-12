export async function extractNineGridForwardHeaders(headers: Headers): Promise<Record<string, string>> {
  const { HeaderUtils } = await import('@/lib/native-provider-sdk');
  return HeaderUtils.extractForwardHeaders(headers);
}
