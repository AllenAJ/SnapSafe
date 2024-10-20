const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = document.getElementById('copy-btn');
    const saveBtn = document.getElementById('save-btn');
    const editBtn = document.getElementById('edit-btn');
   // const uploadBtn = document.getElementById('upload-btn');
    const closeBtn = document.getElementById('close-btn');

    ipcRenderer.on('screenshot-data', (event, screenshotDataUrl) => {
        const previewImg = document.getElementById('screenshot-preview');
        if (previewImg) {
          previewImg.src = screenshotDataUrl;
          console.log('Screenshot preview source set:', screenshotDataUrl.substring(0, 100) + '...');
        } else {
          console.error('Screenshot preview element not found');
        }
      });

    copyBtn.addEventListener('click', () => {
        ipcRenderer.send('copy-screenshot');
    });

    saveBtn.addEventListener('click', () => {
        ipcRenderer.send('save-screenshot');
    });

    editBtn.addEventListener('click', () => {
        ipcRenderer.send('edit-screenshot');
    });

    // uploadBtn.addEventListener('click', () => {
    //     ipcRenderer.send('upload-screenshot');
    // });

    closeBtn.addEventListener('click', () => {
        const overlay = document.querySelector('.overlay');
        overlay.classList.remove('show');
        setTimeout(() => {
          ipcRenderer.send('close-quick-access');
        }, 300); // Wait for the fade-out animation to complete
      });
    ipcRenderer.on('show-feedback', (event, message) => {
        console.log(message);
        // You can implement a toast notification here if desired
    });
});