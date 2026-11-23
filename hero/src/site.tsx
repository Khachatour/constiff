import { createRoot } from 'react-dom/client'
import ConstiffHero from './index'

// Mounts the hero into the constiff site's #hero-demo, if the page has one,
// and follows the page's theme (dark unless <html data-theme="light">).
const el = document.getElementById('hero-demo')
if (el) {
  const root = createRoot(el)
  const html = document.documentElement
  const render = () => root.render(<ConstiffHero theme={html.dataset.theme === 'light' ? 'light' : 'dark'} />)
  render()
  new MutationObserver(render).observe(html, { attributes: true, attributeFilter: ['data-theme'] })
}
