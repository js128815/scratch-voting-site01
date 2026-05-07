require "cgi"
require "fileutils"
require "json"
require "securerandom"
require "time"
require "webrick"

ROOT = File.expand_path(__dir__)
STORAGE_ROOT = File.expand_path(ENV.fetch("STORAGE_ROOT", File.join(ROOT, "storage")))
DATA_DIR = File.join(STORAGE_ROOT, "data")
UPLOAD_DIR = File.join(STORAGE_ROOT, "uploads")
MESSAGES_FILE = File.join(DATA_DIR, "messages.json")
LEGACY_DATA_DIR = File.join(ROOT, "data")
LEGACY_UPLOAD_DIR = File.join(ROOT, "uploads")
PUBLIC_FILES = {
  "/" => ["index.html", "text/html; charset=utf-8"],
  "/index.html" => ["index.html", "text/html; charset=utf-8"],
  "/styles.css" => ["styles.css", "text/css; charset=utf-8"],
  "/app.js" => ["app.js", "application/javascript; charset=utf-8"]
}.freeze
ROOMS = [
  { "id" => "lobby", "name" => "大廳交流", "topic" => "自由聊天與新朋友報到" },
  { "id" => "ideas", "name" => "點子討論", "topic" => "產品、企劃與靈感交流" },
  { "id" => "study", "name" => "學習共創", "topic" => "課程、筆記與提問互助" }
].freeze
ALLOWED_IMAGE_TYPES = %w[image/png image/jpeg image/webp image/gif].freeze
ALLOWED_VIDEO_TYPES = %w[video/mp4 video/webm video/quicktime].freeze
ALLOWED_TEXT_TYPES = %w[text/plain text/markdown application/json text/csv].freeze
MAX_FILE_SIZE = 15 * 1024 * 1024
MAX_MESSAGES = 300
PRESENCE_TTL = 35
TYPING_TTL = 4
STORE_MUTEX = Mutex.new

FileUtils.mkdir_p(DATA_DIR)
FileUtils.mkdir_p(UPLOAD_DIR)

def migrate_legacy_storage
  if !File.exist?(MESSAGES_FILE) && File.file?(File.join(LEGACY_DATA_DIR, "messages.json"))
    FileUtils.cp(File.join(LEGACY_DATA_DIR, "messages.json"), MESSAGES_FILE)
  end

  return unless Dir.exist?(LEGACY_UPLOAD_DIR)

  Dir.children(LEGACY_UPLOAD_DIR).each do |entry|
    source_path = File.join(LEGACY_UPLOAD_DIR, entry)
    target_path = File.join(UPLOAD_DIR, entry)
    next unless File.file?(source_path)
    next if File.exist?(target_path)

    FileUtils.cp(source_path, target_path)
  end
end

migrate_legacy_storage

def ensure_messages_file
  return if File.exist?(MESSAGES_FILE)

  seed_messages = [
    {
      "id" => SecureRandom.uuid,
      "roomId" => "lobby",
      "authorId" => "system",
      "authorName" => "系統",
      "type" => "system",
      "body" => "歡迎來到 WaveRoom，現在可直接透過連結進入聊天室。",
      "attachments" => [],
      "createdAt" => Time.now.iso8601
    },
    {
      "id" => SecureRandom.uuid,
      "roomId" => "ideas",
      "authorId" => "host",
      "authorName" => "產品小編",
      "type" => "message",
      "body" => "這裡可以分享點子，也可以直接上傳圖片或短影片。",
      "attachments" => [],
      "createdAt" => Time.now.iso8601
    },
    {
      "id" => SecureRandom.uuid,
      "roomId" => "study",
      "authorId" => "mentor",
      "authorName" => "學習助教",
      "type" => "message",
      "body" => "課程討論可以搭配講義文字檔、教學圖片與短片說明。",
      "attachments" => [],
      "createdAt" => Time.now.iso8601
    }
  ]

  File.write(MESSAGES_FILE, JSON.pretty_generate(seed_messages))
end

def load_messages
  ensure_messages_file
  JSON.parse(File.read(MESSAGES_FILE))
rescue JSON::ParserError
  []
end

def save_messages(messages)
  File.write(MESSAGES_FILE, JSON.pretty_generate(messages.last(MAX_MESSAGES)))
end

def sanitize_filename(name)
  base = File.basename(name.to_s).gsub(/[^\w.\-]+/, "_")
  base.empty? ? "file" : base
end

def normalize_text(value)
  value.to_s.dup.force_encoding("UTF-8").encode("UTF-8", invalid: :replace, undef: :replace, replace: "").strip
end

def room_exists?(room_id)
  ROOMS.any? { |room| room["id"] == room_id }
end

def content_type_for(path)
  case File.extname(path)
  when ".png" then "image/png"
  when ".jpg", ".jpeg" then "image/jpeg"
  when ".webp" then "image/webp"
  when ".gif" then "image/gif"
  when ".mp4" then "video/mp4"
  when ".webm" then "video/webm"
  when ".mov" then "video/quicktime"
  when ".txt" then "text/plain; charset=utf-8"
  when ".md" then "text/markdown; charset=utf-8"
  when ".json" then "application/json; charset=utf-8"
  when ".csv" then "text/csv; charset=utf-8"
  else "application/octet-stream"
  end
end

def json_response(res, status:, body:)
  res.status = status
  res["Content-Type"] = "application/json; charset=utf-8"
  res["Cache-Control"] = "no-store"
  res.body = JSON.generate(body)
end

def parse_json_body(req)
  JSON.parse(req.body.to_s)
rescue JSON::ParserError
  nil
end

def active_presence(presence_store)
  now = Time.now
  presence_store.values.select do |member|
    updated_at = Time.parse(member["updatedAt"].to_s) rescue nil
    updated_at && now - updated_at <= PRESENCE_TTL
  end
end

def active_typers_for_room(presence_store, room_id, client_id)
  now = Time.now
  active_presence(presence_store).select do |member|
    updated_at = Time.parse(member["typingUpdatedAt"].to_s) rescue nil
    member["clientId"] != client_id &&
      member["roomId"] == room_id &&
      member["typing"] == true &&
      updated_at &&
      now - updated_at <= TYPING_TTL
  end
end

def extract_upload_entries(req)
  req.query.map do |_key, value|
    next unless value.respond_to?(:filename) && value.filename
    value
  end.compact
end

def read_form_file(upload)
  upload.to_s
end

def build_attachment(upload)
  filename = sanitize_filename(upload.filename)
  content_type = if upload.respond_to?(:content_type)
    upload.content_type.to_s
  else
    upload["content-type"].to_s
  end
  kind =
    if ALLOWED_IMAGE_TYPES.include?(content_type)
      "image"
    elsif ALLOWED_VIDEO_TYPES.include?(content_type)
      "video"
    elsif ALLOWED_TEXT_TYPES.include?(content_type) || File.extname(filename).match?(/\A\.(txt|md|json|csv)\z/i)
      "text"
    end

  raise "不支援的檔案格式：#{filename}" unless kind

  bytes = read_form_file(upload)
  raise "#{filename} 超過 15 MB 限制" if bytes.bytesize > MAX_FILE_SIZE

  stored_name = "#{SecureRandom.hex(8)}-#{filename}"
  target_path = File.join(UPLOAD_DIR, stored_name)
  File.binwrite(target_path, bytes)

  attachment = {
    "id" => SecureRandom.uuid,
    "name" => filename,
    "kind" => kind,
    "contentType" => content_type.empty? ? content_type_for(target_path) : content_type,
    "size" => bytes.bytesize,
    "url" => "/uploads/#{CGI.escape(stored_name)}"
  }

  if kind == "text"
    attachment["previewText"] = bytes.dup.force_encoding("UTF-8").encode("UTF-8", invalid: :replace, undef: :replace, replace: "").slice(0, 1200)
  end

  attachment
end

class ChatState
  attr_reader :presence_store

  def initialize
    @presence_store = {}
  end

  def messages
    STORE_MUTEX.synchronize { load_messages }
  end

  def room_messages(room_id)
    messages.select { |message| message["roomId"] == room_id }.last(120)
  end

  def add_message(message)
    STORE_MUTEX.synchronize do
      current = load_messages
      current << message
      save_messages(current)
    end
  end

  def touch_presence(payload)
    STORE_MUTEX.synchronize do
      @presence_store[payload["clientId"]] = payload
      prune_presence!
    end
  end

  def remove_presence(client_id)
    STORE_MUTEX.synchronize do
      @presence_store.delete(client_id)
      prune_presence!
    end
  end

  def current_presence
    STORE_MUTEX.synchronize do
      prune_presence!
      active_presence(@presence_store)
    end
  end

  def current_typers(room_id, client_id)
    STORE_MUTEX.synchronize do
      prune_presence!
      active_typers_for_room(@presence_store, room_id, client_id)
    end
  end

  private

  def prune_presence!
    now = Time.now
    @presence_store.delete_if do |_id, member|
      updated_at = Time.parse(member["updatedAt"].to_s) rescue nil
      updated_at.nil? || now - updated_at > PRESENCE_TTL
    end
  end
end

CHAT_STATE = ChatState.new

class AppServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_GET(req, res)
    if PUBLIC_FILES.key?(req.path)
      file_name, content_type = PUBLIC_FILES.fetch(req.path)
      path = File.join(ROOT, file_name)
      res.status = 200
      res["Content-Type"] = content_type
      res["Cache-Control"] = "no-store"
      res.body = File.binread(path)
      return
    end

    if req.path.start_with?("/uploads/")
      serve_upload(req, res)
      return
    end

    case req.path
    when "/api/rooms"
      json_response(res, status: 200, body: { rooms: ROOMS })
    when "/api/state"
      room_id = req.query["roomId"].to_s
      client_id = req.query["clientId"].to_s
      room_id = ROOMS.first["id"] unless room_exists?(room_id)
      json_response(
        res,
        status: 200,
        body: {
          roomId: room_id,
          messages: CHAT_STATE.room_messages(room_id),
          members: CHAT_STATE.current_presence,
          typers: CHAT_STATE.current_typers(room_id, client_id)
        }
      )
    else
      res.status = 404
      res["Content-Type"] = "text/plain; charset=utf-8"
      res.body = "Not found"
    end
  end

  def do_POST(req, res)
    case req.path
    when "/api/messages"
      create_message(req, res)
    when "/api/presence"
      touch_presence(req, res)
    else
      res.status = 404
      res["Content-Type"] = "text/plain; charset=utf-8"
      res.body = "Not found"
    end
  end

  def do_DELETE(req, res)
    return method_not_allowed(res) unless req.path == "/api/presence"

    client_id = req.query["clientId"].to_s
    CHAT_STATE.remove_presence(client_id) unless client_id.empty?
    json_response(res, status: 200, body: { ok: true })
  end

  private

  def serve_upload(req, res)
    stored_name = CGI.unescape(req.path.delete_prefix("/uploads/"))
    target_path = File.expand_path(File.join(UPLOAD_DIR, stored_name))
    unless target_path.start_with?(UPLOAD_DIR) && File.file?(target_path)
      res.status = 404
      res["Content-Type"] = "text/plain; charset=utf-8"
      res.body = "Not found"
      return
    end

    res.status = 200
    res["Content-Type"] = content_type_for(target_path)
    res["Cache-Control"] = "no-store"
    res.body = File.binread(target_path)
  end

  def create_message(req, res)
    room_id = req.query["roomId"].to_s
    body = normalize_text(req.query["body"])
    author_name = normalize_text(req.query["authorName"])
    author_id = normalize_text(req.query["authorId"])

    unless room_exists?(room_id)
      return json_response(res, status: 400, body: { error: "聊天室不存在。" })
    end

    if author_name.empty? || author_id.empty?
      return json_response(res, status: 400, body: { error: "缺少使用者資訊。" })
    end

    upload_entries = extract_upload_entries(req)
    attachments = upload_entries.map { |upload| build_attachment(upload) }

    if body.empty? && attachments.empty?
      return json_response(res, status: 400, body: { error: "請輸入文字或至少上傳一個附件。" })
    end

    message = {
      "id" => SecureRandom.uuid,
      "roomId" => room_id,
      "authorId" => author_id,
      "authorName" => author_name,
      "type" => "message",
      "body" => body,
      "attachments" => attachments,
      "createdAt" => Time.now.iso8601
    }

    CHAT_STATE.add_message(message)
    json_response(res, status: 200, body: { ok: true, message: message })
  rescue StandardError => error
    json_response(res, status: 400, body: { error: error.message })
  end

  def touch_presence(req, res)
    payload = parse_json_body(req)
    unless payload
      return json_response(res, status: 400, body: { error: "請提供有效的 JSON 內容。" })
    end

    room_id = payload["roomId"].to_s
    client_id = normalize_text(payload["clientId"])
    nickname = normalize_text(payload["nickname"])

    unless room_exists?(room_id)
      return json_response(res, status: 400, body: { error: "聊天室不存在。" })
    end

    if client_id.empty? || nickname.empty?
      return json_response(res, status: 400, body: { error: "缺少 clientId 或名稱。" })
    end

    timestamp = Time.now.iso8601
    CHAT_STATE.touch_presence(
      "clientId" => client_id,
      "nickname" => nickname,
      "roomId" => room_id,
      "typing" => payload["typing"] == true,
      "updatedAt" => timestamp,
      "typingUpdatedAt" => payload["typing"] == true ? timestamp : nil
    )

    json_response(res, status: 200, body: { ok: true })
  end

  def method_not_allowed(res)
    res.status = 405
    res["Content-Type"] = "application/json; charset=utf-8"
    res.body = JSON.generate({ error: "Method not allowed" })
  end
end

server = WEBrick::HTTPServer.new(
  Port: (ENV["PORT"] || 4571).to_i,
  BindAddress: ENV["HOST"] || "0.0.0.0",
  AccessLog: [],
  Logger: WEBrick::Log.new($stdout, WEBrick::Log::INFO)
)

server.mount "/", AppServlet

trap("INT") { server.shutdown }
trap("TERM") { server.shutdown }

server.start
