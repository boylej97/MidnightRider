/* ============================================
MIDNIGHT RIDER — script.js
============================================ */

/* — CUSTOM CURSOR — */
const cursor     = document.getElementById(‘cursor’);
const cursorRing = document.getElementById(‘cursorRing’);

let mouseX = 0, mouseY = 0;
let ringX  = 0, ringY  = 0;

document.addEventListener(‘mousemove’, (e) => {
mouseX = e.clientX;
mouseY = e.clientY;

// Dot follows instantly
cursor.style.left = mouseX + ‘px’;
cursor.style.top  = mouseY + ‘px’;
});

// Ring follows with slight lag
function animateCursor() {
ringX += (mouseX - ringX) * 0.14;
ringY += (mouseY - ringY) * 0.14;

cursorRing.style.left = ringX + ‘px’;
cursorRing.style.top  = ringY + ‘px’;

requestAnimationFrame(animateCursor);
}
animateCursor();

// Scale cursor on hoverable elements
const hoverables = document.querySelectorAll(‘a, button, .stat-box, .content-card, .gallery-item, .social-card’);

hoverables.forEach(el => {
el.addEventListener(‘mouseenter’, () => {
cursor.style.transform = ‘translate(-50%, -50%) scale(2.2)’;
cursorRing.style.transform = ‘translate(-50%, -50%) scale(1.4)’;
cursorRing.style.borderColor = ‘rgba(232,160,32,0.8)’;
});
el.addEventListener(‘mouseleave’, () => {
cursor.style.transform = ‘translate(-50%, -50%) scale(1)’;
cursorRing.style.transform = ‘translate(-50%, -50%) scale(1)’;
cursorRing.style.borderColor = ‘rgba(232,160,32,0.45)’;
});
});

/* — NAVBAR: add .scrolled class on scroll — */
const navbar = document.getElementById(‘navbar’);

window.addEventListener(‘scroll’, () => {
if (window.scrollY > 60) {
navbar.classList.add(‘scrolled’);
} else {
navbar.classList.remove(‘scrolled’);
}
});

/* — SCROLL REVEAL — */
// Add .reveal class to elements you want to animate in
const revealTargets = document.querySelectorAll(
‘.about-text, .about-stats, .stat-box, .content-card, .gallery-item, .social-card, .contact-note, .connect-sub, .gallery-sub’
);

revealTargets.forEach(el => {
el.classList.add(‘reveal’);
});

const revealObserver = new IntersectionObserver((entries) => {
entries.forEach((entry, index) => {
if (entry.isIntersecting) {
// Stagger children a little
setTimeout(() => {
entry.target.classList.add(‘revealed’);
}, 80);
revealObserver.unobserve(entry.target);
}
});
}, {
threshold: 0.12,
rootMargin: ‘0px 0px -40px 0px’
});

revealTargets.forEach(el => revealObserver.observe(el));

/* — HAMBURGER MENU — */
const hamburger   = document.getElementById(‘hamburger’);
const mobileMenu  = document.getElementById(‘mobileMenu’);
const mobileClose = document.getElementById(‘mobileClose’);

function openMenu() {
mobileMenu.classList.add(‘open’);
hamburger.classList.add(‘open’);
document.body.style.overflow = ‘hidden’; // prevent scroll behind menu
}

function closeMenu() {
mobileMenu.classList.remove(‘open’);
hamburger.classList.remove(‘open’);
document.body.style.overflow = ‘’;
}

hamburger.addEventListener(‘click’, openMenu);
mobileClose.addEventListener(‘click’, closeMenu);

// Close when a mobile nav link is clicked
document.querySelectorAll(’.mobile-links a’).forEach(link => {
link.addEventListener(‘click’, closeMenu);
});

// Close on background tap (if somehow clicking outside)
mobileMenu.addEventListener(‘click’, (e) => {
if (e.target === mobileMenu) closeMenu();
});

/* — SMOOTH ANCHOR SCROLL (override for nav links) — */
document.querySelectorAll(‘a[href^=”#”]’).forEach(link => {
link.addEventListener(‘click’, (e) => {
const target = document.querySelector(link.getAttribute(‘href’));
if (target) {
e.preventDefault();
target.scrollIntoView({ behavior: ‘smooth’, block: ‘start’ });
}
});
});

/* — ACTIVE NAV LINK HIGHLIGHT on scroll — */
const sections = document.querySelectorAll(‘section[id]’);
const navLinks = document.querySelectorAll(’.nav-links a’);

const sectionObserver = new IntersectionObserver((entries) => {
entries.forEach(entry => {
if (entry.isIntersecting) {
const id = entry.target.getAttribute(‘id’);
navLinks.forEach(link => {
link.style.color = link.getAttribute(‘href’) === `#${id}`
? ‘var(–amber)’
: ‘’;
});
}
});
}, { threshold: 0.4 });

sections.forEach(section => sectionObserver.observe(section));

/* — GALLERY: swap placeholders for real images — */
/*
To add real images:

1. Create an “images” folder next to index.html
1. Add your photos there (e.g. images/ride1.jpg)
1. Replace .gallery-placeholder divs in index.html with:

  <img src="images/ride1.jpg" alt="Description of your image" />

Example gallery-item with real image:

  <div class="gallery-item tall">
    <img src="images/highland-pass.jpg" alt="Highland pass on the NC500" />
  </div>
*/

/* — CONSOLE EASTER EGG — */
console.log(’%c🏍️ MIDNIGHT RIDER’, ‘font-size:24px; font-weight:bold; color:#e8a020;’);
console.log(’%cScotland's roads. Two wheels. No limits.’, ‘font-size:13px; color:#b0b0b0;’);
