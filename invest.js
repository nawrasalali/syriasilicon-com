/* =========================================================
   Syria Silicon — Investor Page Form Handler (locale-aware)
   Submits to the same Supabase enquiries table as the main
   contact form, tagged so investor pack requests can be filtered.
   ========================================================= */

(function() {
  'use strict';

  const SUPABASE_URL_LOCAL = (typeof SUPABASE_URL !== 'undefined')
    ? SUPABASE_URL
    : 'https://qzfrhxjcsnhaqhckfswi.supabase.co';
  const SUPABASE_ANON_KEY_LOCAL = (typeof SUPABASE_ANON_KEY !== 'undefined')
    ? SUPABASE_ANON_KEY
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZnJoeGpjc25oYXFoY2tmc3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTIxODMsImV4cCI6MjA5NDE2ODE4M30.-DLbZB7xVjVpTTbhqk4EKkAqpC8XRua2C7gvTQwdkWM';

  const form = document.getElementById('investForm');
  const submitBtn = document.getElementById('iSubmitBtn');
  const formNote = document.getElementById('iFormNote');

  if (!form) return;

  const path = window.location.pathname;
  let locale = 'en';
  let strings = {
    sending: 'Sending…',
    sent: 'Request received',
    success: 'Thank you. We will send the Invitation for Offers to your nominated email within one business day.',
    fillRequired: 'Please fill in the required fields.',
    submitDefault: 'Request the Invitation for Offers',
    failure: 'Submission did not go through. Please email us directly at info@syriasilicon.com.'
  };

  if (path.indexOf('/ar/') === 0) {
    locale = 'ar';
    strings = {
      sending: 'جارٍ الإرسال…',
      sent: 'تم استلام طلبكم',
      success: 'شكراً لكم. سنرسل دعوة تقديم العروض إلى بريدكم الإلكترونيّ خلال يوم عمل واحد.',
      fillRequired: 'يرجى تعبئة الحقول المطلوبة.',
      submitDefault: 'طلب دعوة تقديم العروض',
      failure: 'تعذّر إرسال الطلب. يرجى التواصل معنا مباشرةً على info@syriasilicon.com.'
    };
  } else if (path.indexOf('/zh/') === 0) {
    locale = 'zh';
    strings = {
      sending: '正在发送…',
      sent: '已收到您的请求',
      success: '感谢您的提交。我们将在一个工作日内将《征求投资意向函》发送至您留下的邮箱。',
      fillRequired: '请填写必填字段。',
      submitDefault: '索取《征求投资意向函》',
      failure: '提交未能成功。请直接发送邮件至 info@syriasilicon.com。'
    };
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

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
      formNote.textContent = strings.fillRequired;
      formNote.style.color = '#9B2C2C';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = strings.sending;
    submitBtn.style.opacity = '0.7';
    formNote.textContent = '';

    const lines = [];
    if (form.role && form.role.value.trim()) lines.push('Role: ' + form.role.value.trim());
    if (form.country && form.country.value.trim()) lines.push('Country / market: ' + form.country.value.trim());
    if (form.interest_type && form.interest_type.value) lines.push('Partnership lane: ' + form.interest_type.value);
    lines.push('Page locale: ' + locale);
    if (form.message && form.message.value.trim()) {
      lines.push('');
      lines.push('Note from sender:');
      lines.push(form.message.value.trim());
    }

    const payload = {
      name: form.name.value.trim(),
      organisation: form.organisation.value.trim(),
      email: form.email.value.trim(),
      interest: 'Investor pack request (' + locale + ')',
      message: lines.join('\n'),
      user_agent: navigator.userAgent || null
    };

    try {
      const response = await fetch(SUPABASE_URL_LOCAL + '/rest/v1/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY_LOCAL,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY_LOCAL,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        form.reset();
        submitBtn.textContent = strings.sent;
        submitBtn.style.background = '#1F6F43';
        submitBtn.style.borderColor = '#1F6F43';
        submitBtn.style.color = '#FFFFFF';
        formNote.textContent = strings.success;
        formNote.style.color = '#1F6F43';
      } else {
        throw new Error('Server returned ' + response.status);
      }
    } catch (err) {
      console.error('Investor form submission failed:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = strings.submitDefault;
      submitBtn.style.opacity = '';
      formNote.innerHTML = strings.failure.replace(
        'info@syriasilicon.com',
        '<a href="mailto:info@syriasilicon.com" style="color:inherit;text-decoration:underline;">info@syriasilicon.com</a>'
      );
      formNote.style.color = '#9B2C2C';
    }
  });

  form.querySelectorAll('input, select, textarea').forEach(function(input) {
    input.addEventListener('input', function() {
      if (this.value.trim()) this.style.borderColor = '';
    });
  });
})();
