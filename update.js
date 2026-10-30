document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('closeUpdateBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }
});
