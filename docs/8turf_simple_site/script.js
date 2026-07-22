const menuButton = document.querySelector('.menu-button');
const navLinks = document.querySelector('.nav-links');
menuButton.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('.nav-links a').forEach((link) =>
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }),
);

document.getElementById('year').textContent = new Date().getFullYear();

const propertySelect = document.getElementById('propertySelect');
document.querySelectorAll('[data-property]').forEach((link) => {
  link.addEventListener('click', () => {
    propertySelect.value = link.dataset.property;
  });
});

document.getElementById('inquiryForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const subject = encodeURIComponent(`8TURF Inquiry - ${data.get('property')}`);
  const body = encodeURIComponent(
    `Hello 8TURF Properties,

I would like to inquire about ${data.get('property')}.

Name: ${data.get('name')}
Contact number: ${data.get('phone')}
Message: ${data.get('message') || 'Please send current availability and rental details.'}

Thank you.`,
  );
  window.location.href = `mailto:your-email@example.com?subject=${subject}&body=${body}`;
});

const lightbox = document.getElementById('lightbox');
const lightboxImage = lightbox.querySelector('img');
document.querySelectorAll('[data-lightbox]').forEach((button) => {
  button.addEventListener('click', () => {
    lightboxImage.src = button.dataset.lightbox;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
  });
});
function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.src = '';
}
lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeLightbox();
});
