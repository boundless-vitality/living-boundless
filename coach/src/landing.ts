// The page a plan link opens in a phone's browser. It never sends the plan
// anywhere: the plan is in the #fragment, which browsers don't send to servers.
import { APP_NAME, CLINIC_NAME, decodePlanLink, planIssuedLine } from '@lb/shared';
import { installFonts } from './fonts';
import './styles.css';

installFonts();
const root = document.getElementById('root')!;
const result = decodePlanLink(location.href);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

root.append(el('div', { className: 'wordmark' }, CLINIC_NAME.toLowerCase()), el('div', { className: 'leaf' }));

if (result.ok) {
  const copyBtn = el('button', { className: 'primary big' }, 'Copy plan link');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      copyBtn.textContent = 'Copied ✓';
    } catch {
      copyBtn.textContent = 'Press and hold the address bar to copy';
    }
  });
  root.append(
    el('h1', {}, 'your plan is ready'),
    el('div', { className: 'plan-name' }, `${result.plan.title} · ${planIssuedLine(result.plan)}`),
    copyBtn,
    el(
      'ol',
      {},
      el('li', {}, `Open the ${APP_NAME} app`),
      el('li', {}, 'Tap ', el('strong', {}, 'Add plan'), ' → ', el('strong', {}, 'Paste link')),
    ),
    el('p', { className: 'fine' }, "Your plan stays on your phone. This page doesn't save or send it anywhere."),
  );
} else {
  root.append(
    el('h1', {}, 'hmm, that link looks incomplete'),
    el('p', {}, result.message),
    el('p', { className: 'fine' }, `If it keeps happening, message the ${CLINIC_NAME} team and we'll resend it.`),
  );
}
