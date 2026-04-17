const galleryElement = document.querySelector("#gallery");
const emptyStateElement = document.querySelector("#gallery-empty");
const template = document.querySelector("#project-template");
const uploadForm = document.querySelector("#upload-form");
const formStatus = document.querySelector("#form-status");
const sortSelect = document.querySelector("#sort-select");
const topbarRankingButton = document.querySelector("#topbar-ranking");

let projects = [];

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return { error: text || "伺服器回傳了無法辨識的內容。" };
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function sortProjects(items) {
  const mode = sortSelect.value;
  const copied = [...items];

  copied.sort((a, b) => {
    if (mode === "newest") {
      return new Date(b.created_at) - new Date(a.created_at);
    }

    if (b.votes !== a.votes) {
      return b.votes - a.votes;
    }

    return new Date(b.created_at) - new Date(a.created_at);
  });

  return copied;
}

function createCard(project) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".project-card");
  const cover = fragment.querySelector(".project-cover");
  const author = fragment.querySelector(".project-author");
  const date = fragment.querySelector(".project-date");
  const title = fragment.querySelector(".project-title");
  const description = fragment.querySelector(".project-description");
  const downloadLink = fragment.querySelector(".download-link");
  const scratchLink = fragment.querySelector(".scratch-link");
  const voteCount = fragment.querySelector(".vote-count");
  const voteButton = fragment.querySelector(".vote-button");
  const cardStatus = fragment.querySelector(".card-status");

  author.textContent = project.author;
  date.textContent = formatDate(project.created_at);
  title.textContent = project.title;
  description.textContent = project.description;
  downloadLink.href = project.project_url;
  downloadLink.download = project.project_filename;
  voteCount.textContent = project.votes;

  if (project.thumbnail_url) {
    cover.src = project.thumbnail_url;
    cover.alt = `${project.title} 縮圖`;
  } else {
    cover.alt = "";
  }

  if (project.scratch_link) {
    scratchLink.href = project.scratch_link;
    scratchLink.hidden = false;
  }

  voteButton.addEventListener("click", async () => {
    voteButton.disabled = true;
    cardStatus.textContent = "送出票選中...";

    try {
      const response = await fetch(`/api/projects/${project.id}/vote`, {
        method: "POST"
      });
      const result = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(result.error || "投票失敗");
      }

      project.votes = result.votes;
      voteCount.textContent = result.votes;
      cardStatus.textContent = "投票成功，感謝支持！";
      renderProjects();
    } catch (error) {
      voteButton.disabled = false;
      cardStatus.textContent = error.message;
    }
  });

  card.dataset.id = project.id;
  return fragment;
}

function renderProjects() {
  galleryElement.innerHTML = "";
  const sorted = sortProjects(projects);
  emptyStateElement.hidden = sorted.length > 0;

  sorted.forEach((project) => {
    galleryElement.appendChild(createCard(project));
  });
}

async function loadProjects() {
  const response = await fetch("/api/projects");
  const data = await response.json();
  projects = data.projects || [];
  renderProjects();
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formStatus.textContent = "正在上傳作品...";

  const submitButton = uploadForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      body: new FormData(uploadForm)
    });
    const result = await readResponseBody(response);

    if (!response.ok) {
      throw new Error(result.error || "上傳失敗");
    }

    formStatus.textContent = "作品已成功上傳，已加入票選牆。";
    uploadForm.reset();
    await loadProjects();
  } catch (error) {
    formStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

sortSelect.addEventListener("change", renderProjects);

if (topbarRankingButton) {
  topbarRankingButton.addEventListener("click", () => {
    sortSelect.value = "popular";
    renderProjects();
    document.querySelector("#gallery-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

loadProjects().catch(() => {
  formStatus.textContent = "目前無法載入作品資料，請稍後再試。";
});
