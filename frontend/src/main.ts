import './ad-app';

const root = document.querySelector('#app');

if (root && !root.querySelector('ad-app')) {
  const appElement = document.createElement('ad-app');
  root.appendChild(appElement);
}
