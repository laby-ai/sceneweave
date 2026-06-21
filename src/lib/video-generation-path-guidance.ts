const STORYBOARD_VIDEO_PATH_DISABLED_MESSAGE =
  '旧分镜视频生成入口已关闭：请从 AI 视频配置 BYOK 后生成，或通过 production assembly segment start 创建可恢复片段任务。';

export function throwStoryboardVideoPathDisabled(context: string): never {
  throw new Error(`${context}: ${STORYBOARD_VIDEO_PATH_DISABLED_MESSAGE}`);
}
