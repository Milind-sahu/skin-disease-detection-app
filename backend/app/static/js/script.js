// Additional JavaScript utilities if needed
console.log("Skin Disease Detection System Loaded");

// Function to show notifications
function showNotification(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `alert alert-${type} custom-toast fade-in`;
  toast.innerHTML = message;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.zIndex = "1000";
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
