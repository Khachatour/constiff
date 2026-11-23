import { createRoot } from 'react-dom/client'
import ConstiffHero from './index'

// Mounts the hero into the constiff site's #hero-demo, if the page has one.
const el = document.getElementById('hero-demo')
if (el) createRoot(el).render(<ConstiffHero />)
