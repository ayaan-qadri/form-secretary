/**
 * Form Secretary - Website Interactive Scripts
 * Pure vanilla JS, zero dependencies, accessible.
 */

document.addEventListener('DOMContentLoaded', () => {
  initInstallationTabs();
  initCodeCopyButtons();
  initMobileMenu();
});

/* ==========================================
   2. Installation Tabs
   ========================================== */
function initInstallationTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');

      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const activePanel = document.getElementById('tab-' + tabTarget);
      if (activePanel) {
        activePanel.classList.add('active');
      }
    });
  });
}

/* ==========================================
   3. Universal Click-to-Copy System
   ========================================== */
function initCodeCopyButtons() {
  // 1. Full-width command snippet blocks
  const commandBlocks = document.querySelectorAll('.copyable-command');
  commandBlocks.forEach((block) => {
    const handleCopy = () => {
      const textToCopy = block.getAttribute('data-copy') || block.querySelector('code')?.innerText;
      if (!textToCopy) return;

      navigator.clipboard.writeText(textToCopy.trim()).then(() => {
        block.classList.add('copied');
        const copyTextEl = block.querySelector('.copy-text');
        if (copyTextEl) copyTextEl.innerText = 'Copied!';

        showToast('Copied to clipboard: ' + textToCopy.trim());

        setTimeout(() => {
          block.classList.remove('copied');
          if (copyTextEl) copyTextEl.innerText = 'Copy';
        }, 2000);
      }).catch(() => {
        showToast('Failed to copy');
      });
    };

    block.addEventListener('click', handleCopy);
    block.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCopy();
      }
    });
  });

  // 2. Inline code snippets
  const inlineCodes = document.querySelectorAll('.copyable-inline');
  inlineCodes.forEach((codeEl) => {
    const handleInlineCopy = () => {
      const textToCopy = codeEl.getAttribute('data-copy') || codeEl.innerText;
      if (!textToCopy) return;

      navigator.clipboard.writeText(textToCopy.trim()).then(() => {
        codeEl.classList.add('copied');
        showToast('Copied: ' + textToCopy.trim());

        setTimeout(() => {
          codeEl.classList.remove('copied');
        }, 1500);
      }).catch(() => {
        showToast('Failed to copy');
      });
    };

    codeEl.addEventListener('click', handleInlineCopy);
    codeEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleInlineCopy();
      }
    });
  });

  // 3. Inline clickable links (chrome://extensions, about:debugging)
  const inlineLinks = document.querySelectorAll('.copyable-inline-link');
  inlineLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const textToCopy = link.getAttribute('data-copy') || link.querySelector('code')?.innerText;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy.trim()).then(() => {
          link.classList.add('copied');
          showToast('Copied: ' + textToCopy.trim() + ' (paste into address bar)');
          setTimeout(() => {
            link.classList.remove('copied');
          }, 2000);
        }).catch(() => {
          // fallback
        });
      }
    });
  });

  // 4. Generic code copy buttons
  const copyButtons = document.querySelectorAll('.code-copy-btn, .copy-action-btn');
  copyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.getAttribute('data-copy') || btn.closest('.code-container')?.querySelector('.code-content')?.innerText;

      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy.trim()).then(() => {
          const originalText = btn.innerText;
          btn.innerText = 'Copied!';
          showToast('Copied to clipboard');
          setTimeout(() => {
            btn.innerText = originalText;
          }, 2000);
        }).catch(() => {
          showToast('Failed to copy');
        });
      }
    });
  });
}

/* ==========================================
   4. Mobile Navigation Menu
   ========================================== */
function initMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  const navbar = document.querySelector('.navbar');

  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navLinks.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
    });

    // Close on navigation link click
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });

    // Close when clicking outside navbar
    document.addEventListener('click', (e) => {
      if (navbar && !navbar.contains(e.target) && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.focus();
      }
    });
  }
}

/* ==========================================
   5. Toast Notification Helper
   ========================================== */
function showToast(message) {
  let toast = document.getElementById('website-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'website-toast';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> <span>${message}</span>`;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}
