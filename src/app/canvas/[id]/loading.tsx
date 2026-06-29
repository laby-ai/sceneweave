// 编辑器是个很重的客户端组件，加载它的 JS 需要时间。
// 这个 loading 让点击进入后立刻有反馈（骨架屏），不再像“点了没反应”。
export default function CanvasEditorLoading() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-[#070b12] text-white/70">
      <div className="flex flex-col items-center gap-4">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#4F6CFF]" />
        <p className="text-sm text-white/55">正在打开画布…</p>
      </div>
    </div>
  );
}
