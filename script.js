/* =========================================================
   Syria Silicon — Site Script
   Form submission via Supabase REST API
   ========================================================= */

/* ---------- SUPABASE CONFIGURATION ----------
   Replace these two values with your actual Supabase project URL and anon key.
   See DEPLOYMENT.md, "Step 3 — Wire up the website code" for instructions.

   These keys are the public 'anon' key, safe to expose in browser code.
   Row Level Security on the enquiries table is what protects your data.
*/
const SUPABASE_URL = 'https://qzfrhxjcsnhaqhckfswi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZnJoeGpjc25oYXFoY2tmc3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTIxODMsImV4cCI6MjA5NDE2ODE4M30.-DLbZB7xVjVpTTbhqk4EKkAqpC8XRua2C7gvTQwdkWM';

(function() {
  'use strict';

  // Mark JS as enabled — this triggers the reveal animations.
  document.body.classList.add('js-enabled');

  // ----- Mobile menu toggle -----
  const toggle = document.getElementById('mobileToggle');
  const mobileNav = document.getElementById('mobileNav');

  if (toggle && mobileNav) {
    toggle.addEventListener('click', function() {
      mobileNav.classList.toggle('active');
      const isActive = mobileNav.classList.contains('active');
      toggle.setAttribute('aria-expanded', isActive);
    });
    mobileNav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        mobileNav.classList.remove('active');
      });
    });
  }

  // ----- Nav background on scroll -----
  const nav = document.getElementById('nav');
  function handleScroll() {
    if (!nav) return;
    if (window.pageYOffset > 60) {
      nav.style.background = 'rgba(11, 37, 69, 0.97)';
      nav.style.boxShadow = '0 1px 0 rgba(168, 149, 105, 0.15)';
    } else {
      nav.style.background = 'rgba(11, 37, 69, 0.95)';
      nav.style.boxShadow = 'none';
    }
  }
  window.addEventListener('scroll', handleScroll, { passive: true });

  // ----- Scroll reveal -----
  const revealElements = document.querySelectorAll(
    '.section-head, .facts-grid .fact, .two-col-text > p, .aside-card, ' +
    '.resource-imagery figure, .stat-block, .phase-card, ' +
    '.partnership, .team-member, .contact-info, .contact-form-wrap'
  );
  revealElements.forEach(function(el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const delay = Array.from(entry.target.parentNode.children).indexOf(entry.target) * 80;
          setTimeout(function() {
            entry.target.classList.add('visible');
          }, Math.min(delay, 400));
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 100px 0px' });

    revealElements.forEach(function(el) { observer.observe(el); });

    // Failsafe
    setTimeout(function() {
      revealElements.forEach(function(el) { el.classList.add('visible'); });
    }, 4000);
  } else {
    revealElements.forEach(function(el) { el.classList.add('visible'); });
  }

  // ----- Smooth scroll for anchor links -----
  document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offset = 70;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  // ----- Contact form: submit to Supabase -----
  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const formNote = document.getElementById('formNote');

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Light validation polish
      const required = form.querySelectorAll('[required]');
      let valid = true;
      required.forEach(function(field) {
        if (!field.value.trim()) {
          field.style.borderColor = '#9B2C2C';
          valid = false;
        } else {
          field.style.borderColor = '';
        }
      });
      if (!valid) {
        formNote.textContent = 'Please fill in the required fields.';
        formNote.style.color = '#9B2C2C';
        return;
      }

      // Disable submit, show in-progress state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      submitBtn.style.opacity = '0.7';
      formNote.textContent = '';

      // Collect form data
      const payload = {
        name: form.name.value.trim(),
        organisation: form.organisation.value.trim() || null,
        email: form.email.value.trim(),
        interest: form.interest.value || null,
        message: form.message.value.trim(),
        user_agent: navigator.userAgent || null
      };

      try {
        // Check that Supabase keys are configured
        if (SUPABASE_URL.indexOf('YOUR-PROJECT-REF') !== -1 ||
            SUPABASE_ANON_KEY.indexOf('YOUR-PUBLIC-ANON-KEY') !== -1) {
          throw new Error('Supabase keys not configured. See DEPLOYMENT.md.');
        }

        const response = await fetch(SUPABASE_URL + '/rest/v1/enquiries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          // Success
          form.reset();
          submitBtn.textContent = 'Message sent';
          submitBtn.style.background = '#1F6F43';
          submitBtn.style.borderColor = '#1F6F43';
          submitBtn.style.color = '#FFFFFF';
          formNote.textContent = 'Thank you. We will respond within two business days.';
          formNote.style.color = '#1F6F43';

          // Reset button state after 5s for any further submission
          setTimeout(function() {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send message';
            submitBtn.style.background = '';
            submitBtn.style.borderColor = '';
            submitBtn.style.color = '';
            submitBtn.style.opacity = '';
            formNote.textContent = 'We respond to all serious enquiries within two business days.';
            formNote.style.color = '';
          }, 6000);
        } else {
          throw new Error('Server returned ' + response.status);
        }
      } catch (err) {
        // Failure: graceful fallback
        console.error('Form submission failed:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send message';
        submitBtn.style.opacity = '';
        formNote.innerHTML = 'Submission did not go through. Please email us directly at <a href="mailto:info@syriasilicon.com" style="color:inherit;text-decoration:underline;">info@syriasilicon.com</a>.';
        formNote.style.color = '#9B2C2C';
      }
    });

    // Clear error state on input
    form.querySelectorAll('input, select, textarea').forEach(function(input) {
      input.addEventListener('input', function() {
        if (this.value.trim()) this.style.borderColor = '';
      });
    });
  }

  // ----- Calculator tabs -----
  const calcTabs = document.querySelectorAll('.calc-tab');
  const calcScenarios = document.querySelectorAll('.calc-scenario');

  calcTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      const scenario = this.getAttribute('data-scenario');
      calcTabs.forEach(function(t) { t.classList.remove('calc-tab-active'); });
      this.classList.add('calc-tab-active');
      calcScenarios.forEach(function(s) {
        if (s.getAttribute('data-scenario') === scenario) {
          s.classList.add('calc-scenario-active');
        } else {
          s.classList.remove('calc-scenario-active');
        }
      });
    });
  });

})();
