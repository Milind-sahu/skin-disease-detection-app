(() => {
    "use strict";

    const dropZone = document.getElementById("dropZone");
    const browseBtn = document.getElementById("browseBtn");
    const uploadBtn = document.getElementById("uploadBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const progressHost = document.querySelector(".file-upload-progress");

    // Results UI elements
    const predictionResult = document.getElementById("predictionResult");
    const resultImage = document.getElementById("resultImage");
    const detectedClass = document.getElementById("detectedClass");
    const confidenceBar = document.getElementById("confidenceBar");
    const confidenceValue = document.getElementById("confidenceValue");

    if (!dropZone || !browseBtn || !uploadBtn || !cancelBtn || !progressHost) {
        return;
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "fileInput";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    dropZone.insertAdjacentElement("afterend", fileInput);

    const state = {
        file: null,
        xhr: null,
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

    function renderEmpty() {
        stopUpload();
        state.file = null;
        progressHost.innerHTML = `<span class="empty-progress">📂 No file selected</span>`;
        uploadBtn.disabled = true;
        if (predictionResult) predictionResult.style.display = "none";
    }

    function renderSelected(file) {
        stopUpload();
        state.file = file;
        uploadBtn.disabled = false;

        const safeName = sanitizeText(file.name);
        const size = formatBytes(file.size);

        progressHost.innerHTML = `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-details">
                        <div class="file-name" title="${safeName}">${safeName}</div>
                        <div class="file-meta">
                            <span class="file-size">Size: ${sanitizeText(size)}</span>
                        </div>
                        <div class="progress-wrapper" aria-live="polite">
                            <div class="progress-bar-bg">
                                <div class="progress-fill" style="width: 0%"></div>
                            </div>
                            <div class="progress-percent">0%</div>
                        </div>
                        <div class="upload-status" style="margin-top: 0.35rem; font-size: 0.75rem; color: #94a3b8;">
                            Ready for analysis
                        </div>
                    </div>
                </div>
            </div>
        `;
        if (predictionResult) predictionResult.style.display = "none";
    }

    function setUploadingUI(percent) {
        const fill = progressHost.querySelector(".progress-fill");
        const pct = progressHost.querySelector(".progress-percent");
        const statusText = progressHost.querySelector(".upload-status");
        if (!fill || !pct) return;

        const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
        fill.style.width = `${clamped}%`;
        pct.textContent = `${clamped.toFixed(0)}%`;
        if (statusText) statusText.textContent = percent < 100 ? "Uploading image..." : "Analyzing with AI...";
    }

    function setErrorUI(message) {
        const pct = progressHost.querySelector(".progress-percent");
        const fill = progressHost.querySelector(".progress-fill");
        const statusText = progressHost.querySelector(".upload-status");

        if (fill) fill.style.width = "0%";
        if (pct) {
            pct.classList.add("error");
            pct.textContent = "Error";
        }
        if (statusText) statusText.textContent = "Analysis failed";

        let errorMsg = progressHost.querySelector(".upload-error-message");
        if (!errorMsg) {
            errorMsg = document.createElement("div");
            errorMsg.className = "upload-error-message";
            errorMsg.style.marginTop = "0.5rem";
            errorMsg.style.color = "#ef4444";
            errorMsg.style.fontSize = "0.8rem";
            progressHost.appendChild(errorMsg);
        }
        errorMsg.textContent = message;
    }

    function stopUpload() {
        if (state.xhr) {
            state.xhr.abort();
            state.xhr = null;
        }
        const existing = progressHost.querySelector(".upload-error-message");
        if (existing) existing.remove();
    }

    function handleFile(file) {
        if (!file.type || !file.type.startsWith("image/")) {
            setErrorUI("Please select an image file.");
            return;
        }
        renderSelected(file);
    }

    // Event Listeners
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });

    browseBtn.addEventListener("click", () => {
        fileInput.value = "";
        fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
    });

    uploadBtn.addEventListener("click", () => {
        if (!state.file) return;
        
        const formData = new FormData();
        formData.append("file", state.file);

        const xhr = new XMLHttpRequest();
        state.xhr = xhr;

        xhr.open("POST", "/api/predict", true);

        xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
                setUploadingUI((ev.loaded / ev.total) * 90); // Use 90% for upload, 10% for processing
            }
        };

        xhr.onload = () => {
            let response = {};
            try {
                response = xhr.responseText ? JSON.parse(xhr.responseText) : {};
            } catch (err) {
                response = {};
            }

            if (xhr.status === 200) {
                if (response.success) {
                    setUploadingUI(100);
                    displayResult(response);
                } else {
                    setErrorUI(response.error || "Unknown error occurred");
                }
            } else if (xhr.status === 202 || xhr.status === 503) {
                setErrorUI(response.error || "Model is warming up. Please retry in a few seconds.");
            } else {
                const message = response.error ? `${response.error} (HTTP ${xhr.status})` : `Server error: ${xhr.status}`;
                setErrorUI(message);
            }
            state.xhr = null;
        };

        xhr.onerror = () => {
            setErrorUI("Network error occurred");
            state.xhr = null;
        };

        xhr.send(formData);
    });

    cancelBtn.addEventListener("click", renderEmpty);

    function displayResult(data) {
        if (!predictionResult) return;

        detectedClass.textContent = data.predicted_class;
        confidenceValue.textContent = data.confidence_percentage;
        confidenceBar.style.width = data.confidence_percentage;
        
        // Show the image that was uploaded
        const reader = new FileReader();
        reader.onload = (e) => {
            resultImage.src = e.target.result;
            predictionResult.style.display = "block";
            predictionResult.scrollIntoView({ behavior: 'smooth' });
        };
        reader.readAsDataURL(state.file);

        const statusText = progressHost.querySelector(".upload-status");
        if (statusText) statusText.textContent = "Analysis complete!";
        const pct = progressHost.querySelector(".progress-percent");
        if (pct) pct.classList.add("completed");
    }

})();

// Contact form logic
(() => {
    "use strict";
    const form = document.querySelector(".contact-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const btn = form.querySelector("button");
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Sending...";
        
        setTimeout(() => {
            alert("Thank you for your message! This is a demo, so no actual email was sent.");
            btn.disabled = false;
            btn.textContent = originalText;
            form.reset();
        }, 1500);
    });
})();
