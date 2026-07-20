# Accessible Color Design System

English: [README.md](README.md)

这个工具写给已经确定界面 `Background` 和 `Text`，但需要更快建立其余颜色系统的设计师与工程师。

颜色工作难在视觉协调与实测 accessibility 并不总是一致。我把真实界面里反复出现的判断收进这个工具：保留可识别的语义角色、调整感知节奏、验证 contrast，并在导出前把颜色放进组件场景检查。AI 不替代这些 domain judgment，它让专业判断变成更快、更可重复的流程。

## 它是什么

一个没有依赖的浏览器工具，用固定界面上下文定义 `Brand`、`Neutral`、可选 `Secondary` 与语义颜色角色。

它会生成基于 OKLCH 的 50–950 色阶，检查 WCAG contrast，预览 Light / Dark 组件 assignments，保存前景 / 背景 pair，并导出 CSS variables 或 JSON。界面支持英文和中文。

## 本地运行

不需要安装依赖，也没有 build step。

1. 下载或 clone 这个仓库。
2. 直接用浏览器打开 `index.html`。

也可以启动本地 HTTP server：

```bash
python3 -m http.server 8000
```

然后打开 `http://localhost:8000`。

## 基本流程

1. 确认固定的 `Background` 和 `Text`。
2. 设置 `Brand` 与 `Neutral`；只有用途明确时才启用 `Secondary`。
3. 按 `Brand` 更新未锁定语义色，再单独微调或 Lock 各角色。
4. 选择全局 WCAG target，检查 Fit report、assignments 和 Contrast matrix。
5. 保存可用的前景 / 背景 pair，检查 Component preview，然后 Export。

## GitHub Pages

仓库内的 workflow 会在 `main` 更新时发布运行所需文件。

1. 把仓库 push 到 GitHub，并将 `main` 设为 default branch。
2. 打开 **Settings → Pages**。
3. 在 **Build and deployment** 中选择 **GitHub Actions**。
4. 运行 **Deploy GitHub Pages** workflow，或向 `main` push。

Workflow 会先运行项目检查，再只发布独立页面所需的 assets。

## 目录结构

```text
index.html          可直接运行的页面结构
styles.css          视觉与响应式样式
js/                 Color engine、role model、i18n 与交互
tests/              静态、确定性、i18n 与 smoke checks
docs/               产品与颜色模型决策
plans/              实现历史与验收 gates
scripts/            部署 artifact 准备
.github/workflows/  GitHub Pages 部署
```

## 限制

- 状态只保留在当前 session，刷新页面后会重置。
- Saved pairs 是明确保存的快照，不会自动变成 semantic assignments。
- 当前面向 sRGB，尚未提供色觉缺陷模拟。
- 生成的用途标签只是建议，最终以 WCAG 检查结果为验收信号。

## License

[MIT](LICENSE)
