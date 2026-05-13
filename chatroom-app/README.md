# WaveRoom 即時聊天室

這是一個和原本專案獨立的聊天室版本，位於 `chatroom-app/` 資料夾，不會影響既有的貼圖產生器。

## 目前功能

- 直接透過連結進入，不需先登入
- 透過 `?room=lobby` 這類網址直接進入指定聊天室
- 真正經由伺服器同步的多人聊天室
- 文字訊息
- 圖片、文字檔附件上傳
- 輸入中提示
- 在線成員顯示
- 附件儲存在 `storage/uploads/`，訊息資料儲存在 `storage/data/messages.json`
- 支援用 Persistent Disk 永久保存聊天紀錄與附件

## 使用方式

請在此資料夾執行：

```bash
gem install bundler -v 2.5.23
bundle _2.5.23_ install
bundle _2.5.23_ exec ruby server.rb
```

然後開啟：

`http://localhost:4571/?room=lobby`

## 永久保存設定

伺服器現在會優先把資料寫到：

- `storage/data/messages.json`
- `storage/uploads/`

也支援透過環境變數改路徑：

```bash
STORAGE_ROOT=/your/persistent/path ruby server.rb
```

如果專案裡還有舊版 `data/` 或 `uploads/` 內容，啟動時會自動搬到新的 `storage/` 結構。

## Render 免費測試版

已提供 [render.yaml](/Users/liurenyu/Documents/New%20project/chatroom-app/render.yaml)，可直接拿去部署。

這份設定會：

- 使用 `chatroom-app` 當根目錄
- 安裝 Bundler 2.5.23 與 Gem 依賴
- 啟動 `bundle _2.5.23_ exec ruby server.rb`
- 使用 Render `free` Web Service 方案
- 保留 `STORAGE_ROOT` 路徑設定，方便之後升級

注意：

- Render Free Web Service 會在閒置後 spin down
- Render Free Web Service 不支援 Persistent Disk
- 重新部署、重啟或閒置後，聊天紀錄與附件可能消失

## Render 付費持久化版

如果之後要升級成永久保存版本，可改用：

[render.persistent.yaml](/Users/liurenyu/Documents/New%20project/chatroom-app/render.persistent.yaml)

這份設定會把 Persistent Disk 掛到：

- `/opt/render/project/src/chatroom-app/storage`

## 注意

這一版已經改成由 Ruby 伺服器處理訊息同步與檔案上傳，搭配 Persistent Disk 後可長期保存資料。

如果您要真正提供多人線上使用，下一步建議補上：

- 正式網域與 HTTPS
- WebSocket 即時推播
- 雲端檔案儲存
- 正式資料庫
- 權限與管理功能
