require "digest"
require "fileutils"
require "json"
require "securerandom"
require "time"
require "webrick"

ROOT = File.expand_path(__dir__)
PUBLIC_DIR = File.join(ROOT, "public")
DATA_DIR = File.join(ROOT, "data")
UPLOAD_DIR = File.join(DATA_DIR, "uploads")
DB_FILE = File.join(DATA_DIR, "projects.json")

FileUtils.mkdir_p(PUBLIC_DIR)
FileUtils.mkdir_p(UPLOAD_DIR)
File.write(DB_FILE, "[]\n") unless File.exist?(DB_FILE)

def read_projects
  JSON.parse(File.read(DB_FILE), symbolize_names: true)
rescue JSON::ParserError
  []
end

def write_projects(projects)
  File.write(DB_FILE, JSON.pretty_generate(projects) + "\n")
end

def json_response(res, status:, body:, headers: {})
  res.status = status
  res["Content-Type"] = "application/json; charset=utf-8"
  res["Cache-Control"] = "no-store"
  headers.each { |key, value| res[key] = value }
  res.body = JSON.generate(body)
end

def bad_request(res, message)
  json_response(res, status: 400, body: { error: message })
end

def serve_file(res, path, content_type)
  res.status = 200
  res["Content-Type"] = content_type
  res["Cache-Control"] = "no-store"
  res.body = File.binread(path)
end

def client_identifier(req)
  remote_ip = req.peeraddr[3] rescue "unknown-ip"
  user_agent = normalize_text(req["User-Agent"]).strip
  "#{remote_ip}-#{user_agent}"
end

def public_project(project)
  {
    id: project[:id],
    title: project[:title],
    author: project[:author],
    description: project[:description],
    scratch_link: project[:scratch_link],
    votes: project[:votes],
    created_at: project[:created_at],
    project_url: "/uploads/#{project[:stored_project_name]}",
    project_filename: project[:project_filename],
    thumbnail_url: project[:stored_thumbnail_name] ? "/uploads/#{project[:stored_thumbnail_name]}" : nil
  }
end

def extension_allowed?(filename, allowed)
  allowed.include?(File.extname(filename.to_s).downcase)
end

def sanitize_filename(filename)
  File.basename(filename.to_s).gsub(/[^\w.\-]+/, "_")
end

def normalize_text(value)
  value.to_s.dup.force_encoding("UTF-8").encode("UTF-8", invalid: :replace, undef: :replace, replace: "")
end

def extract_upload(form_field)
  return nil unless form_field.respond_to?(:filename) && form_field.filename

  {
    filename: sanitize_filename(form_field.filename),
    data: form_field.to_s.b
  }
end

server = WEBrick::HTTPServer.new(
  Port: (ENV["PORT"] || 4567).to_i,
  BindAddress: ENV["HOST"] || "0.0.0.0",
  DocumentRoot: PUBLIC_DIR,
  AccessLog: [],
  Logger: WEBrick::Log.new($stdout, WEBrick::Log::INFO)
)

server.mount_proc "/api/projects" do |req, res|
  if req.path == "/api/projects"
    case req.request_method
    when "GET"
      projects = read_projects
        .sort_by { |project| [project[:votes].to_i, project[:created_at].to_s] }
        .reverse
        .map { |project| public_project(project) }

      json_response(res, status: 200, body: { projects: projects })
    when "POST"
      title = normalize_text(req.query["title"]).strip
      author = normalize_text(req.query["author"]).strip
      description = normalize_text(req.query["description"]).strip
      scratch_link = normalize_text(req.query["scratch_link"]).strip

      return bad_request(res, "請填寫作品名稱。") if title.empty?
      return bad_request(res, "請填寫作者名稱。") if author.empty?
      return bad_request(res, "請填寫作品介紹。") if description.empty?

      project_upload = extract_upload(req.query["project_file"])
      return bad_request(res, "請上傳 Scratch 專案檔（.sb3 或 .sb2）。") unless project_upload
      return bad_request(res, "Scratch 專案只接受 .sb3 或 .sb2。") unless extension_allowed?(project_upload[:filename], [".sb3", ".sb2"])

      thumbnail_upload = extract_upload(req.query["thumbnail"])
      if thumbnail_upload && !extension_allowed?(thumbnail_upload[:filename], [".jpg", ".jpeg", ".png", ".gif", ".webp"])
        return bad_request(res, "縮圖只接受 jpg、png、gif 或 webp。")
      end

      project_id = SecureRandom.hex(6)
      stored_project_name = "#{project_id}#{File.extname(project_upload[:filename]).downcase}"
      File.binwrite(File.join(UPLOAD_DIR, stored_project_name), project_upload[:data])

      stored_thumbnail_name = nil
      if thumbnail_upload
        stored_thumbnail_name = "#{project_id}-thumb#{File.extname(thumbnail_upload[:filename]).downcase}"
        File.binwrite(File.join(UPLOAD_DIR, stored_thumbnail_name), thumbnail_upload[:data])
      end

      projects = read_projects
      project = {
        id: project_id,
        title: title,
        author: author,
        description: description,
        scratch_link: scratch_link.empty? ? nil : scratch_link,
        votes: 0,
        voters: [],
        created_at: Time.now.iso8601,
        stored_project_name: stored_project_name,
        stored_thumbnail_name: stored_thumbnail_name,
        project_filename: project_upload[:filename]
      }
      projects << project
      write_projects(projects)

      json_response(res, status: 201, body: { project: public_project(project) })
    else
      json_response(res, status: 405, body: { error: "Method not allowed" })
    end
    next
  end

  vote_match = req.path.match(%r{\A/api/projects/([^/]+)/vote\z})
  unless vote_match && req.request_method == "POST"
    json_response(res, status: 404, body: { error: "Not found" })
    next
  end

  project_id = vote_match[1]
  projects = read_projects
  project = projects.find { |item| item[:id] == project_id }
  unless project
    json_response(res, status: 404, body: { error: "找不到作品。" })
    next
  end

  voter_cookie = req.cookies.find { |cookie| cookie.name == "scratch_vote_id" }
  voter_id = voter_cookie&.value
  unless voter_id && !voter_id.empty?
    source = "#{client_identifier(req)}-#{SecureRandom.hex(8)}"
    voter_id = Digest::SHA256.hexdigest(source)
    res.cookies << WEBrick::Cookie.new("scratch_vote_id", voter_id).tap do |cookie|
      cookie.path = "/"
      cookie.max_age = 60 * 60 * 24 * 365
    end
  end

  if project[:voters].include?(voter_id)
    json_response(res, status: 409, body: { error: "你已經投過這個作品了。", votes: project[:votes] })
    next
  end

  project[:votes] += 1
  project[:voters] << voter_id
  write_projects(projects)

  json_response(res, status: 200, body: { success: true, votes: project[:votes] })
end

server.mount_proc "/" do |req, res|
  case req.path
  when "/"
    serve_file(res, File.join(PUBLIC_DIR, "index.html"), "text/html; charset=utf-8")
  when "/styles.css"
    serve_file(res, File.join(PUBLIC_DIR, "styles.css"), "text/css; charset=utf-8")
  when "/app.js"
    serve_file(res, File.join(PUBLIC_DIR, "app.js"), "application/javascript; charset=utf-8")
  else
    res.status = 404
    res["Content-Type"] = "text/plain; charset=utf-8"
    res["Cache-Control"] = "no-store"
    res.body = "Not found"
  end
end

server.mount "/uploads", WEBrick::HTTPServlet::FileHandler, UPLOAD_DIR

trap("INT") { server.shutdown }
trap("TERM") { server.shutdown }

server.start
