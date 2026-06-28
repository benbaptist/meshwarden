import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router.js'
import AppShell from './components/layout/AppShell.js'

// Shared components
import Modal from './components/shared/Modal.js'
import Toast from './components/shared/Toast.js'
import Spinner from './components/shared/Spinner.js'
import ConfirmDialog from './components/shared/ConfirmDialog.js'
import SignalBadge from './components/contacts/SignalBadge.js'
import Icon from './components/shared/Icon.js'
import Logo from './components/shared/Logo.js'
import ChatPanel from './components/shared/ChatPanel.js'

const app = createApp(AppShell)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Register global components (available in all templates without import)
app.component('Modal', Modal)
app.component('AppToast', Toast)
app.component('Spinner', Spinner)
app.component('ConfirmDialog', ConfirmDialog)
app.component('SignalBadge', SignalBadge)
app.component('Icon', Icon)
app.component('Logo', Logo)
app.component('ChatPanel', ChatPanel)

app.mount('#app')

// Log version
fetch('/api/version').then(r => r.json()).then(({ version }) => {
  console.log(`%cMeshWarden ${version}`, 'color: #7c3aed; font-weight: bold; font-size: 14px;')
})

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error)
}
