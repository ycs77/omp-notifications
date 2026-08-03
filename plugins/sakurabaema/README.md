# OMP 提示音 - 櫻羽艾瑪

在 OMP 要求權限、提問或停止時，自動播放對應的提示音通知用戶。

## 功能特色

- **Permission Request 事件**：當 OMP 要求工具執行權限時觸發
- **Ask 工具事件**：當 OMP 透過 `ask` 工具要求用戶輸入時觸發
- **Session Stop 事件**：當 OMP 主工作階段準備停止時觸發

## 安裝 plugin

在終端機中安裝 plugin：

```bash
omp plugin marketplace add ycs77/omp-notifications
omp plugin install notification-sakurabaema@ycs77-notifications
```

在目前 repository 進行本機開發時，也可以直接 link：

```bash
omp plugin link ./plugins/sakurabaema
```

## WSL 前置需求

在 WSL 中使用此插件前，請先安裝 PulseAudio 工具：

```bash
sudo apt install pulseaudio-utils
```

## 使用說明

安裝後 OMP 會自動載入 extension，無須額外設定。

## Event 觸發時機

### Permission Request

- `tool_approval_requested`：工具需要 OMP 核准流程時觸發
- `permission_request`：收到共用 event bus 的權限請求時觸發

### Ask Tool

- `tool_execution_start` 開始執行 `ask` 工具時觸發
- 用於提醒用戶有問題需要回應

### Session Stop

- `session_stop` 在主工作階段準備停止、結果 settle 前觸發
- 不會在 task 或 subagent 工作階段觸發

## 作者

Lucas Yang (yangchenshin77@gmail.com)

## 授權

MIT License
