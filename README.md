# Scratch 星光票選站

這是一個 Scratch 作品上傳與線上票選網站，現在除了可以本機執行，也已整理成可公開部署的版本。

## 功能

- 上傳 Scratch 專案檔（`.sb3`、`.sb2`）
- 上傳作品縮圖與填寫作品介紹
- 顯示作品牆與即時票數排行
- 每個瀏覽器對同一作品限投一次

## 啟動方式

1. 在專案資料夾執行：

   ```bash
   ruby server.rb
   ```

2. 開啟瀏覽器進入：

   [http://localhost:4567](http://localhost:4567)

如果你的環境需要只綁本機：

```bash
HOST=127.0.0.1 ruby server.rb
```

## 資料儲存

- 作品清單：`data/projects.json`
- 上傳檔案：`data/uploads/`

## 公開部署

目前專案已補好以下部署檔：

- `Dockerfile`
- `.dockerignore`
- `render.yaml`

### Render 部署方式

1. 把這個專案上傳到 GitHub
2. 到 Render 建立新的 Web Service
3. 連接你的 GitHub 專案
4. Render 會自動讀取 `render.yaml` 與 `Dockerfile`
5. 部署完成後，你會拿到一個公開網址，其他人就能直接打開網站查看與投票

### Docker 本機測試

```bash
docker build -t scratch-voting-site .
docker run -p 4567:4567 scratch-voting-site
```

之後打開：

[http://localhost:4567](http://localhost:4567)

## 備註

- 目前是適合活動展示或校內票選的 MVP 版本。
- 若要部署到正式公開網站，下一步建議補上帳號系統、管理後台、檔案大小限制、雲端檔案儲存與更完整的防刷票機制。
