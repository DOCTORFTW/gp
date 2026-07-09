/* main.js - Client-side Interactive Logic for Aura Spaces */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // 1. Header Scroll Effect & Active Navigation Link Tracking
  // =========================================================================
  const header = document.getElementById('main-header');
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('section, header');

  window.addEventListener('scroll', () => {
    // Scroll header background transition
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Active Section link highlighting
    let currentSectionId = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (window.scrollY >= sectionTop - 150) {
        currentSectionId = section.getAttribute('id');
      }
    });

    if (currentSectionId) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSectionId}`) {
          link.classList.add('active');
        }
      });
    }
  });

  // =========================================================================
  // 2. Mobile Menu Navigation Toggle
  // =========================================================================
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      mobileToggle.classList.toggle('active');
      
      // Animate hamburger lines
      const spans = mobileToggle.querySelectorAll('span');
      if (mobileToggle.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translate(6px, 6px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(6px, -6px)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      }
    });

    // Close menu when link clicked
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        mobileToggle.classList.remove('active');
        mobileToggle.querySelectorAll('span').forEach(span => {
          span.style.transform = 'none';
          span.style.opacity = '1';
        });
      });
    });
  }

  // =========================================================================
  // 3. Theme Toggle (Dark & Light Modes)
  // =========================================================================
  const themeToggle = document.getElementById('theme-toggle');
  const htmlDoc = document.documentElement;

  // Retrieve saved theme or fallback to system preference
  const savedTheme = localStorage.getItem('itisa-home-decor-theme') || 
                     (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  
  htmlDoc.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = htmlDoc.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    htmlDoc.setAttribute('data-theme', newTheme);
    localStorage.setItem('itisa-home-decor-theme', newTheme);
  });


  // =========================================================================
  // 5. Portfolio Filtering Grid
  // =========================================================================
  const filterBtns = document.querySelectorAll('.filter-btn');
  const portfolioItems = document.querySelectorAll('.portfolio-item');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterVal = btn.dataset.filter;

      portfolioItems.forEach(item => {
        const itemCategory = item.dataset.category;
        
        // Premium animation: fade out first
        item.style.opacity = '0';
        item.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
          if (filterVal === 'all' || itemCategory === filterVal) {
            item.classList.remove('hidden');
            // Force browser reflow to trigger CSS transitions
            item.offsetHeight;
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
          } else {
            item.classList.add('hidden');
          }
        }, 300);
      });
    });
  });

  // =========================================================================
  // 6. Testimonials Slider
  // =========================================================================
  const slides = document.querySelectorAll('.testimonial-slide');
  const dots = document.querySelectorAll('.slider-dot');
  const prevBtn = document.getElementById('prev-slide');
  const nextBtn = document.getElementById('next-slide');
  let currentSlideIndex = 0;

  function showSlide(index) {
    // Boundary checks
    if (index >= slides.length) currentSlideIndex = 0;
    else if (index < 0) currentSlideIndex = slides.length - 1;
    else currentSlideIndex = index;

    slides.forEach((slide, idx) => {
      slide.classList.remove('active');
      dots[idx].classList.remove('active');
      
      if (idx === currentSlideIndex) {
        slide.classList.add('active');
        dots[idx].classList.add('active');
      }
    });
  }

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => showSlide(currentSlideIndex - 1));
    nextBtn.addEventListener('click', () => showSlide(currentSlideIndex + 1));
    
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const targetIndex = parseInt(dot.dataset.index);
        showSlide(targetIndex);
      });
    });
  }

  // =========================================================================
  // 7. Contact Consultation Form Validation & Submit Animation
  // =========================================================================
  const form = document.getElementById('consultation-form');
  const successState = document.getElementById('form-success');

  if (form && successState) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Reset errors
      let isFormValid = true;
      const inputs = form.querySelectorAll('.form-input[required]');
      
      inputs.forEach(input => {
        const group = input.closest('.form-group');
        group.classList.remove('has-error');

        // Text & Textarea checks
        if (!input.value.trim()) {
          group.classList.add('has-error');
          isFormValid = false;
        }

        // Email validation checks
        if (input.getAttribute('type') === 'email' && input.value.trim()) {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(input.value.trim())) {
            group.classList.add('has-error');
            isFormValid = false;
          }
        }
      });

      if (isFormValid) {
        // Trigger high-end fade out of form and display success panel
        form.style.transition = 'opacity 0.4s ease';
        form.style.opacity = '0';
        
        setTimeout(() => {
          form.style.display = 'none';
          successState.style.display = 'flex';
          
          // Trigger checkmark draw
          const icon = successState.querySelector('.success-icon');
          if (icon) {
            icon.style.strokeDashoffset = '0';
          }
        }, 400);
      }
    });

    // Form inputs real-time keyup error removal
    form.querySelectorAll('.form-input').forEach(input => {
      input.addEventListener('input', () => {
        const group = input.closest('.form-group');
        if (group.classList.contains('has-error') && input.value.trim()) {
          group.classList.remove('has-error');
        }
      });
    });
  }

  // =========================================================================
  // 8. Scroll Reveal Animations (Intersection Observer)
  // =========================================================================
  const revealElements = document.querySelectorAll('.reveal');

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.12 // Reveal when 12% of the element is visible
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        // Unobserve once triggered to lock layout state
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach(el => revealObserver.observe(el));
});
