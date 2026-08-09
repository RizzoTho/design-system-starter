# Accessible Color Design System

English: [README.md](README.md)

最多三个选择就能生成一套完整的无障碍网站配色系统——无需提供 HEX 色值——再在高级流程里检查与微调。颜色工作难在视觉协调与实测 accessibility 并不总是一致。这个工具把真实界面里反复出现的判断收进可重复的流程：保留可识别的语义角色、调整感知节奏、用 WCAG 数学验证 contrast，并在导出前把颜色放进组件场景检查。

## 它是什么

一个没有依赖的浏览器工具，提供两条路径：

- **快速开始** —— 选择色彩性格（均衡、温暖、冷静、鲜明、柔和）、Brand 来源与 Secondary 策略，按一个按钮生成完整网站配色系统：Context、全部角色色阶、浅色 / 深色网站 token，以及 `READY` / `READY WITH WARNINGS` / `NEEDS ATTENTION` 验证摘要。
- **高级编辑** —— 直接控制 `Background`、`Text`、`Brand`、`Neutral`、可选 `Secondary` 与语义角色，含 OKLCH 色阶、锁定、Role checks、网站 Token 与自定义配对。

它会生成基于 OKLCH 的 50–950 色阶，按关系类型检查 WCAG contrast（正文、大字、非文本），预览 Light / Dark 组件 assignments，保存静态或交互型前景 / 背景 pair，并导出 CSS variables 或 JSON。可选的 Dashboard、Marketing、Portfolio 与 Documentation 覆盖档案会补充具体组件 token 与对应 Preview 模块，但不会改变色彩性格。界面支持英文和中文。

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

1. **快速开始**：选择色彩性格、Brand 来源（生成 / 使用 HEX / 保留当前）与 Secondary 策略，按 `生成网站配色系统`。每套有效结果都会直接应用；再次 Generate 可换一套，也可从结果进入 Preview 或用单步 Undo 恢复上一套。失败结果不会改动当前系统，并会列出需处理的关系。
2. **Context**：确认或微调生成的 `Background` 与 `Text`；面板显示实测 PASS / FAIL（4.5:1）。
3. **Colors**：检查 `Brand`、`Neutral`、可选 `Secondary` 与语义角色；微调或 Lock 各角色，并按全局 WCAG target 查看 Role checks。
4. **网站 Token**：按用途分组查看生成的契约（surface、内容、操作、表单、反馈、强调），含浅色与深色值。可选 Dashboard、Marketing、Portfolio 或 Documentation 覆盖档案，补充组件 token 与对应 Preview 模块；自定义配对保留为可编辑快照。
5. **预览与导出**：检查浅色 / 深色组件工作区，然后复制 CSS variables 或 JSON。

## GitHub Pages

仓库内的 workflow 会在 `main` 更新时发布运行所需文件。

1. 把仓库 push 到 GitHub，并将 `main` 设为 default branch。
2. 打开 **Settings → Pages**。
3. 在 **Build and deployment** 中选择 **GitHub Actions**。
4. 运行 **Deploy GitHub Pages** workflow，或向 `main` push。

Workflow 会先运行项目检查，再只发布独立页面所需的 assets。

## 目录结构

```text
index.html          可直接运行的页面结构（按依赖顺序加载源文件）
styles.css          视觉与响应式样式
js/                 color-engine、i18n、role-model、token-contract、
                    system-generator、project-state 与 app
js/token-contract.js       网站 token 定义、目标档案、验证
js/system-generator.js     确定性的—键生成流程
js/project-state.js        schema v2 编解码与验证
tests/              静态、确定性、i18n、smoke 与快速开始检查
docs/               产品、颜色模型与网站 token 决策
plans/              实现历史与验收 gates
scripts/            部署 artifact 准备
.github/workflows/  GitHub Pages 部署
```

## 限制

- 本地保存把项目存在当前浏览器的 localStorage 中；下载 JSON 可生成可移植文件。清除存储或换机器后状态会重置。
- 自定义配对是明确保存的快照；交互型 pair 会从保存时的色阶推导状态值，但两种类型都不会自动变成 semantic assignments。
- 同一时间只启用一个产品覆盖档案。档案扩展通用契约，不是行业配色 preset，也不会改变已选的色彩性格。
- 当前面向 sRGB，尚未提供色觉缺陷模拟。
- 生成的用途标签只是建议，最终以 WCAG 检查结果为验收信号。

## License

[MIT](LICENSE)
