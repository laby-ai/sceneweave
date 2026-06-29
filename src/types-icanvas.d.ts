// Vendored 开源无限画布（basketikun/infinite-canvas）位于 src/icanvas，
// 通过 next.config 的 @icanvas bundler 别名在运行时解析。
// 这里给 tsc 一个 ambient 声明，避免把整棵 vendored 代码拉进我们的类型门禁。
declare module '@icanvas/*';
