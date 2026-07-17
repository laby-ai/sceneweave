export function requireParityAuthHeaders(env = process.env) {
  const token = env.HUIYING_PARITY_AUTH_TOKEN?.trim() || '';
  if (!token) {
    throw new Error('缺少 HUIYING_PARITY_AUTH_TOKEN；请使用专用测试账号 token 运行 parity QA，禁止匿名或个人账号探针。');
  }
  return { Authorization: `Bearer ${token}` };
}
