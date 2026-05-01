(() => {
    "use strict";

    const dropZone = document.getElementById("dropZone");
    const browseBtn = document.getElementById("browseBtn");
    const uploadBtn = document.getElementById("uploadBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const progressHost = document.querySelector(".file-upload-progress");

    if (!dropZone || !browseBtn || !uploadBtn || !cancelBtn || !progressHost) {
        // Required elements are not present; fail silently to avoid breaking the page.
        return;
    }

    // Create hidden file input (the current index.html doesn't include it).
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "fileInput";
    fileInput.accept = "image/*";
    // Intentionally NOT using `multiple` since the requirement is "Upload 1 image only".
    fileInput.style.display = "none";
    dropZone.insertAdjacentElement("afterend", fileInput);

    const state = {
        file: null,
        xhr: null,
        simulateTimer: null,
    };

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        const value = bytes / Math.pow(1024, i);
        const decimals = i === 0 ? 0 : 1;
        return `${value.toFixed(decimals)} ${units[i]}`;
    }

    function sanitizeText(text) {
        return String(text ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function getFileTypeLabel(file) {
        if (!file) return "";
        // file.type may be empty in some browsers; fall back to extension.
        if (file.type) return file.type;
        const name = file.name || "";
        const ext = name.includes(".") ? name.split(".").pop() : "";
        return ext ? `image/${ext}` : "unknown";
    }

    function renderEmpty() {
        stopUpload();
        state.file = null;

        progressHost.innerHTML = `<span class="empty-progress">📂 No file selected</span>`;
        uploadBtn.disabled = true;
        uploadBtn.classList.remove("disabled");
    }

    function renderSelected(file) {
        stopUpload();
        state.file = file;
        uploadBtn.disabled = false;

        const safeName = sanitizeText(file.name);
        const size = formatBytes(file.size);
        const type = sanitizeText(getFileTypeLabel(file));

        progressHost.innerHTML = `
            <div class="file-item">
            <div class="file-info">
                <div class="file-details">
                    <div class="file-name" title="${safeName}">${safeName}</div>
                    <div class="file-meta">
                        <span class="file-size">Size: ${sanitizeText(size)}</span>
                        <span>Type: ${type}</span>
                    </div>
                    <div class="progress-wrapper" aria-live="polite">
                        <div class="progress-bar-bg">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-percent">0%</div>
                    </div>
                    <div class="upload-status" style="margin-top: 0.35rem; font-size: 0.75rem; color: #94a3b8;">
                        Ready to upload
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    function setUploadingUI(percent) {
        const fill = progressHost.querySelector(".progress-fill");
        const pct = progressHost.querySelector(".progress-percent");
        const statusIcon = progressHost.querySelector(".file-status-icon");
        const statusText = progressHost.querySelector(".upload-status");
        if (!fill || !pct) return;

        pct.classList.remove("completed", "error");
        statusIcon && (statusIcon.textContent = "⏫");
        statusText && (statusText.textContent = "Uploading...");

        const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
        fill.classList.add("uploading");
        fill.style.width = `${clamped}%`;
        pct.textContent = `${clamped.toFixed(0)}%`;
        pct.style.color = ""; // reset any inline overrides
    }

    function setCompletedUI() {
        const fill = progressHost.querySelector(".progress-fill");
        const pct = progressHost.querySelector(".progress-percent");
        const statusIcon = progressHost.querySelector(".file-status-icon");
        const statusText = progressHost.querySelector(".upload-status");
        if (!fill || !pct) return;

        fill.classList.remove("uploading");
        fill.style.width = "100%";

        statusIcon && (statusIcon.textContent = "✔️");
        statusText && (statusText.textContent = "Upload complete");
        pct.classList.add("completed");
        pct.textContent = "100%";
    }

    function setErrorUI(message) {
        const pct = progressHost.querySelector(".progress-percent");
        const fill = progressHost.querySelector(".progress-fill");
        const statusIcon = progressHost.querySelector(".file-status-icon");
        const statusText = progressHost.querySelector(".upload-status");

        if (fill) {
            fill.classList.remove("uploading");
            fill.style.width = "0%";
        }
        if (pct) {
            pct.classList.remove("completed");
            pct.classList.add("error");
            pct.textContent = "Error";
        }
        if (statusIcon) statusIcon.textContent = "⚠️";
        statusText && (statusText.textContent = "Upload failed");

        // Ensure message is visible even if CSS doesn't style it.
        if (!progressHost.querySelector(".upload-error-message")) {
            const msg = document.createElement("div");
            msg.className = "upload-error-message";
            msg.style.marginTop = "0.5rem";
            msg.style.color = "#ef4444";
            msg.style.fontFamily = "Inter, monospace";
            msg.style.fontSize = "0.8rem";
            msg.textContent = message;
            progressHost.appendChild(msg);
        } else {
            progressHost.querySelector(".upload-error-message").textContent = message;
        }
    }

    function stopUpload() {
        if (state.simulateTimer) {
            clearInterval(state.simulateTimer);
            state.simulateTimer = null;
        }
        if (state.xhr) {
            try {
                state.xhr.abort();
            } catch {
                // ignore
            }
        }
        state.xhr = null;
        // Remove any existing error message.
        const existing = progressHost.querySelector(".upload-error-message");
        if (existing) existing.remove();
    }

    function pickSingleImage(fileListOrFile) {
        const files = Array.from(fileListOrFile instanceof FileList ? fileListOrFile : [fileListOrFile]);
        const file = files.find(Boolean) || null;
        if (!file) return null;

        // Enforce "image only" and "single image".
        if (!file.type || !file.type.startsWith("image/")) return { error: "Please select an image file." };
        return { file };
    }

    function handleFile(file) {
        const picked = pickSingleImage(file);
        if (picked?.error) {
            stopUpload();
            state.file = null;
            // Keep the existing empty-ish state but show error.
            progressHost.innerHTML = `<span class="empty-progress">📂 No file selected</span>`;
            uploadBtn.disabled = true;
            setErrorUI(picked.error);
            return;
        }
        renderSelected(picked.file);
    }

    // Drag & drop handlers
    function onDragOver(e) {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    }

    function onDragLeave() {
        dropZone.classList.remove("drag-over");
    }

    function onDrop(e) {
        e.preventDefault();
        dropZone.classList.remove("drag-over");

        const dt = e.dataTransfer;
        if (!dt || !dt.files || dt.files.length === 0) return;
        // "Upload 1 image only" => use the first image.
        handleFile(dt.files[0]);
    }

    // Browse handlers
    function onBrowseClick() {
        // Reset input so selecting the same file again triggers `change`.
        fileInput.value = "";
        fileInput.click();
    }

    function onFileInputChange() {
        if (!fileInput.files || fileInput.files.length === 0) return;
        // "Upload 1 image only" => use the first selected image.
        handleFile(fileInput.files[0]);
    }

    // Upload
    function uploadWithXHR(file) {
        // If your backend URL is not known, we simulate upload progress.
        // To use a real upload, set `window.UPLOAD_URL` to your endpoint.
        const uploadUrl = window.UPLOAD_URL;

        if (!uploadUrl) {
            simulateUpload(file);
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        state.xhr = xhr;

        xhr.open("POST", uploadUrl, true);

        xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
                const percent = (ev.loaded / ev.total) * 100;
                setUploadingUI(percent);
            } else {
                // Fallback: show indeterminate-ish progress.
                setUploadingUI(10);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                setCompletedUI();
            } else {
                setErrorUI(`Upload failed (HTTP ${xhr.status}).`);
            }
            state.xhr = null;
        };

        xhr.onerror = () => {
            setErrorUI("Upload failed due to a network error.");
            state.xhr = null;
        };

        xhr.onabort = () => {
            // Cancel button will call stopUpload().
            state.xhr = null;
        };

        setUploadingUI(0);
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(formData);
    }

    function simulateUpload(file) {
        stopUpload();
        const start = Date.now();
        const durationMs = 4200; // feels responsive without needing a backend

        // Show uploading state immediately.
        setUploadingUI(0);

        state.simulateTimer = setInterval(() => {
            const elapsed = Date.now() - start;
            const percent = Math.min(100, (elapsed / durationMs) * 100);
            setUploadingUI(percent);

            if (percent >= 100) {
                clearInterval(state.simulateTimer);
                state.simulateTimer = null;
                setCompletedUI();
            }
        }, 80);
    }

    function onUploadClick() {
        if (!state.file) {
            setErrorUI("Please select an image before uploading.");
            return;
        }

        // Ensure any previous error is cleared.
        const existing = progressHost.querySelector(".upload-error-message");
        if (existing) existing.remove();

        // Clear percent styling from selection state and switch to uploading.
        const pct = progressHost.querySelector(".progress-percent");
        if (pct) {
            pct.classList.remove("completed", "error");
        }
        uploadWithXHR(state.file);
    }

    function onCancelClick() {
        renderEmpty();
    }

    // Initial UI state
    progressHost.innerHTML = `<span class="empty-progress">📂 No file selected</span>`;
    uploadBtn.disabled = true;

    // Wire up events
    dropZone.addEventListener("dragover", onDragOver);
    dropZone.addEventListener("dragleave", onDragLeave);
    dropZone.addEventListener("drop", onDrop);

    browseBtn.addEventListener("click", onBrowseClick);
    fileInput.addEventListener("change", onFileInputChange);

    uploadBtn.addEventListener("click", onUploadClick);
    cancelBtn.addEventListener("click", onCancelClick);
})();

// Contact form submission (front-end)
(() => {
    "use strict";

    const firstNameEl = document.getElementById("firstName");
    const lastNameEl = document.getElementById("lastName");
    const emailEl = document.getElementById("email");
    const messageEl = document.getElementById("message");
    const formEl = document.querySelector(".contact-form");

    if (!firstNameEl || !lastNameEl || !emailEl || !messageEl || !formEl) return;

    let submitting = false;

    function ensureStatusNode() {
        let node = document.getElementById("contactStatus");
        if (node) return node;

        node = document.createElement("div");
        node.id = "contactStatus";
        node.setAttribute("aria-live", "polite");
        node.style.marginTop = "14px";
        node.style.fontFamily = '"Inter", monospace';
        node.style.fontSize = "0.9rem";
        node.style.fontWeight = "600";
        node.style.color = "#94a3b8";

        // Put the status right after the message field for better UX.
        messageEl.insertAdjacentElement("afterend", node);
        return node;
    }

    function setStatus(text, kind) {
        const statusNode = ensureStatusNode();
        statusNode.textContent = text;
        if (kind === "error") statusNode.style.color = "#ef4444";
        else if (kind === "success") statusNode.style.color = "#10b981";
        else statusNode.style.color = "#94a3b8";
    }

    function setFormDisabled(disabled) {
        [firstNameEl, lastNameEl, emailEl, messageEl].forEach((el) => {
            el.disabled = disabled;
        });
        // Disable submit button if any exists in the form later.
        const submitBtn = formEl.querySelector("button[type='submit']");
        if (submitBtn) submitBtn.disabled = disabled;
    }

    function validate() {
        const firstName = firstNameEl.value.trim();
        const lastName = lastNameEl.value.trim();
        const email = emailEl.value.trim();
        const message = messageEl.value.trim();

        if (!firstName) return { ok: false, error: "Please enter your first name." };
        if (!lastName) return { ok: false, error: "Please enter your last name." };
        if (!email) return { ok: false, error: "Please enter your email." };
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return { ok: false, error: "Please enter a valid email address." };
        if (!message) return { ok: false, error: "Please enter a message." };
        if (message.length < 5) return { ok: false, error: "Message should be at least 5 characters." };

        return { ok: true, data: { firstName, lastName, email, message } };
    }

    formEl.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;

        const result = validate();
        if (!result.ok) {
            setStatus(result.error, "error");
            return;
        }

        submitting = true;
        setFormDisabled(true);
        setStatus("Sending your message...", "info");

        try {
            // If you later add a backend endpoint, set:
            //   window.CONTACT_URL = "https://your-api/endpoint";
            const url = window.CONTACT_URL;
            if (url) {
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(result.data),
                });

                if (!res.ok) {
                    throw new Error(`Server responded with HTTP ${res.status}`);
                }
            } else {
                // No backend configured => simulate success.
                await new Promise((r) => setTimeout(r, 1200));
            }

            setStatus("Message sent! We'll get back to you soon.", "success");
            formEl.reset();
        } catch (err) {
            setStatus(err?.message ? String(err.message) : "Failed to send message.", "error");
        } finally {
            submitting = false;
            setFormDisabled(false);
        }
    });
})();

